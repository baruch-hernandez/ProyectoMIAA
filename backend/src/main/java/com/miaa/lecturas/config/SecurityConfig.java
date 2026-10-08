package com.miaa.lecturas.config;

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
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity // permite usar @PreAuthorize("hasRole('ADMIN')") en los controladores
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, JwtUtils jwtUtils) throws Exception {
        http
                // API con JWT: no hay cookies de sesión, así que CSRF no aplica.
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                // Cada petición trae su token; el servidor no guarda sesiones.
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll() // preflight de CORS
                        .requestMatchers("/auth/**", "/api/v1/auth/**", "/api/auth/**").permitAll()
                        // Sin esto, cualquier error interno se "disfraza" de 401.
                        .requestMatchers("/error").permitAll()
                        // Todo lo demás (rutas, lecturas, informes y quejas) es solo para los
                        // roles que existen. Un usuario con otro rol (o uno viejo) no puede hacer nada.
                        // Qué queja puede ver cada quien lo decide QuejaService.
                        .anyRequest().hasAnyRole("ADMIN", "LECTURISTA"))
                // Respuestas JSON (en vez de vacías) para que el front pueda mostrar el motivo.
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) ->
                                escribirError(res, 401, "Tu sesión no es válida o expiró. Inicia sesión de nuevo."))
                        .accessDeniedHandler((req, res, ex) ->
                                escribirError(res, 403, "No tienes permiso para esta acción.")))
                // Nuestro filtro corre antes que el de usuario/contraseña de Spring.
                .addFilterBefore(new JwtAuthFilter(jwtUtils), UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of("http://localhost:5173", "http://localhost:3000"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        configuration.setAllowCredentials(true);

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
