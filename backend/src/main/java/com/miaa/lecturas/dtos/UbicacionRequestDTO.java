package com.miaa.lecturas.dtos;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.time.Instant;

/** Lo que manda el celular del lecturista cada ~20 s mientras tiene la app abierta. */
public record UbicacionRequestDTO(
        @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitud,
        @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitud,
        @PositiveOrZero Double precision,
        /** Cuándo la midió el celular (ISO-8601). Si no viene, se usa la hora del servidor. */
        Instant fecha) {
}
