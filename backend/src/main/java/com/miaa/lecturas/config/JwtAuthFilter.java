package com.miaa.lecturas.config;

import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.repositories.UsuarioRepository;
import com.miaa.lecturas.services.CuentaService;
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
import java.util.Optional;


public class JwtAuthFilter extends OncePerRequestFilter {

    private static final String PREFIJO = "Bearer ";

    private final JwtUtils jwtUtils;
    private final UsuarioRepository usuarioRepository;
    private final CuentaService cuentaService;

    public JwtAuthFilter(JwtUtils jwtUtils, UsuarioRepository usuarioRepository, CuentaService cuentaService) {
        this.jwtUtils = jwtUtils;
        this.usuarioRepository = usuarioRepository;
        this.cuentaService = cuentaService;
    }

    @Override
    protected void doFilterInternal(@SuppressWarnings("null") HttpServletRequest request,
            @SuppressWarnings("null") HttpServletResponse response,
            @SuppressWarnings("null") FilterChain chain) throws ServletException, IOException {

        String header = request.getHeader(HttpHeaders.AUTHORIZATION);

        if (header != null && header.startsWith(PREFIJO)) {
            String token = header.substring(PREFIJO.length());
            UsuarioPrincipal usuario;

            try {
                usuario = jwtUtils.validarToken(token);
            } catch (JwtException | IllegalArgumentException e) {

                SecurityContextHolder.clearContext();
                RespuestaJson.error(response, HttpServletResponse.SC_UNAUTHORIZED,
                        "Token inválido o expirado.", "TOKEN_INVALIDO");
                return;
            }

            @SuppressWarnings("null")
            Optional<Usuario> cuenta = usuarioRepository.findById(usuario.id());
            if (cuenta.isEmpty() || !cuenta.get().estaHabilitado()) {
                SecurityContextHolder.clearContext();
                RespuestaJson.error(response, HttpServletResponse.SC_UNAUTHORIZED,
                        "Tu cuenta fue dada de baja. Habla con tu administrador.", "CUENTA_DESHABILITADA");
                return;
            }
            
            UsuarioPrincipal yo = new UsuarioPrincipal(usuario.id(), usuario.username(), usuario.nombre(),
                    cuenta.get().getRol());

            String nombreRol = yo.rol() != null ? yo.rol().toString() : "Empleado";
            var permisos = List.of(new SimpleGrantedAuthority("ROLE_" + nombreRol));

            SecurityContextHolder.getContext()
                    .setAuthentication(new UsernamePasswordAuthenticationToken(yo, null, permisos));

            if (cuentaService.tieneRequisitosPendientes(cuenta.get()) && !rutaDeCuenta(request)) {
                RespuestaJson.error(response, HttpServletResponse.SC_FORBIDDEN,
                        "Antes de continuar cambia tu contraseña temporal o acepta el aviso de privacidad.",
                        "REQUISITO_PENDIENTE");
                return;
            }
        }

        chain.doFilter(request, response);
    }

    static boolean rutaDeCuenta(HttpServletRequest request) {
        String ruta = request.getRequestURI().substring(request.getContextPath().length());
        if (ruta.startsWith("/api/v1")) {
            ruta = ruta.substring("/api/v1".length());
        }
        return ruta.equals("/usuarios/yo") || ruta.startsWith("/usuarios/yo/") || ruta.equals("/auth/logout");
    }
}