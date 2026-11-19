package com.miaa.lecturas.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.miaa.lecturas.dtos.EmpleadoDTO;
import com.miaa.lecturas.entities.Disponibilidad;
import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.repositories.ReporteRepository;
import com.miaa.lecturas.repositories.UsuarioRepository;

class EmpleadoServiceTest {

    private static EmpleadoDTO armar(Usuario u, Disponibilidad disponibilidad) {
        return EmpleadoService.armar(u, 0, null, LocalDateTime.now(), false, disponibilidad, null);
    }

    @Test
    void estaActivoSoloConLatidosAunqueHayaEntradoHoy() {
        Usuario u = new Usuario();
        u.setUltimoAcceso(LocalDateTime.now());

        assertTrue(armar(u, Disponibilidad.EN_LINEA).activo());
        assertFalse(armar(u, Disponibilidad.DESCONECTADO).activo());
    }

    @Test
    void laTablaQueSePideCadaSegundoNoRecorreLosReportesCadaVez() {
        ReporteRepository reportes = mock(ReporteRepository.class);
        when(reportes.estadisticasPorUsuario()).thenReturn(List.of());
        PresenciaService presencia = mock(PresenciaService.class);
        when(presencia.porUsuario()).thenReturn(Map.of());
        EmpleadoService servicio = new EmpleadoService(mock(UsuarioRepository.class), reportes, presencia);

        servicio.listar();
        servicio.listar();

        verify(reportes, times(1)).estadisticasPorUsuario();
    }

    @Test
    void unEmpleadoDadoDeBajaNuncaSaleActivo() {
        Usuario u = new Usuario();
        u.setHabilitado(false);

        EmpleadoDTO dto = armar(u, Disponibilidad.EN_LINEA);

        assertFalse(dto.activo());
        assertEquals(Disponibilidad.DESCONECTADO, dto.disponibilidad());
    }
}
