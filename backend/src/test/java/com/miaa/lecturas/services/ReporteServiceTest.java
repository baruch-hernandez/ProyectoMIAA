package com.miaa.lecturas.services;

import com.miaa.lecturas.config.UsuarioPrincipal;
import com.miaa.lecturas.dtos.FotoDTO;
import com.miaa.lecturas.dtos.FotoRequestDTO;
import com.miaa.lecturas.dtos.ReporteDetalleDTO;
import com.miaa.lecturas.dtos.ReporteEdicionDTO;
import com.miaa.lecturas.dtos.ReporteResumenDTO;
import com.miaa.lecturas.entities.OrigenFechaFoto;
import com.miaa.lecturas.entities.OrigenFoto;
import com.miaa.lecturas.entities.Reporte;
import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.repositories.FotoReporteRepository;
import com.miaa.lecturas.repositories.NotaReporteRepository;
import com.miaa.lecturas.repositories.ReporteRepository;
import com.miaa.lecturas.repositories.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Quién puede ver y cambiar qué reporte. Sin base de datos: los repositorios son "mocks" (Mockito).
 */
@SuppressWarnings("null") // any() de Mockito devuelve null a propósito
class ReporteServiceTest {

    private static final UsuarioPrincipal AUTOR = new UsuarioPrincipal(10L, "autor", "Autor", "NOTIFICADOR");
    private static final UsuarioPrincipal OTRO = new UsuarioPrincipal(11L, "otro", "Otro", "NOTIFICADOR");
    private static final UsuarioPrincipal ADMIN = new UsuarioPrincipal(1L, "admin", "Admin", "ADMIN");

    private ReporteRepository reportes;
    private FotoReporteRepository fotos;
    private NotaReporteRepository notas;
    private UsuarioRepository usuarios;
    private LimiteAguascalientes limiteAgs;
    private ReporteService servicio;

    @BeforeEach
    void preparar() {
        reportes = mock(ReporteRepository.class);
        fotos = mock(FotoReporteRepository.class);
        notas = mock(NotaReporteRepository.class);
        usuarios = mock(UsuarioRepository.class);
        when(notas.buscarPorReporte(any())).thenReturn(List.of());
        limiteAgs = mock(LimiteAguascalientes.class);
        ValidadorFotos validador = mock(ValidadorFotos.class);
        when(validador.validar(any())).thenReturn(new ValidadorFotos.Medidas(1920, 1080));
        when(fotos.save(any())).thenAnswer(i -> i.getArgument(0));
        servicio = new ReporteService(reportes, fotos, notas, usuarios,
                limiteAgs, validador, 24);
    }

    /** Una foto con el GPS que se indique (null = sin GPS, como la web o la galería). */
    private static FotoRequestDTO foto(Double lat, Double lng, Double precision) {
        return new FotoRequestDTO("data:image/jpeg;base64,AAAA", Instant.parse("2026-11-03T18:04:05Z"),
                OrigenFechaFoto.OBTURADOR, OrigenFoto.CAMARA, lat, lng, precision, -120000L);
    }

    /** Un reporte del AUTOR creado hace [horas] horas. */
    private void reporte(long horas) {
        Usuario autor = new Usuario();
        autor.setId(AUTOR.id());
        autor.setNombre("Autor");
        Reporte r = new Reporte();
        r.setId(5L);
        r.setCreadoPor(autor);
        r.setFechaCreacion(LocalDateTime.now().minusHours(horas));
        when(reportes.buscarConAutor(5L)).thenReturn(Optional.of(r));
    }

    private static int status(ResponseStatusException e) {
        return e.getStatusCode().value();
    }

    private static ReporteEdicionDTO edicion() {
        return new ReporteEdicionDTO("Madero", "120", null, "Centro", "20000", "Aguascalientes",
                null, null, "BALDIO", "  01-001-0002 ", null, null, "Descripción corregida");
    }

    @Test
    void elTipoDePredioEsObligatorioYDeLaLista() {
        try (var fabrica = Validation.buildDefaultValidatorFactory()) {
            var validador = fabrica.getValidator();
            assertTrue(validador.validate(edicion()).isEmpty());
            var sinTipo = new ReporteEdicionDTO("Madero", "120", null, "Centro", "20000", "Aguascalientes",
                    null, null, null, null, null, null, "Descripción corregida");
            var inventado = new ReporteEdicionDTO("Madero", "120", null, "Centro", "20000", "Aguascalientes",
                    null, null, "CASA", null, null, null, "Descripción corregida");
            assertEquals("tipoPredio", validador.validate(sinTipo).iterator().next().getPropertyPath().toString());
            assertEquals("Tipo de predio no válido", validador.validate(inventado).iterator().next().getMessage());
        }
    }

    @Test
    void otroNotificadorNoVeElReporteNiSabeQueExiste() {
        reporte(1);
        assertEquals(404, status(assertThrows(ResponseStatusException.class, () -> servicio.detalle(OTRO, 5L))));
    }

