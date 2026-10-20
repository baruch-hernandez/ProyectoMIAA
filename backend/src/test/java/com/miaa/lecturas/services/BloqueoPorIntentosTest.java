package com.miaa.lecturas.services;

import com.miaa.lecturas.entities.Usuario;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Tarea 1.6: bloqueo temporal de la cuenta tras N contraseñas incorrectas seguidas. */
class BloqueoPorIntentosTest {

    private static final LocalDateTime AHORA = LocalDateTime.of(2026, 10, 20, 9, 0);
    private final BloqueoPorIntentos bloqueo = new BloqueoPorIntentos(5, 15);

    @Test
    void cuatroFallosNoBloqueanYCuentanLosIntentosRestantes() {
        Usuario u = new Usuario();
        BloqueoPorIntentos.Fallo fallo = null;
        for (int i = 1; i <= 4; i++) {
            fallo = bloqueo.registrarFallo(u, AHORA);
        }
        assertFalse(fallo.bloqueo());
        assertEquals(1, fallo.intentosRestantes());
        assertNull(bloqueo.bloqueadaHasta(u, AHORA));
    }

    @Test
    void elQuintoFalloBloqueaQuinceMinutos() {
        Usuario u = new Usuario();
        BloqueoPorIntentos.Fallo fallo = null;
        for (int i = 1; i <= 5; i++) {
            fallo = bloqueo.registrarFallo(u, AHORA);
        }
        assertTrue(fallo.bloqueo());
        assertEquals(AHORA.plusMinutes(15), fallo.bloqueadoHasta());
        assertNotNull(bloqueo.bloqueadaHasta(u, AHORA.plusMinutes(14)));
        assertEquals(0, (int) u.getIntentosFallidos(), "al bloquear, el contador vuelve a 0");
    }

    @Test
    void elBloqueoVenceSolo() {
        Usuario u = new Usuario();
        u.setBloqueadoHasta(AHORA.plusMinutes(15));
        assertNull(bloqueo.bloqueadaHasta(u, AHORA.plusMinutes(15)));
        assertNull(bloqueo.bloqueadaHasta(u, AHORA.plusMinutes(16)));
    }

    @Test
    void unBloqueoVencidoNoCuentaComoFallo() {
        Usuario u = new Usuario();
        u.setBloqueadoHasta(AHORA.minusMinutes(1));
        BloqueoPorIntentos.Fallo fallo = bloqueo.registrarFallo(u, AHORA);
        assertFalse(fallo.bloqueo());
        assertEquals(4, fallo.intentosRestantes());
        assertNull(u.getBloqueadoHasta());
    }

    @Test
    void entrarBienReiniciaElContador() {
        Usuario u = new Usuario();
        bloqueo.registrarFallo(u, AHORA);
        bloqueo.registrarFallo(u, AHORA);
        bloqueo.registrarExito(u);
        assertEquals(0, (int) u.getIntentosFallidos());
        assertEquals(4, bloqueo.registrarFallo(u, AHORA).intentosRestantes());
    }

    @Test
    void elAdminPuedeDesbloquear() {
        Usuario u = new Usuario();
        u.setBloqueadoHasta(AHORA.plusMinutes(10));
        u.setIntentosFallidos(3);
        BloqueoPorIntentos.desbloquear(u);
        assertNull(bloqueo.bloqueadaHasta(u, AHORA));
        assertEquals(0, (int) u.getIntentosFallidos());
    }

    @Test
    void tiempoRestanteSeRedondeaHaciaArriba() {
        assertEquals(15, BloqueoPorIntentos.minutosRestantes(AHORA.plusMinutes(15), AHORA));
        assertEquals(1, BloqueoPorIntentos.minutosRestantes(AHORA.plusSeconds(5), AHORA));
        assertEquals(90, BloqueoPorIntentos.segundosRestantes(AHORA.plusSeconds(90), AHORA));
    }

    @Test
    void rechazaConfiguracionesInvalidas() {
        assertThrows(IllegalArgumentException.class, () -> new BloqueoPorIntentos(0, 15));
        assertThrows(IllegalArgumentException.class, () -> new BloqueoPorIntentos(5, 0));
    }
}
