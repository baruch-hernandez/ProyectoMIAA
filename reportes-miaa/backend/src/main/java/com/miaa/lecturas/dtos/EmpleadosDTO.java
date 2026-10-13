package com.miaa.lecturas.dtos;

import java.util.List;

/**
 * Respuesta de GET /usuarios/empleados.
 *
 * @param diasInactivo los días sin actividad para considerar a alguien INACTIVO
 *                     (viene de application.properties; el front lo muestra para explicar la regla)
 */
public record EmpleadosDTO(int diasInactivo, List<EmpleadoDTO> empleados) {
}
