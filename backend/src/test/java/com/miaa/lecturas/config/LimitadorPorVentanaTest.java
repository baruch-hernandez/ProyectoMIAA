package com.miaa.lecturas.config;

import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tarea 1.5 (rate limit del login). Se prueba con un reloj FALSO: así no hay que esperar
 * 60 segundos reales para ver que la ventana se reinicia.
 */
class LimitadorPorVentanaTest {

    private final AtomicLong ahora = new AtomicLong(1_000_000);
    private final LimitadorPorVentana limitador = new LimitadorPorVentana(3, 60_000, ahora::get);

    @Test
    void permiteHastaElMaximoDentroDeLaVentana() {
        assertEquals(0, limitador.intentar("1.1.1.1"));
        assertEquals(0, limitador.intentar("1.1.1.1"));
        assertEquals(0, limitador.intentar("1.1.1.1"));
    }

    @Test
    void elSiguienteIntentoSeBloqueaYDiceCuantoEsperar() {
        for (int i = 0; i < 3; i++) {
            limitador.intentar("1.1.1.1");
        }
        ahora.addAndGet(10_000); // pasaron 10 s de los 60
        assertEquals(50, limitador.intentar("1.1.1.1"));
    }

    @Test
    void cadaIpTieneSuPropioContador() {
        for (int i = 0; i < 4; i++) {
            limitador.intentar("1.1.1.1");
        }
        assertEquals(0, limitador.intentar("2.2.2.2"), "otra IP no debe pagar los intentos de la primera");
    }

    @Test
    void alTerminarLaVentanaSeReinicia() {
        for (int i = 0; i < 4; i++) {
            limitador.intentar("1.1.1.1");
        }
        ahora.addAndGet(60_000);
        assertEquals(0, limitador.intentar("1.1.1.1"));
    }

    @Test
    void laEsperaNuncaEsCeroSegundosMientrasEstaBloqueado() {
        for (int i = 0; i < 3; i++) {
            limitador.intentar("1.1.1.1");
        }
        ahora.addAndGet(59_999); // falta 1 ms
        assertTrue(limitador.intentar("1.1.1.1") >= 1);
    }

    @Test
    void rechazaConfiguracionesInvalidas() {
        assertThrows(IllegalArgumentException.class, () -> new LimitadorPorVentana(0, 60_000));
        assertThrows(IllegalArgumentException.class, () -> new LimitadorPorVentana(10, 0));
    }
}
