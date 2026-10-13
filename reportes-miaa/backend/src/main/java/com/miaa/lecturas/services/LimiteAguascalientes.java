package com.miaa.lecturas.services;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;

/**
 * Contorno del ESTADO de Aguascalientes para validar coordenadas.
 *
 * Lee resources/geo/aguascalientes.json (INEGI 2020 vía geoBoundaries.org, CC BY 3.0 IGO).
 * El front usa el mismo contorno (utils/limiteAgs.ts), así ambos dan la misma respuesta.
 *
 * ¿Por qué validar aquí si el front ya lo hace? Porque cualquiera puede llamar a la API
 * con Postman o curl y saltarse el front. La regla de oro: el backend nunca confía.
 */
@Component
public class LimiteAguascalientes {

    private final double[] lats;
    private final double[] lngs;
    private final double sur, norte, oeste, este;

    public LimiteAguascalientes(ObjectMapper mapper) {
        try (InputStream in = new ClassPathResource("geo/aguascalientes.json").getInputStream()) {
            JsonNode contorno = mapper.readTree(in).get("contorno");
            int n = contorno.size();
            lats = new double[n];
            lngs = new double[n];
            double s = 90, no = -90, o = 180, e = -180;
            for (int i = 0; i < n; i++) {
                lats[i] = contorno.get(i).get(0).asDouble();
                lngs[i] = contorno.get(i).get(1).asDouble();
                s = Math.min(s, lats[i]);
                no = Math.max(no, lats[i]);
                o = Math.min(o, lngs[i]);
                e = Math.max(e, lngs[i]);
            }
            sur = s; norte = no; oeste = o; este = e;
        } catch (IOException ex) {
            // Si falta el archivo, mejor que la app no arranque a que acepte cualquier punto
            throw new UncheckedIOException("No se pudo leer geo/aguascalientes.json", ex);
        }
    }

    /**
     * Ray casting: se traza una línea desde el punto y se cuentan los cruces con el
     * contorno. Impar = adentro. Mismo algoritmo que dentroDeAguascalientes() del front.
     */
    public boolean contiene(double lat, double lng) {
        if (lat < sur || lat > norte || lng < oeste || lng > este) return false; // filtro rápido

        boolean dentro = false;
        for (int i = 0, j = lats.length - 1; i < lats.length; j = i++) {
            boolean cruza = (lats[i] > lat) != (lats[j] > lat)
                    && lng < (lngs[j] - lngs[i]) * (lat - lats[i]) / (lats[j] - lats[i]) + lngs[i];
            if (cruza) dentro = !dentro;
        }
        return dentro;
    }
}
