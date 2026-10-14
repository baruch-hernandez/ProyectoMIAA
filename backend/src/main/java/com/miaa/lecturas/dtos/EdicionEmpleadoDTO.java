package com.miaa.lecturas.dtos;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** PUT /usuarios/empleados/{id} — corregir los datos de un lecturista. */
public record EdicionEmpleadoDTO(
        @NotBlank(message = "Escribe el nombre")
        @Size(max = 100, message = "Máximo 100 caracteres")
        String nombre,

        @NotBlank(message = "Escribe el usuario")
        @Pattern(regexp = "[A-Za-z0-9._-]{3,30}", message = "De 3 a 30 caracteres: letras, números, punto, guion o guion bajo")
        String username,

        @Email(message = "El correo no es válido")
        @Size(max = 120, message = "Máximo 120 caracteres")
        String email) {
}
