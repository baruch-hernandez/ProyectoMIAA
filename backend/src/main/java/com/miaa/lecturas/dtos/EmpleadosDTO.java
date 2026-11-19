package com.miaa.lecturas.dtos;

import java.util.List;

/**
 * Respuesta de GET /empleados.
 */
public record EmpleadosDTO(List<EmpleadoDTO> empleados) {
}
