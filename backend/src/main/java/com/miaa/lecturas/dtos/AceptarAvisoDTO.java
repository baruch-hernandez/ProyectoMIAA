package com.miaa.lecturas.dtos;

import jakarta.validation.constraints.NotBlank;

public record AceptarAvisoDTO(@NotBlank String version) {
}
