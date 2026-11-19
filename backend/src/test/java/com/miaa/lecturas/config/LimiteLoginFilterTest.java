package com.miaa.lecturas.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** El rate limit se aplica SOLO al POST del login (la API vive en /api: el context-path). */
class LimiteLoginFilterTest {

    @Test
    void aplicaAlPostDelLogin() {
        assertTrue(LimiteLoginFilter.esLogin("POST", "/api/auth/login", "/api"));
        assertTrue(LimiteLoginFilter.esLogin("post", "/api/auth/login/", "/api"));
    }

    @Test
    void noAplicaAOtrosMetodosNiRutas() {
        assertFalse(LimiteLoginFilter.esLogin("GET", "/api/auth/login", "/api"));
        assertFalse(LimiteLoginFilter.esLogin("OPTIONS", "/api/auth/login", "/api"));
        assertFalse(LimiteLoginFilter.esLogin("POST", "/api/auth/logout", "/api"));
        assertFalse(LimiteLoginFilter.esLogin("POST", "/api/reportes", "/api"));
        assertFalse(LimiteLoginFilter.esLogin("POST", null, "/api"));
    }
}
