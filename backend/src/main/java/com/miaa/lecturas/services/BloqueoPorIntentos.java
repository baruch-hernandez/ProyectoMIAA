package com.miaa.lecturas.services;

import com.miaa.lecturas.entities.Usuario;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;

/**
 * Bloqueo temporal de la cuenta tras N contraseñas incorrectas SEGUIDAS (RNF-04).
 *
 * - Cada contraseña incorrecta suma 1 a usuarios.intentos_fallidos.
 * - Al llegar al máximo, la cuenta queda bloqueada X minutos (usuarios.bloqueado_hasta)
 *   y el contador vuelve a 0. Mientras dure, ni la contraseña correcta deja entrar.
 * - Un acceso correcto reinicia el contador.
 * - El bloqueo se quita solo al pasar el tiempo, o antes si el ADMIN lo desbloquea
 *   o le restablece la contraseña.
 *
 * Solo cambia el objeto Usuario; quien lo llama se encarga de guardarlo.
 */
@Component
public class BloqueoPorIntentos {

    /** Resultado de un intento fallido. bloqueadoHasta == null: todavía no se bloquea. */
    public record Fallo(LocalDateTime bloqueadoHasta, int intentosRestantes) {
        public boolean bloqueo() {
            return bloqueadoHasta != null;
        }
    }

    private final int intentosMaximos;
    private final Duration duracionBloqueo;

    public BloqueoPorIntentos(@Value("${miaa.login.intentos-maximos}") int intentosMaximos,
                              @Value("${miaa.login.minutos-bloqueo}") long minutosBloqueo) {
        if (intentosMaximos < 1 || minutosBloqueo < 1) {
            throw new IllegalArgumentException("miaa.login.intentos-maximos y miaa.login.minutos-bloqueo deben ser mayores a 0");
        }
        this.intentosMaximos = intentosMaximos;
        this.duracionBloqueo = Duration.ofMinutes(minutosBloqueo);
    }

    /** Si la cuenta está bloqueada en este momento, hasta cuándo; si no, null. */
    public LocalDateTime bloqueadaHasta(Usuario u, LocalDateTime ahora) {
        LocalDateTime hasta = u.getBloqueadoHasta();
        return (hasta != null && hasta.isAfter(ahora)) ? hasta : null;
    }

    public Fallo registrarFallo(Usuario u, LocalDateTime ahora) {
        if (u.getBloqueadoHasta() != null && !u.getBloqueadoHasta().isAfter(ahora)) {
            u.setBloqueadoHasta(null); // un bloqueo que ya venció no cuenta
        }
        int fallidos = (u.getIntentosFallidos() == null ? 0 : u.getIntentosFallidos()) + 1;
        if (fallidos >= intentosMaximos) {
            u.setIntentosFallidos(0);
            u.setBloqueadoHasta(ahora.plus(duracionBloqueo));
            return new Fallo(u.getBloqueadoHasta(), 0);
        }
        u.setIntentosFallidos(fallidos);
        return new Fallo(null, intentosMaximos - fallidos);
    }

    public void registrarExito(Usuario u) {
        desbloquear(u);
    }

    public static void desbloquear(Usuario u) {
        u.setIntentosFallidos(0);
        u.setBloqueadoHasta(null);
    }

    /** Minutos que faltan, redondeando hacia arriba (para el mensaje: "en 3 minutos"). */
    public static long minutosRestantes(LocalDateTime hasta, LocalDateTime ahora) {
        long segundos = Math.max(0, Duration.between(ahora, hasta).getSeconds());
        return Math.max(1, (segundos + 59) / 60);
    }

    public static long segundosRestantes(LocalDateTime hasta, LocalDateTime ahora) {
        return Math.max(1, Duration.between(ahora, hasta).getSeconds());
    }
}
