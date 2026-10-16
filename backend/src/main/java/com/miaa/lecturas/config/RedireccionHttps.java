package com.miaa.lecturas.config;

import org.apache.catalina.connector.Connector;
import org.apache.tomcat.util.descriptor.web.SecurityCollection;
import org.apache.tomcat.util.descriptor.web.SecurityConstraint;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;



@Configuration
@Profile("https")
public class RedireccionHttps {

    @Bean
    public WebServerFactoryCustomizer<TomcatServletWebServerFactory> redireccionHttpAHttps(
            @Value("${miaa.https.puerto-redireccion:8080}") int puertoHttp,
            @Value("${server.port:8500}") int puertoHttps) {

        return fabrica -> {
            if (puertoHttp <= 0) {
                return; // redirección apagada: solo existe el puerto HTTPS
            }

            // 1. Todas las rutas exigen canal cifrado (CONFIDENTIAL = HTTPS)
            fabrica.addContextCustomizers(contexto -> {
                SecurityConstraint restriccion = new SecurityConstraint();
                restriccion.setUserConstraint("CONFIDENTIAL");
                SecurityCollection rutas = new SecurityCollection();
                rutas.addPattern("/*");
                restriccion.addCollection(rutas);
                contexto.addConstraint(restriccion);
            });

            // 2. Puerto extra en HTTP que no atiende nada: solo redirige al de HTTPS
            Connector http = new Connector(TomcatServletWebServerFactory.DEFAULT_PROTOCOL);
            http.setScheme("http");
            http.setPort(puertoHttp);
            http.setSecure(false);
            http.setRedirectPort(puertoHttps);
            fabrica.addAdditionalTomcatConnectors(http);
        };
    }
}
