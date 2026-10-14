package com.miaa.lecturas.config;

import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;

/**
 * Rate limit sencillo en memoria: máximo N solicitudes por clave (la IP) en cada ventana de tiempo.
 *
 * Ventana fija: al pasar la ventana, el contador de esa IP vuelve a 0.
 * Suficiente para un solo servidor. Si algún día corren varias instancias del backend,
 * el conteo tendría que vivir en un lugar compartido (p. ej. Redis + Bucket4j).
 */
public class LimitadorPorVentana {

    private record Ventana(long inicioMs, int usadas) {
    }

    /** Cada cuántas claves se limpian las ventanas vencidas (para que la memoria no crezca sin fin). */
    private static final int LIMPIAR_A_PARTIR_DE = 10_000;

    private final int maximo;
    private final long ventanaMs;
    private final LongSupplier reloj;
    private final ConcurrentHashMap<String, Ventana> ventanas = new ConcurrentHashMap<>();

    public LimitadorPorVentana(int maximo, long ventanaMs, LongSupplier reloj) {
        if (maximo < 1 || ventanaMs < 1) {
            throw new IllegalArgumentException("El máximo y la ventana deben ser mayores a 0");
        }
        this.maximo = maximo;
        this.ventanaMs = ventanaMs;
        this.reloj = reloj;
    }

    public LimitadorPorVentana(int maximo, long ventanaMs) {
        this(maximo, ventanaMs, System::currentTimeMillis);
    }

    /**
     * Cuenta una solicitud de esa clave.
     * @return 0 si se permite; si no, los segundos que faltan para que se libere.
     */
    public long intentar(String clave) {
        long ahora = reloj.getAsLong();
        if (ventanas.size() >= LIMPIAR_A_PARTIR_DE) {
            ventanas.values().removeIf(v -> ahora - v.inicioMs() >= ventanaMs);
        }
        Ventana v = ventanas.compute(clave, (k, actual) ->
                (actual == null || ahora - actual.inicioMs() >= ventanaMs)
                        ? new Ventana(ahora, 1)
                        : new Ventana(actual.inicioMs(), actual.usadas() + 1));
        if (v.usadas() <= maximo) {
            return 0;
        }
        long faltanMs = v.inicioMs() + ventanaMs - ahora;
        return Math.max(1, (faltanMs + 999) / 1000);
    }
}
