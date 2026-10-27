package com.miaa.lecturas.dtos;

import java.time.LocalDateTime;

import com.miaa.lecturas.entities.Disponibilidad;

/**
 * Cómo ve el ADMIN a cada empleado (notificador).
 *
 * @param ultimaActividad lo más reciente entre su último inicio de sesión y su último reporte
 * @param activo          true si tuvo actividad en los últimos N días (miaa.empleados.dias-inactivo)
 * @param diasSinActividad días desde la última actividad (null si nunca ha entrado)
 * @param enLinea         true si ahorita está compartiendo su ubicación (app abierta y con red)
 * @param habilitado      false si el admin lo dio de baja (ya no puede entrar)
 * @param disponibilidad
 * @param ultimaConexion
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
        boolean enLinea,
        boolean habilitado,
        Disponibilidad disponibilidad,
        LocalDateTime ultimaConexion,
        /** ADMIN o NOTIFICADOR. */
        String rol) {

}
