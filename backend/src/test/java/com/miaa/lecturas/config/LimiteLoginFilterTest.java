package com.miaa.lecturas.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Tarea 1.5: el rate limit se aplica SOLO al POST del login (con y sin /api/v1). */
class LimiteLoginFilterTest {

    @Test
    void aplicaAlPostDelLogin() {
        assertTrue(LimiteLoginFilter.esLogin("POST", "/api/v1/auth/login", ""));
        assertTrue(LimiteLoginFilter.esLogin("POST", "/auth/login", ""));
        assertTrue(LimiteLoginFilter.esLogin("post", "/api/v1/auth/login/", ""));
        assertTrue(LimiteLoginFilter.esLogin("POST", "/miaa/api/v1/auth/login", "/miaa"));
    }

    @Test
    void noAplicaAOtrosMetodosNiRutas() {
        assertFalse(LimiteLoginFilter.esLogin("GET", "/api/v1/auth/login", ""));
        assertFalse(LimiteLoginFilter.esLogin("OPTIONS", "/api/v1/auth/login", ""));
        assertFalse(LimiteLoginFilter.esLogin("POST", "/api/v1/auth/logout", ""));
        assertFalse(LimiteLoginFilter.esLogin("POST", "/api/v1/reportes", ""));
        assertFalse(LimiteLoginFilter.esLogin("POST", null, ""));
    }
}
