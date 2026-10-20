package com.miaa.lecturas.services;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** Reglas de contraseña (las mismas que muestra el front). */
class PoliticaPasswordTest {

    @Test
    void aceptaUnaContrasenaValida() {
        assertNull(PoliticaPassword.problema("miaa2026"));
        assertDoesNotThrow(() -> PoliticaPassword.validar("Notificador1"));
    }

    @Test
    void rechazaContrasenasDebiles() {
        assertNotNull(PoliticaPassword.problema(null));
        assertNotNull(PoliticaPassword.problema("ab1"), "muy corta");
        assertNotNull(PoliticaPassword.problema("solamenteletras"), "sin números");
        assertNotNull(PoliticaPassword.problema("12345678"), "sin letras");
        assertNotNull(PoliticaPassword.problema("a1".repeat(40)), "más de 72 caracteres");
        assertThrows(ResponseStatusException.class, () -> PoliticaPassword.validar("123"));
    }
}
