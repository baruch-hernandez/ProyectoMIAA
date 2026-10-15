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

/**
 * Se ejecuta en CADA petición, antes de llegar a los controladores:
 *   1. Busca el header  Authorization: Bearer <token>
 *   2. Si el token es válido, revisa en la BD que la cuenta siga habilitada
 *      (si el admin la dio de baja, el token deja de servir AL INSTANTE, no en 24 h).
 *   3. "Loguea" al usuario solo para esta petición.
 *   4. Si tiene requisitos pendientes (contraseña temporal o aviso de privacidad sin
 *      aceptar), solo lo deja usar /usuarios/yo/** hasta que los resuelva.
 *   Sin token o con token inválido, sigue sin usuario: Spring Security responde 401.
 *
 * Costo: una consulta por petición (por id, con llave primaria). Para este tamaño de
 * sistema es despreciable y vale la pena por poder dar de baja al instante.
 *
 * NO lleva @Component a propósito: se crea en SecurityConfig. Si fuera @Component,
 * Spring Boot lo registraría además como filtro normal del servidor (doble registro).
 */
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
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        String header = request.getHeader(HttpHeaders.AUTHORIZATION);

        if (header != null && header.startsWith(PREFIJO)) {
            UsuarioPrincipal usuario;
            try {
                usuario = jwtUtils.validarToken(header.substring(PREFIJO.length()));
            } catch (JwtException | IllegalArgumentException e) {
                // Token vencido, alterado o viejo: seguimos sin usuario → 401 en rutas protegidas
                SecurityContextHolder.clearContext();
                chain.doFilter(request, response);
                return;
            }

            Optional<Usuario> cuenta = usuarioRepository.findById(usuario.id());
            if (cuenta.isEmpty() || !cuenta.get().estaHabilitado()) {
                SecurityContextHolder.clearContext();
                RespuestaJson.error(response, 401,
                        "Tu cuenta fue dada de baja. Habla con tu administrador.", "CUENTA_DESHABILITADA");
                return;
            }

            // El rol se toma de la BASE, no del token: si cambia (como LECTURISTA → NOTIFICADOR),
            // aplica al instante y los tokens que ya estaban emitidos siguen sirviendo.
            UsuarioPrincipal yo = new UsuarioPrincipal(usuario.id(), usuario.username(), usuario.nombre(),
                    cuenta.get().getRol());

            // "ROLE_" es la convención de Spring para que funcione hasRole('ADMIN')
            var permisos = List.of(new SimpleGrantedAuthority("ROLE_" + yo.rol()));
            SecurityContextHolder.getContext()
                    .setAuthentication(new UsernamePasswordAuthenticationToken(yo, null, permisos));

            if (cuentaService.tieneRequisitosPendientes(cuenta.get()) && !rutaDeCuenta(request)) {
                RespuestaJson.error(response, 403,
                        "Antes de continuar cambia tu contraseña temporal o acepta el aviso de privacidad.",
                        "REQUISITO_PENDIENTE");
                return;
            }
        }

        chain.doFilter(request, response);
    }

    /**
     * /usuarios/yo/** (con o sin /api/v1): justo lo que se usa para resolver los requisitos.
     * También /auth/logout: aunque tenga requisitos pendientes, cerrar sesión siempre debe poder.
     */
    static boolean rutaDeCuenta(HttpServletRequest request) {
        String ruta = request.getRequestURI().substring(request.getContextPath().length());
        if (ruta.startsWith("/api/v1")) {
            ruta = ruta.substring("/api/v1".length());
        }
        return ruta.equals("/usuarios/yo") || ruta.startsWith("/usuarios/yo/") || ruta.equals("/auth/logout");
    }
}