    @Test
    void elAdminCorrigeLosDatosAunqueHayaPasadoElPlazoYQuedaNota() {
        reporte(25);
        when(usuarios.findById(ADMIN.id())).thenReturn(Optional.of(new Usuario()));

        ReporteDetalleDTO d = servicio.editar(ADMIN, 5L, edicion());

        assertEquals("Descripción corregida", d.descripcion());
        assertEquals("BALDIO", d.tipoPredio());
        assertEquals("01-001-0002", d.claveCatastral());
        assertTrue(d.puedeCorregir());
        assertFalse(d.puedeModificar()); // no borra ni toca fotos
        verify(notas).save(any());
    }

    @Test
    void elAdminNoBorraElReporteNiSusFotos() {
        reporte(1);
        assertEquals(403, status(assertThrows(ResponseStatusException.class, () -> servicio.borrar(ADMIN, 5L))));
        assertEquals(403, status(assertThrows(ResponseStatusException.class, () -> servicio.borrarFoto(ADMIN, 5L, 7L))));
        verify(fotos, never()).delete(any());
    }

    @Test
    void elAdminYElAutorConversanPorNotasPeroOtroNotificadorNo() {
        reporte(25); // las notas no tienen plazo
        when(usuarios.findById(any())).thenReturn(Optional.of(new Usuario()));
        when(notas.save(any())).thenAnswer(i -> i.getArgument(0));

        assertTrue(servicio.detalle(ADMIN, 5L).puedeAnotar());
        servicio.agregarNota(ADMIN, 5L, "¿Puedes confirmar el número exterior?");
        servicio.agregarNota(AUTOR, 5L, "Sí, es el 120.");

        verify(notas, times(2)).save(any());
        assertEquals(404, status(assertThrows(ResponseStatusException.class,
                () -> servicio.agregarNota(OTRO, 5L, "No es mío"))));
    }

    @Test
    void despuesDe24HorasNoSeEditaNiSeTocanLasFotos() {
        reporte(25);
        assertEquals(403, status(assertThrows(ResponseStatusException.class,
                () -> servicio.editar(AUTOR, 5L, edicion()))));
        assertEquals(403, status(assertThrows(ResponseStatusException.class,
                () -> servicio.borrarFoto(AUTOR, 5L, 7L))));
        verify(fotos, never()).delete(any());
    }

    @Test
    void laListaJuntaLosConteosYLosQueNoTienenFotosQuedanEnCero() {
        reporte(1);
        Reporte conFotos = reportes.buscarConAutor(5L).orElseThrow();
        conFotos.setDescripcion("Medidor sin sello");
        Reporte sinNada = new Reporte();
        sinNada.setId(6L);
        sinNada.setCreadoPor(conFotos.getCreadoPor());
        sinNada.setDescripcion("Toma clandestina");

        List<Object[]> fotosPorReporte = List.<Object[]>of(new Object[] { 5L, 3L });
        List<ReporteResumenDTO> lista = ReporteService.aResumenes(List.of(conFotos, sinNada), fotosPorReporte, List.of());

        assertEquals(3L, lista.get(0).totalFotos());
        assertEquals(0L, lista.get(1).totalFotos());
        assertEquals(0L, lista.get(1).totalNotas());
    }

    @Test
    void dentroDeLaVentanaElAutorSiEdita() {
        reporte(2);
        servicio.editar(AUTOR, 5L, edicion());
    }

    // ---------- Historia 3: punto GPS de cada foto ----------

    @Test
    void laFotoGuardaSuPuntoSuPrecisionYElDesfaseDelReloj() {
        reporte(1);
        when(limiteAgs.contiene(21.88234, -102.29581)).thenReturn(true);
        FotoDTO f = servicio.agregarFoto(AUTOR, 5L, foto(21.88234, -102.29581, 0.8));
        assertEquals(21.88234, f.latitud());
        assertEquals(0.8, f.precisionGps());
        assertEquals(-120000L, f.desfaseRelojMs());
        assertEquals(OrigenFechaFoto.OBTURADOR, f.origenFecha());
        assertEquals(OrigenFoto.CAMARA, f.origenFoto());
    }

    @Test
    void sinGpsTambienSeAcepta_comoLaWebOLaGaleria() {
        reporte(1);
        assertNull(servicio.agregarFoto(AUTOR, 5L, foto(null, null, null)).latitud());
    }

    @Test
    void unGpsIncompletoOFueraDelEstadoSeRechaza() {
        reporte(1);
        assertEquals(400, status(assertThrows(ResponseStatusException.class,
                () -> servicio.agregarFoto(AUTOR, 5L, foto(21.88234, -102.29581, null)))));
        // el rectángulo del DTO lo deja pasar, pero el contorno real no (mock: contiene = false)
        assertEquals(400, status(assertThrows(ResponseStatusException.class,
                () -> servicio.agregarFoto(AUTOR, 5L, foto(22.4, -101.8, 0.8)))));
        verify(fotos, never()).save(any());
    }

    @Test
    void unaPrecisionInvalidaNiSiquieraPasaElDTO() {
        var validador = Validation.buildDefaultValidatorFactory().getValidator();
        assertEquals(1, validador.validate(foto(21.88234, -102.29581, 0.0)).size());
        assertEquals(1, validador.validate(foto(21.88234, -102.29581, 25.0)).size());
        assertEquals(0, validador.validate(foto(21.88234, -102.29581, 0.8)).size());
    }
}
