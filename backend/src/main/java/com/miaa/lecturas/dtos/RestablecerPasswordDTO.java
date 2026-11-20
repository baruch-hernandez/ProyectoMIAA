package com.miaa.lecturas.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** POST /auth/password/restablecer — el código que llegó por correo y la contraseña nueva. */
public record RestablecerPasswordDTO(
        @NotBlank(message = "Escribe tu usuario o correo") @Size(max = 150) String usuario,
        @NotBlank(message = "Escribe el código que te llegó por correo") @Size(max = 10) String codigo,
        @NotBlank(message = "Escribe la nueva contraseña") String nueva) {
}
