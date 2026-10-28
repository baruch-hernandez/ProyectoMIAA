package com.miaa.lecturas.services;

import com.miaa.lecturas.config.UsuarioPrincipal;
import com.miaa.lecturas.dtos.ReporteEdicionDTO;
import com.miaa.lecturas.dtos.ReporteResumenDTO;
import com.miaa.lecturas.entities.Reporte;
import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.repositories.FotoReporteRepository;
import com.miaa.lecturas.repositories.NotaReporteRepository;
import com.miaa.lecturas.repositories.ReporteRepository;
import com.miaa.lecturas.repositories.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Quién puede ver y cambiar qué reporte. Sin base de datos: los repositorios son "mocks" (Mockito).
 */
class ReporteServiceTest {

    private static final UsuarioPrincipal AUTOR = new UsuarioPrincipal(10L, "autor", "Autor", "NOTIFICADOR");
    private static final UsuarioPrincipal OTRO = new UsuarioPrincipal(11L, "otro", "Otro", "NOTIFICADOR");
    private static final UsuarioPrincipal ADMIN = new UsuarioPrincipal(1L, "admin", "Admin", "ADMIN");

    private ReporteRepository reportes;
    private FotoReporteRepository fotos;
    private ReporteService servicio;

    @BeforeEach
    void preparar() {
        reportes = mock(ReporteRepository.class);
        fotos = mock(FotoReporteRepository.class);
        NotaReporteRepository notas = mock(NotaReporteRepository.class);
        when(notas.buscarPorReporte(any())).thenReturn(List.of());
        servicio = new ReporteService(reportes, fotos, notas, mock(UsuarioRepository.class),
                mock(LimiteAguascalientes.class), mock(ValidadorFotos.class), 24);
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
                null, null, null, null, "Descripción corregida");
    }

    @Test
    void otroNotificadorNoVeElReporteNiSabeQueExiste() {
        reporte(1);
        assertEquals(404, status(assertThrows(ResponseStatusException.class, () -> servicio.detalle(OTRO, 5L))));
    }

    @Test
    void elAdminLoVePeroNoLoCambia() {
        reporte(1);
        assertEquals(5L, servicio.detalle(ADMIN, 5L).id());
        assertEquals(403, status(assertThrows(ResponseStatusException.class, () -> servicio.borrar(ADMIN, 5L))));
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
}
