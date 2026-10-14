package com.miaa.lecturas.dtos;

import jakarta.validation.constraints.NotBlank;

/** PUT /usuarios/yo/password — la nueva se revisa con PoliticaPassword. */
public record CambioPasswordDTO(
        @NotBlank(message = "Escribe tu contraseña actual") String actual,
        @NotBlank(message = "Escribe la nueva contraseña") String nueva) {
}
