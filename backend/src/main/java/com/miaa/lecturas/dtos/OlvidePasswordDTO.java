package com.miaa.lecturas.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** POST /auth/password/olvide — usuario o correo de la cuenta. */
public record OlvidePasswordDTO(@NotBlank(message = "Escribe tu usuario o correo") @Size(max = 150) String usuario) {
}
