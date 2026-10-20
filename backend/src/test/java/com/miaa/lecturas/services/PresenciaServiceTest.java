package com.miaa.lecturas.services;

import com.miaa.lecturas.entities.Disponibilidad;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Prueba la regla de presencia sin base de datos ni Spring (tarea 2.4, evidencia para la 5.1). */
class PresenciaServiceTest {

    private static final LocalDateTime AHORA = LocalDateTime.of(2026, 10, 16, 10, 0, 0);
    private static final long MARGEN = 60;

    @Test
    void latidoRecienteEstaEnLinea() {
        assertEquals(Disponibilidad.EN_LINEA, PresenciaService.calcular(true, AHORA.minusSeconds(20), AHORA, MARGEN));
    }

    @Test
    void justoEnElLimiteSigueEnLinea() {
        assertEquals(Disponibilidad.EN_LINEA, PresenciaService.calcular(true, AHORA.minusSeconds(60), AHORA, MARGEN));
    }

    @Test
    void sinLatidoPorMasDelMargenEstaDesconectado() {
        assertEquals(Disponibilidad.DESCONECTADO, PresenciaService.calcular(true, AHORA.minusSeconds(61), AHORA, MARGEN));
    }

    @Test
    void cerroSesionEstaDesconectadoAunqueElLatidoSeaReciente() {
        assertEquals(Disponibilidad.DESCONECTADO, PresenciaService.calcular(false, AHORA.minusSeconds(5), AHORA, MARGEN));
    }

    @Test
    void nuncaHaEntradoEstaDesconectado() {
        assertEquals(Disponibilidad.DESCONECTADO, PresenciaService.calcular(null, null, AHORA, MARGEN));
    }
}
