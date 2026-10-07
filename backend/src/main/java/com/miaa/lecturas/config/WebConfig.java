package com.miaa.lecturas.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    // Dejamos que SecurityConfig maneje completamente las reglas de CORS
    // para evitar conflictos de filtros duplicados y bloqueos de 'preflight'
    // (OPTIONS).

}