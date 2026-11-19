package com.miaa.lecturas.dtos;

import jakarta.validation.constraints.NotBlank;

public record PasswordTemporalDTO(@NotBlank(message = "Escribe una contraseña temporal") String passwordTemporal) {
}
