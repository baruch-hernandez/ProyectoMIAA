package com.miaa.lecturas.dtos;

import jakarta.validation.constraints.NotBlank;

/** POST /usuarios/empleados/{id}/password — el admin restablece la contraseña (temporal). */
public record PasswordTemporalDTO(@NotBlank(message = "Escribe una contraseña temporal") String passwordTemporal) {
}
