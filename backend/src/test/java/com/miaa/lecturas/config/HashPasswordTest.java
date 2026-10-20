package com.miaa.lecturas.config;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Tarea 1.3: las contraseñas se guardan con BCrypt (hash con sal), nunca en texto plano. */
class HashPasswordTest {

    private final PasswordEncoder encoder = new SecurityConfig().passwordEncoder();

    @Test
    void elHashNoEsLaContrasenaYEsBCrypt() {
        String hash = encoder.encode("admin123");
        assertNotEquals("admin123", hash);
        assertTrue(hash.startsWith("$2"), "BCrypt empieza con $2a$ / $2b$");
        assertTrue(hash.length() >= 59);
    }

    @Test
    void verificaLaCorrectaYRechazaLaIncorrecta() {
        String hash = encoder.encode("admin123");
        assertTrue(encoder.matches("admin123", hash));
        assertFalse(encoder.matches("admin124", hash));
    }

    @Test
    void laMismaContrasenaDaHashesDistintos() {
        // Cada hash lleva su propia "sal": dos usuarios con la misma contraseña no se delatan
        assertNotEquals(encoder.encode("admin123"), encoder.encode("admin123"));
    }
}
