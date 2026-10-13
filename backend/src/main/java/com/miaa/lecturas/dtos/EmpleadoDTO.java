package com.miaa.lecturas.dtos;

import java.time.LocalDateTime;

/**
 * Cómo ve el ADMIN a cada empleado (lecturista).
 *
 * @param ultimaActividad lo más reciente entre su último inicio de sesión y su último reporte
 * @param activo          true si tuvo actividad en los últimos N días (miaa.empleados.dias-inactivo)
 * @param diasSinActividad días desde la última actividad (null si nunca ha entrado)
 * @param enLinea         true si ahorita está compartiendo su ubicación (app abierta y con red)
 */
public record EmpleadoDTO(
        Long id,
        String nombre,
        String username,
        LocalDateTime ultimoAcceso,
        LocalDateTime ultimoReporte,
        long totalReportes,
        LocalDateTime ultimaActividad,
        boolean activo,
        Long diasSinActividad,
        boolean enLinea) {
}
