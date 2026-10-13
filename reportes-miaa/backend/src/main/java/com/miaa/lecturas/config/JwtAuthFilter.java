package com.miaa.lecturas.config;

import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Se ejecuta en CADA petición, antes de llegar a los controladores:
 *   1. Busca el header  Authorization: Bearer <token>
 *   2. Si el token es válido, "loguea" al usuario solo para esta petición.
 *   3. Si no hay token o es inválido, sigue sin usuario: Spring Security
 *      responde 401 en las rutas protegidas.
 *
 * NO lleva @Component a propósito: se crea en SecurityConfig. Si fuera @Component,
 * Spring Boot lo registraría además como filtro normal del servidor (doble registro).
 */
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final String PREFIJO = "Bearer ";

    private final JwtUtils jwtUtils;

    public JwtAuthFilter(JwtUtils jwtUtils) {
        this.jwtUtils = jwtUtils;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        String header = request.getHeader(HttpHeaders.AUTHORIZATION);

        if (header != null && header.startsWith(PREFIJO)) {
            try {
                UsuarioPrincipal usuario = jwtUtils.validarToken(header.substring(PREFIJO.length()));

                // "ROLE_" es la convención de Spring para que funcione hasRole('ADMIN')
                var permisos = List.of(new SimpleGrantedAuthority("ROLE_" + usuario.rol()));
                var autenticacion = new UsernamePasswordAuthenticationToken(usuario, null, permisos);
                SecurityContextHolder.getContext().setAuthentication(autenticacion);

            } catch (JwtException | IllegalArgumentException e) {
                // Token vencido, alterado o viejo (como el "token-miaa-session-1" de antes).
                SecurityContextHolder.clearContext();
            }
        }

        chain.doFilter(request, response);
    }
}
