package com.miaa.lecturas.services;

import com.fasterxml.jackson.databind.JsonNode;
import com.miaa.lecturas.repositories.UsuarioPresenciaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.StringJoiner;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Sprint 5 (tarea 1.3): la dirección de cada empleado a partir de sus coordenadas, con Nominatim
 * (OpenStreetMap), el mismo servicio que ya usa la web al llenar un reporte.
 *
 * Nominatim permite como máximo 1 consulta por segundo y nada de uso masivo, así que:
 *  - solo se pide la dirección si el empleado se movió más de {@value #METROS_PARA_ACTUALIZAR} m
 *    desde la última que se le resolvió;
 *  - el latido no espera: deja el punto en "pendientes" y esta clase los atiende cada 1.1 s, con
 *    UNA consulta a Nominatim por vuelta como máximo (de cada quien, solo su punto más nuevo);
 *  - las direcciones ya resueltas se guardan en caché por punto (~11 m) y no gastan consulta.
 *
 * Se apaga con miaa.geocodificacion.habilitada=false (perfil de pruebas): la dirección queda null.
 */
@Component
public class GeocodificadorInverso {

    private static final Logger log = LoggerFactory.getLogger(GeocodificadorInverso.class);

    static final double METROS_PARA_ACTUALIZAR = 50;
    private static final int MAX_CACHE = 5_000;

    private final UsuarioPresenciaRepository presencias;
    /** null = apagado. */
    private final RestClient http;

    /** Último punto (lat, lng) de cada empleado que espera su dirección. */
    private final Map<Long, double[]> pendientes = new ConcurrentHashMap<>();
    // shortcut: en memoria de este backend (hay uno solo); si se reinicia, se vuelve a pedir la dirección una vez a cada quien
    private final Map<Long, double[]> yaResuelto = new ConcurrentHashMap<>();
    private final Map<String, String> cache = Collections.synchronizedMap(new LinkedHashMap<>(256, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, String> mayor) {
            return size() > MAX_CACHE;
        }
    });

    @Autowired
    public GeocodificadorInverso(UsuarioPresenciaRepository presencias, RestClient.Builder builder,
                                 @Value("${miaa.geocodificacion.habilitada:true}") boolean habilitada,
                                 @Value("${miaa.geocodificacion.url:https://nominatim.openstreetmap.org/reverse}") String url) {
        this(presencias, habilitada ? builder.requestFactory(conTiempos()) : null, url);
    }

    /** [builder] null = apagado. Las pruebas pasan uno ligado a un servidor falso. */
    GeocodificadorInverso(UsuarioPresenciaRepository presencias, RestClient.Builder builder, String url) {
        this.presencias = presencias;
        // Nominatim pide identificar la aplicación en el User-Agent (sin datos personales)
        this.http = builder == null ? null : builder.baseUrl(url).defaultHeader("User-Agent", "MIAA-Lecturas/1.0").build();
    }

    /** Que un Nominatim lento no deje colgado el hilo de tareas programadas. */
    private static SimpleClientHttpRequestFactory conTiempos() {
        SimpleClientHttpRequestFactory f = new SimpleClientHttpRequestFactory();
        f.setConnectTimeout(3_000);
        f.setReadTimeout(5_000);
        return f;
    }

    /** Lo llama cada latido con coordenadas: solo lo anota si se movió lo suficiente. No espera red. */
    public void solicitar(Long usuarioId, double lat, double lng) {
        if (http == null) return;
        double[] antes = yaResuelto.get(usuarioId);
        if (antes != null && distanciaMetros(antes[0], antes[1], lat, lng) < METROS_PARA_ACTUALIZAR) return;
        pendientes.put(usuarioId, new double[] { lat, lng }); // si ya tenía uno, se queda el más nuevo
    }

    @Scheduled(fixedDelay = 1_100)
    public void atenderPendientes() {
        if (http == null) return;
        boolean yaConsulto = false;
        for (Map.Entry<Long, double[]> e : pendientes.entrySet()) {
            double[] punto = e.getValue();
            String llave = llave(punto[0], punto[1]);
            String direccion = cache.get(llave);
            if (direccion == null) {
                if (yaConsulto) continue; // a la siguiente vuelta: 1 consulta por segundo
                yaConsulto = true;
                direccion = consultar(punto[0], punto[1]);
                if (direccion == null) { // sin red o Nominatim caído: se reintenta con el siguiente latido
                    pendientes.remove(e.getKey(), punto);
                    continue;
                }
                cache.put(llave, direccion);
            }
            pendientes.remove(e.getKey(), punto); // si llegó otro punto mientras, ese se queda
            presencias.guardarDireccion(e.getKey(), direccion.isEmpty() ? null : direccion);
            yaResuelto.put(e.getKey(), punto);
        }
    }

    /** La dirección del punto; "" si ahí no hay calles (un baldío, el campo); null si falló la consulta. */
    private String consultar(double lat, double lng) {
        try {
            JsonNode r = http.get()
                    .uri(b -> b.queryParam("format", "jsonv2").queryParam("lat", lat).queryParam("lon", lng)
                            .queryParam("zoom", 18).queryParam("addressdetails", 1)
                            .queryParam("accept-language", "es").build())
                    .retrieve()
                    .body(JsonNode.class);
            return r == null ? "" : formatear(r);
        } catch (RestClientException ex) {
            log.warn("Geocodificación inversa falló: {}", ex.getMessage());
            return null;
        }
    }

    // ---------------------------------------------------------------- lógica pura (se prueba sin red)

    /** "Av. Madero 120, Zona Centro, Aguascalientes" con los campos de Nominatim (como direccionGps.ts). */
    static String formatear(JsonNode respuesta) {
        JsonNode a = respuesta.path("address");
        String calle = primero(a, "road", "pedestrian", "footway", "path");
        String numero = primero(a, "house_number");
        StringJoiner partes = new StringJoiner(", ");
        if (calle != null) partes.add(numero == null ? calle : calle + " " + numero);
        String colonia = primero(a, "neighbourhood", "suburb", "quarter", "residential", "city_district", "hamlet");
        if (colonia != null) partes.add(colonia);
        String municipio = primero(a, "city", "town", "village", "municipality", "county");
        if (municipio != null) partes.add(municipio);
        String texto = partes.length() > 0 ? partes.toString() : respuesta.path("display_name").asText("");
        return texto.length() > 300 ? texto.substring(0, 300) : texto;
    }

    private static String primero(JsonNode a, String... campos) {
        for (String c : campos) {
            String v = a.path(c).asText("").trim();
            if (!v.isEmpty()) return v;
        }
        return null;
    }

    /** ~11 m: dos latidos desde la misma casa usan la misma dirección. */
    static String llave(double lat, double lng) {
        return String.format(java.util.Locale.ROOT, "%.4f,%.4f", lat, lng);
    }

    /** Haversine, en metros. */
    static double distanciaMetros(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double h = Math.pow(Math.sin(dLat / 2), 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.pow(Math.sin(dLng / 2), 2);
        return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
    }
}
