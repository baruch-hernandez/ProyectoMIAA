package com.miaa.lecturas.config;

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
                .csrf(csrf -> csrf.disable())
                // Habilitar CORS usando el Bean corsConfigurationSource definido abajo
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Permitir todas las peticiones preliminares OPTIONS sin autenticación
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/auth/**", "/api/v1/auth/**", "/api/auth/**").permitAll()
                        .requestMatchers("/error").permitAll()
                        .anyRequest().hasAnyRole("ADMIN", "LECTURISTA"))
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) ->
                                escribirError(res, 401, "Tu sesión no es válida o expiró. Inicia sesión de nuevo."))
                        .accessDeniedHandler((req, res, ex) ->
                                escribirError(res, 403, "No tienes permiso para esta acción.")))
                .addFilterBefore(new LimiteLoginFilter(limitadorLogin), UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(new JwtAuthFilter(jwtUtils, usuarioRepository, cuentaService),
                        UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /** Orígenes del front que pueden llamar a la API (miaa.cors.origenes, separados por coma). */
    @Value("${miaa.cors.origenes:http://localhost:5173,http://localhost:3000}")
    private String[] origenesPermitidos;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        
        // Permitir explícitamente localhost y 127.0.0.1 tanto en HTTP como HTTPS
        configuration.setAllowedOrigins(List.of(
            "https://localhost:5173",
            "http://localhost:5173",
            "https://127.0.0.1:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000"
        ));
        
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*")); // Acepta todas las cabeceras estándar y personalizadas
        configuration.setExposedHeaders(List.of("Authorization", "Content-Type"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L); // Guarda en caché la respuesta preflight por 1 hora

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
