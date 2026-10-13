package com.miaa.lecturas.dtos;

import com.miaa.lecturas.entities.OrigenFechaFoto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

/**
 * Una foto que manda el front.
 *
 * @param datos        "data:image/jpeg;base64,..." (la resolución la mide el servidor)
 * @param fechaCaptura cuándo se TOMÓ, en ISO-8601: "2026-10-09T20:02:15Z"
 * @param origenFecha  de dónde sacó el front esa hora (EXIF, ARCHIVO o SUBIDA)
 */
public record FotoRequestDTO(
        @NotBlank(message = "La foto viene vacía")
        String datos,

        @NotNull(message = "Falta la hora de captura de la foto")
        Instant fechaCaptura,

        @NotNull(message = "Falta el origen de la hora de la foto")
        OrigenFechaFoto origenFecha) {
}
