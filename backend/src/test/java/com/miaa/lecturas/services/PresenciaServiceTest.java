package com.miaa.lecturas.services;

import com.miaa.lecturas.dtos.UbicacionEmpleadoDTO;
import com.miaa.lecturas.dtos.UbicacionRequestDTO;
import com.miaa.lecturas.entities.EstadoConexion;
import com.miaa.lecturas.entities.Rol;
import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.entities.UsuarioPresencia;
import com.miaa.lecturas.repositories.UsuarioPresenciaRepository;
import com.miaa.lecturas.repositories.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** La regla de presencia (Sprints 3 y 5) sin base de datos ni Spring. */
@SuppressWarnings("null") // capture() y any() de Mockito devuelven null a propósito
class PresenciaServiceTest {

    private static final Instant AHORA = Instant.parse("2026-11-18T20:00:00Z");
    private static final long MARGEN = 60;

    private UsuarioPresenciaRepository presencias;
    private UsuarioRepository usuarios;
    private LimiteAguascalientes limite;
    private GeocodificadorInverso geocodificador;
    private PresenciaService servicio;

    @BeforeEach
    void preparar() {
        presencias = mock(UsuarioPresenciaRepository.class);
        usuarios = mock(UsuarioRepository.class);
        limite = mock(LimiteAguascalientes.class);
        geocodificador = mock(GeocodificadorInverso.class);
        servicio = new PresenciaService(presencias, usuarios, limite, geocodificador, MARGEN, 45);
    }

    private static UsuarioPresencia presencia(EstadoConexion estado, Instant ultima) {
        UsuarioPresencia p = new UsuarioPresencia();
        p.setUsuarioId(1L);
        p.setEstadoConexion(estado);
        p.setUltimaConexionUtc(ultima);
        return p;
    }

    private static Usuario notificador(long id, String nombre, Boolean habilitado) {
        Usuario u = new Usuario();
        u.setId(id);
        u.setNombre(nombre);
        u.setRol(Rol.NOTIFICADOR);
        u.setHabilitado(habilitado);
        return u;
    }

    // ---------------------------------------------------------------- ACTIVO / INACTIVO

    @Test
    void latidoRecienteEstaActivoJustoHastaElLimite() {
        assertTrue(PresenciaService.activo(presencia(EstadoConexion.ACTIVO, AHORA.minusSeconds(20)), AHORA, MARGEN));
        assertTrue(PresenciaService.activo(presencia(EstadoConexion.ACTIVO, AHORA.minusSeconds(60)), AHORA, MARGEN));
        assertFalse(PresenciaService.activo(presencia(EstadoConexion.ACTIVO, AHORA.minusSeconds(61)), AHORA, MARGEN),
                "sin latido por más del margen es INACTIVO aunque la tarea programada no haya pasado");
    }

    @Test
    void cerroSesionEstaInactivoAunqueElLatidoSeaReciente() {
        assertFalse(PresenciaService.activo(presencia(EstadoConexion.INACTIVO, AHORA.minusSeconds(5)), AHORA, MARGEN));
        assertFalse(PresenciaService.activo(null, AHORA, MARGEN), "nunca ha entrado");
    }

    @Test
    void laTareaProgramadaMarcaInactivosALosQueSuperanElUmbral() {
        Instant antes = Instant.now();

        servicio.marcarInactivosSinLatido();

        ArgumentCaptor<Instant> limiteUsado = ArgumentCaptor.forClass(Instant.class);
        verify(presencias).marcarInactivos(limiteUsado.capture(), eq(EstadoConexion.ACTIVO), eq(EstadoConexion.INACTIVO));
        assertFalse(limiteUsado.getValue().isAfter(antes.minusSeconds(MARGEN - 1)));
        assertFalse(limiteUsado.getValue().isBefore(antes.minusSeconds(MARGEN + 1)));
    }

    // ---------------------------------------------------------------- latido (tarea 1.2)

    @Test
    void elLatidoConCoordenadasGuardaElPuntoYPideLaDireccion() {
        when(limite.contiene(21.88, -102.29)).thenReturn(true);
        when(presencias.findById(1L)).thenReturn(Optional.empty());

        servicio.latido(1L, new UbicacionRequestDTO(21.88, -102.29, 8.0));

        ArgumentCaptor<UsuarioPresencia> guardada = ArgumentCaptor.forClass(UsuarioPresencia.class);
        verify(presencias).save(guardada.capture());
        UsuarioPresencia p = guardada.getValue();
        assertEquals(EstadoConexion.ACTIVO, p.getEstadoConexion());
        assertEquals(21.88, p.getUltimaLatitud());
        assertNotNull(p.getUltimaConexionUtc());
        assertNotNull(p.getFechaUbicacionUtc());
        verify(geocodificador).solicitar(1L, 21.88, -102.29);
    }

    @Test
    void elLatidoSinCoordenadasNoBorraElUltimoPunto() {
        UsuarioPresencia p = presencia(EstadoConexion.INACTIVO, AHORA.minusSeconds(600));
        p.setUltimaLatitud(21.9);
        when(presencias.findById(1L)).thenReturn(Optional.of(p));

        servicio.latido(1L, null);

        assertEquals(EstadoConexion.ACTIVO, p.getEstadoConexion());
        assertEquals(21.9, p.getUltimaLatitud());
        verify(geocodificador, never()).solicitar(anyLong(), anyDouble(), anyDouble());
    }

    @Test
    void coordenadasFueraDeAguascalientesSeRechazanSinCambiarNada() {
        when(limite.contiene(19.43, -99.13)).thenReturn(false); // CDMX

        assertThrows(ResponseStatusException.class,
                () -> servicio.latido(1L, new UbicacionRequestDTO(19.43, -99.13, 5.0)));
        verify(presencias, never()).save(any());
    }

    // ---------------------------------------------------------------- mapa del admin (tarea 1.5)

    @Test
    void elMapaTraeATodosLosNotificadoresHabilitadosConSuEstado() {
        when(usuarios.findByRolOrderByNombreAsc(Rol.NOTIFICADOR)).thenReturn(List.of(
                notificador(1, "Ana", null), notificador(2, "Beto", true), notificador(3, "Caro", false)));
        UsuarioPresencia deAna = presencia(EstadoConexion.ACTIVO, Instant.now());
        deAna.setUltimaLatitud(21.88);
        deAna.setUltimaLongitud(-102.29);
        deAna.setFechaUbicacionUtc(Instant.now());
        deAna.setDireccionGeocodificada("Av. Madero 120, Zona Centro, Aguascalientes");
        when(presencias.findAll()).thenReturn(List.of(deAna));

        List<UbicacionEmpleadoDTO> mapa = servicio.cuadrillas();

        assertEquals(List.of("Ana", "Beto"), mapa.stream().map(UbicacionEmpleadoDTO::nombre).toList(), "Caro está dada de baja");
        UbicacionEmpleadoDTO ana = mapa.get(0);
        assertEquals(EstadoConexion.ACTIVO, ana.estadoConexion());
        assertEquals("NOTIFICADOR", ana.rol());
        assertEquals("Av. Madero 120, Zona Centro, Aguascalientes", ana.direccionGeocodificada());
        assertNotNull(ana.ultimaConexion());
        UbicacionEmpleadoDTO beto = mapa.get(1);
        assertEquals(EstadoConexion.INACTIVO, beto.estadoConexion());
        assertFalse(beto.tieneUbicacion(), "sale en la lista aunque nunca haya compartido");
    }
}
