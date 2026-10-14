package com.miaa.lecturas.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Rate limit del login (RNF / tarea 1.5): limita los POST a /auth/login por IP.
 * Al pasarse responde 429 con { status, message, codigo: "DEMASIADOS_INTENTOS", segundos }
 * y la cabecera Retry-After.
 *
 * Se complementa con BloqueoPorIntentos:
 *  - este filtro frena a UNA computadora que prueba muchas contraseñas (de cualquier usuario);
 *  - el bloqueo protege a UNA cuenta aunque la ataquen desde muchas computadoras.
 *
 * No es @Component a propósito: Spring Boot registraría cualquier Filter como filtro global
 * y correría dos veces. Se crea en SecurityConfig.
 *
 * La IP es request.getRemoteAddr(). Detrás de un proxy (Nginx) activen
 * server.forward-headers-strategy=native para que sea la IP real del cliente y no la del proxy.
 */
public class LimiteLoginFilter extends OncePerRequestFilter {

    private final LimitadorPorVentana limitador;

    public LimiteLoginFilter(LimitadorPorVentana limitador) {
        this.limitador = limitador;
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        return !esLogin(request.getMethod(), request.getRequestURI(), request.getContextPath());
    }

    /** POST a /auth/login, /api/v1/auth/login o /api/auth/login. */
    static boolean esLogin(String metodo, String uri, String contexto) {
        if (!"POST".equalsIgnoreCase(metodo) || uri == null) {
            return false;
        }
        String ruta = (contexto != null && !contexto.isEmpty() && uri.startsWith(contexto))
                ? uri.substring(contexto.length()) : uri;
        if (ruta.endsWith("/")) {
            ruta = ruta.substring(0, ruta.length() - 1);
        }
        return ruta.equals("/auth/login") || ruta.equals("/api/v1/auth/login") || ruta.equals("/api/auth/login");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long espera = limitador.intentar(request.getRemoteAddr());
        if (espera > 0) {
            response.setHeader("Retry-After", String.valueOf(espera));
            RespuestaJson.error(response, 429,
                    "Demasiados intentos de inicio de sesión desde este equipo. Espera " + espera
                            + (espera == 1 ? " segundo" : " segundos") + " y vuelve a intentar.",
                    "DEMASIADOS_INTENTOS", espera);
            return;
        }
        chain.doFilter(request, response);
    }
}
