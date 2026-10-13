package com.miaa.lecturas.services;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Iterator;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Revisa que una foto sea una imagen real y de BUENA RESOLUCIÓN (mínimo HD, 1280×720).
 *
 * ¿Por qué aquí si el front ya la revisa? Porque al backend se le puede mandar
 * cualquier cosa con Postman. La regla de oro: el backend nunca confía en el cliente.
 * Por eso la resolución la MIDE el servidor leyendo la imagen, no la que diga el JSON.
 */
@Component
public class ValidadorFotos {

    /** HD: el lado largo ≥ 1280 y el corto ≥ 720 (sirve igual para foto vertical u horizontal). */
    public static final int LADO_LARGO_MIN = 1280;
    public static final int LADO_CORTO_MIN = 720;

    /** El front las deja en ~0.3–1.2 MB. En base64 pesan 4/3 más; damos margen. */
    private static final int MAX_CARACTERES = 2_500_000; // ≈ 1.8 MB de imagen

    /** Solo JPEG o PNG (las que Java sabe leer sin librerías extra). */
    private static final Pattern DATA_URL = Pattern.compile("^data:image/(jpeg|jpg|png);base64,(.+)$", Pattern.DOTALL);

    /** Medidas reales de la imagen. */
    public record Medidas(int ancho, int alto) {
    }

    public Medidas validar(String dataUrl) {
        if (dataUrl == null || dataUrl.length() > MAX_CARACTERES) {
            throw error("Una foto pesa demasiado (máximo ~1.8 MB). Vuelve a tomarla.");
        }
        Matcher m = DATA_URL.matcher(dataUrl);
        if (!m.matches()) {
            throw error("Una de las fotos no es una imagen JPG o PNG válida.");
        }

        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(m.group(2));
        } catch (IllegalArgumentException e) {
            throw error("Una de las fotos está dañada (base64 inválido).");
        }

        Medidas medidas = leerMedidas(bytes);
        int largo = Math.max(medidas.ancho(), medidas.alto());
        int corto = Math.min(medidas.ancho(), medidas.alto());
        if (largo < LADO_LARGO_MIN || corto < LADO_CORTO_MIN) {
            throw error("La foto tiene baja resolución (%d×%d). Se necesita mínimo %d×%d: tómala con la cámara del celular."
                    .formatted(medidas.ancho(), medidas.alto(), LADO_LARGO_MIN, LADO_CORTO_MIN));
        }
        return medidas;
    }

    /**
     * La hora de captura no puede ser del futuro (con 10 min de tolerancia por relojes
     * desfasados) ni absurda. No exigimos que sea "de hoy": a veces suben fotos de ayer.
     */
    public void validarFechaCaptura(Instant fechaCaptura) {
        Instant ahora = Instant.now();
        if (fechaCaptura.isAfter(ahora.plus(10, ChronoUnit.MINUTES))) {
            throw error("La hora de captura de una foto está en el futuro. Revisa la fecha y hora del celular.");
        }
        if (fechaCaptura.isBefore(Instant.parse("2000-01-01T00:00:00Z"))) {
            throw error("La hora de captura de una foto no es válida. Revisa la fecha y hora del celular.");
        }
    }

    /**
     * Lee SOLO el encabezado de la imagen para saber ancho y alto (no la decodifica
     * completa: es más rápido y gasta menos memoria). Si Java no la puede leer, no es imagen.
     */
    private static Medidas leerMedidas(byte[] bytes) {
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            if (in == null) {
                throw error("Una de las fotos no se pudo leer.");
            }
            Iterator<ImageReader> lectores = ImageIO.getImageReaders(in);
            if (!lectores.hasNext()) {
                throw error("Una de las fotos no es una imagen válida.");
            }
            ImageReader lector = lectores.next();
            try {
                lector.setInput(in);
                return new Medidas(lector.getWidth(0), lector.getHeight(0));
            } finally {
                lector.dispose();
            }
        } catch (IOException e) {
            throw error("Una de las fotos no se pudo leer.");
        }
    }

    private static ResponseStatusException error(String mensaje) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, mensaje);
    }
}
