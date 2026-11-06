package com.miaa.lecturas.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDateTime;

import org.junit.jupiter.api.Test;

import com.miaa.lecturas.dtos.EmpleadoDTO;
import com.miaa.lecturas.entities.Disponibilidad;
import com.miaa.lecturas.entities.Usuario;

class EmpleadoServiceTest {

    private static EmpleadoDTO armar(Usuario u, Disponibilidad disponibilidad) {
        return EmpleadoService.armar(u, 0, null, LocalDateTime.now(), false, disponibilidad);
    }

    @Test
    void estaActivoSoloConLatidosAunqueHayaEntradoHoy() {
        Usuario u = new Usuario();
        u.setUltimoAcceso(LocalDateTime.now());

        assertTrue(armar(u, Disponibilidad.EN_LINEA).activo());
        assertFalse(armar(u, Disponibilidad.DESCONECTADO).activo());
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
