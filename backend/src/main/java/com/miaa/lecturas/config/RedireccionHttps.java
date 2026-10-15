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

/**
 * "Forzar HTTPS" (RNF-03) cuando Spring Boot atiende el TLS directamente (perfil "https").
 *
 * Con server.ssl.enabled=true, el puerto principal (8500) YA solo habla HTTPS: si alguien le
 * manda HTTP, Tomcat responde 400 "This combination of host and port requires TLS".
 *
 * Esta clase agrega un SEGUNDO puerto (8080 por defecto) que solo sirve para REDIRIGIR:
 *   http://servidor:8080/lo-que-sea  ──302──►  https://servidor:8500/lo-que-sea
 * Así, quien escriba la dirección con http:// en el navegador termina en la versión segura.
 *
 * Cómo lo hace: una "restricción de seguridad" de Tomcat con CONFIDENTIAL sobre /* le dice
 * "estas rutas exigen un canal cifrado". Si la petición llega por el puerto sin cifrar, Tomcat
 * la manda al redirectPort (el de HTTPS) en lugar de atenderla.
 *
 * Solo existe con el perfil "https" (@Profile). Sin ese perfil, la app sigue en HTTP normal
 * para que el equipo pueda desarrollar sin certificado.
 * Para no abrir el puerto de redirección: miaa.https.puerto-redireccion=0
 */
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
