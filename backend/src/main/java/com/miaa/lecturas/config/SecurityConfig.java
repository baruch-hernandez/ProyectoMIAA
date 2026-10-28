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
@EnableMethodSecurity
public class SecurityConfig {

    @Value("${miaa.seguridad.hsts:false}")
    private boolean hstsActivo;

    @Value("${miaa.cors.origenes:http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173}")
    private String[] origenesPermitidos;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

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
                // Tarea 2.3: Integración explícita del filtro de CORS en primer orden
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                .headers(h -> h.httpStrictTransportSecurity(hsts -> {
                    if (hstsActivo) {
                        hsts.includeSubDomains(true).maxAgeInSeconds(31_536_000);
                    } else {
                        hsts.disable();
                    }
                }))

                .authorizeHttpRequests(auth -> auth
                        // Garantiza el paso de CORS preflight (OPTIONS)
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/auth/**", "/api/v1/auth/**", "/api/auth/**").permitAll()
                        .requestMatchers("/error").permitAll()
                        .anyRequest().hasAnyRole("ADMIN", "NOTIFICADOR"))

                .exceptionHandling(e -> e
                        .authenticationEntryPoint(
                                (req, res, ex) -> escribirError(res, HttpServletResponse.SC_UNAUTHORIZED,
                                        "Token inválido o expirado."))
                        .accessDeniedHandler((req, res, ex) -> escribirError(res, HttpServletResponse.SC_FORBIDDEN,
                                "No tienes permisos para realizar esta acción.")))

                .addFilterBefore(new LimiteLoginFilter(limitadorLogin), UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(new JwtAuthFilter(jwtUtils, usuarioRepository, cuentaService),
                        UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @SuppressWarnings("null")
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        
        configuration.setAllowedOriginPatterns(Arrays.stream(origenesPermitidos)
                .map(String::trim)
                .filter(o -> !o.isEmpty())
                .toList());

        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setExposedHeaders(List.of("Retry-After", "Authorization"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    private static void escribirError(HttpServletResponse res, int status, String mensaje) throws IOException {
        res.setStatus(status);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.setCharacterEncoding("UTF-8");
        res.getWriter().write("{\"status\":" + status + ",\"message\":\"" + mensaje + "\"}");
    }
}