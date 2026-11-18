package com.miaa.lecturas.dtos;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

/**
 * Las coordenadas que acompañan al latido (POST /usuarios/heartbeat). Si traen un campo "fecha"
 * (apps viejas), se ignora: cuenta la hora en que llegó al servidor.
 */
public record UbicacionRequestDTO(
        @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitud,
        @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitud,
        @PositiveOrZero Double precision) {
}
