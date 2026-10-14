package com.miaa.lecturas.dtos;

import jakarta.validation.constraints.NotBlank;

/** POST /usuarios/yo/aviso-privacidad — la versión que la persona leyó y aceptó. */
public record AceptarAvisoDTO(@NotBlank String version) {
}
