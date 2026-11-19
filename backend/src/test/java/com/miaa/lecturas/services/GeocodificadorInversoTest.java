package com.miaa.lecturas.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.miaa.lecturas.repositories.UsuarioPresenciaRepository;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.ExpectedCount;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.hamcrest.Matchers.startsWith;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/** Dirección por coordenadas sin pasarse del límite de Nominatim. */
class GeocodificadorInversoTest {

    private static final String RESPUESTA = """
            {"display_name": "120, Avenida Madero, Zona Centro, Aguascalientes, 20000, México",
             "address": {"house_number": "120", "road": "Avenida Madero", "neighbourhood": "Zona Centro",
                         "city": "Aguascalientes", "postcode": "20000"}}
            """;

    @Test
    void armaLaDireccionConCalleNumeroColoniaYMunicipio() throws Exception {
        assertEquals("Avenida Madero 120, Zona Centro, Aguascalientes",
                GeocodificadorInverso.formatear(new ObjectMapper().readTree(RESPUESTA)));
        assertEquals("", GeocodificadorInverso.formatear(new ObjectMapper().readTree("{\"error\":\"Unable to geocode\"}")),
                "sin calles: vacía");
    }

    @Test
    void midiendoDistancias() {
        // 0.001° de latitud ≈ 111 m
        double d = GeocodificadorInverso.distanciaMetros(21.880, -102.290, 21.881, -102.290);
        assertTrue(d > 105 && d < 117, "salió " + d);
    }

    @Test
    @SuppressWarnings("null") // los Matcher de Hamcrest no traen anotaciones de null
    void unaSolaConsultaPorVueltaYNoRepiteSiNoSeMovio() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer nominatim = MockRestServiceServer.bindTo(builder).build();
        UsuarioPresenciaRepository repo = mock(UsuarioPresenciaRepository.class);
        GeocodificadorInverso geo = new GeocodificadorInverso(repo, builder, "https://nominatim.test/reverse");
        // Más de 2 consultas en total hace fallar la prueba
        nominatim.expect(ExpectedCount.twice(), requestTo(startsWith("https://nominatim.test/reverse")))
                .andRespond(withSuccess(RESPUESTA, MediaType.APPLICATION_JSON));

        geo.solicitar(1L, 21.8800, -102.2900);
        geo.solicitar(2L, 21.9500, -102.3500);
        geo.atenderPendientes();
        verify(repo, times(1)).guardarDireccion(anyLong(), anyString()); // 1 por vuelta: el otro espera
        geo.atenderPendientes();
        verify(repo, times(2)).guardarDireccion(anyLong(), anyString());

        // Se movieron ~10 m: la dirección sigue siendo la misma, no se vuelve a pedir
        geo.solicitar(1L, 21.8801, -102.2900);
        geo.solicitar(2L, 21.9501, -102.3500);
        geo.atenderPendientes();

        nominatim.verify();
        verify(repo, times(2)).guardarDireccion(anyLong(), anyString());
        verify(repo).guardarDireccion(1L, "Avenida Madero 120, Zona Centro, Aguascalientes");
    }
}
