package com.miaa.lecturas.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record NotaRequestDTO(
        @NotBlank(message = "La nota no puede ir vacía")
        @Size(max = 1000, message = "Máximo 1000 caracteres")
        String texto) {
}
