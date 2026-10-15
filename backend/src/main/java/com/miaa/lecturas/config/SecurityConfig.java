package com.miaa.lecturas.config;

import com.miaa.lecturas.entities.Rol;
import com.miaa.lecturas.repositories.UsuarioRepository;
import com.miaa.lecturas.services.CuentaService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity // permite usar @PreAuthorize("hasRole('ADMIN')") en los controladores
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /** Rate limit del login: máximo N intentos por IP cada X segundos (application.properties). */
    @Bean
    public LimitadorPorVentana limitadorLogin(@Value("${miaa.login.max-por-ip:10}") int maximo,
                                              @Value("${miaa.login.ventana-segundos:60}") long ventanaSegundos) {
        return new LimitadorPorVentana(maximo, ventanaSegundos * 1000);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, JwtUtils jwtUtils,
                                           UsuarioRepository usuarioRepository,
                                           CuentaService cuentaService,
                                           LimitadorPorVentana limitadorLogin) throws Exception {
        http
                // API con JWT: no hay cookies de sesión, así que CSRF no aplica.
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                // Cada petición trae su token; el servidor no guarda sesiones.
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // HSTS: solo en producción (ver hstsActivo)
                .headers(h -> h.httpStrictTransportSecurity(hsts -> {
                    if (hstsActivo) {
                        hsts.includeSubDomains(true).maxAgeInSeconds(31_536_000); // 1 año
                    } else {
                        hsts.disable();
                    }
                }))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll() // preflight de CORS
                        .requestMatchers("/auth/**", "/api/v1/auth/**", "/api/auth/**").permitAll()
                        // Sin esto, cualquier error interno se "disfraza" de 401.
                        .requestMatchers("/error").permitAll()
                        // Todo lo demás es solo para los roles que existen.
                        // Qué ROL entra a cada endpoint: @PreAuthorize en los controladores.
                        .anyRequest().hasAnyRole(Rol.ADMIN, Rol.NOTIFICADOR))
                // Respuestas JSON (en vez de vacías) para que el front pueda mostrar el motivo.
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) ->
                                escribirError(res, 401, "Tu sesión no es válida o expiró. Inicia sesión de nuevo."))
                        .accessDeniedHandler((req, res, ex) ->
                                escribirError(res, 403, "No tienes permiso para esta acción.")))
                // Nuestros filtros corren antes que el de usuario/contraseña de Spring, en este orden:
                // 1) rate limit del login, 2) validación del JWT.
                .addFilterBefore(new LimiteLoginFilter(limitadorLogin), UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(new JwtAuthFilter(jwtUtils, usuarioRepository, cuentaService),
                        UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * HSTS (Strict-Transport-Security): le dice al navegador "durante 1 año, a este dominio
     * entra SOLO por HTTPS". Spring la manda por defecto en toda respuesta HTTPS.
     *
     * Apagado en desarrollo: HSTS es por HOST, no por puerto. Si https://localhost:8500 la manda,
     * Chrome fuerza HTTPS en TODOS los puertos de localhost (http://localhost:5173 deja de abrir).
     * Se enciende en el servidor real: miaa.seguridad.hsts=true.
     */
    @Value("${miaa.seguridad.hsts:false}")
    private boolean hstsActivo;

    /**
     * Orígenes del front que pueden llamar a la API (miaa.cors.origenes, separados por coma).
     * Se leen del .properties: así cada quien agrega su IP SIN tocar el código.
     */
    @Value("${miaa.cors.origenes:http://localhost:5173,http://localhost:3000}")
    private String[] origenesPermitidos;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        // "Patrones" en vez de orígenes exactos: una dirección exacta sigue funcionando igual,
        // y además se aceptan comodines para la red local, p. ej. https://192.168.*.*:5173
        // (útil cuando la IP de la PC cambia con el DHCP). Nunca pongan solo "*" en producción.
        configuration.setAllowedOriginPatterns(Arrays.stream(origenesPermitidos)
                .map(String::trim)
                .filter(o -> !o.isEmpty())
                .toList());

        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setExposedHeaders(List.of("Retry-After")); // que el front pueda leer la espera del 429
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L); // el navegador guarda la respuesta del preflight 1 hora

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    private static void escribirError(HttpServletResponse res, int status, String mensaje) throws IOException {
        res.setStatus(status);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.setCharacterEncoding("UTF-8");
        // Mismo formato que GlobalExceptionHandler: { status, message }
        res.getWriter().write("{\"status\":" + status + ",\"message\":\"" + mensaje + "\"}");
    }
}
