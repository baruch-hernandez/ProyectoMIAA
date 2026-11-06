package com.miaa.lecturas.dtos;

import com.miaa.lecturas.entities.OrigenFechaFoto;
import com.miaa.lecturas.entities.OrigenFoto;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.time.Instant;

/**
 * Una foto que manda el front.
 *
 * @param datos          "data:image/jpeg;base64,..." (la resolución la mide el servidor)
 * @param fechaCaptura   cuándo se TOMÓ, en ISO-8601: "2026-10-09T20:02:15Z"
 * @param origenFecha    de dónde sacó el front esa hora (OBTURADOR, EXIF, ARCHIVO o SUBIDA)
 * @param origenFoto     con qué se agregó en la app (CAMARA o GALERIA). La web no lo manda
 * @param latitud        Historia 3: dónde se tomó (solo la cámara de la app; la web y la galería no lo mandan)
 * @param longitud       (las tres coordenadas van juntas o ninguna: lo revisa ReporteService)
 * @param precisionGps   radio de error del GPS en metros
 * @param desfaseRelojMs servidor − celular al tomarla, en ms (null = la hora no se verificó con el servidor)
 */
public record FotoRequestDTO(
        @NotBlank(message = "La foto viene vacía")
        String datos,

        @NotNull(message = "Falta la hora de captura de la foto")
        Instant fechaCaptura,

        @NotNull(message = "Falta el origen de la hora de la foto")
        OrigenFechaFoto origenFecha,

        OrigenFoto origenFoto,

        // Filtro rápido con un rectángulo; el contorno real lo revisa LimiteAguascalientes
        @DecimalMin(value = "21.5", message = "La foto se tomó fuera de Aguascalientes")
        @DecimalMax(value = "22.6", message = "La foto se tomó fuera de Aguascalientes")
        Double latitud,

        @DecimalMin(value = "-103.0", message = "La foto se tomó fuera de Aguascalientes")
        @DecimalMax(value = "-101.7", message = "La foto se tomó fuera de Aguascalientes")
        Double longitud,

        // Mismo tope que la app (ReglasGps.precisionMaxima): más de ±20 m ya puede ser otra casa
        @Positive(message = "La precisión del GPS no es válida")
        @DecimalMax(value = "20", message = "La precisión del GPS es muy baja (máximo ±20 m)")
        Double precisionGps,

        Long desfaseRelojMs) {
}
