package com.miaa.lecturas.dtos;

import java.time.Instant;
import java.time.LocalDateTime;

import com.miaa.lecturas.entities.Disponibilidad;

/**
 * Cómo ve el ADMIN a cada empleado (notificador).
 *
 * @param ultimaActividad lo más reciente entre su último inicio de sesión y su último reporte
 * @param activo          true con la sesión iniciada y latidos llegando (miaa.presencia.segundos-en-linea)
 * @param diasSinActividad días desde la última actividad (null si nunca ha entrado)
 * @param enLinea         true si además está compartiendo su ubicación (ver PresenciaService)
 * @param habilitado      false si el admin lo dio de baja (ya no puede entrar)
 * @param disponibilidad  EN_LINEA si está activo; si no, DESCONECTADO (lo mismo que activo, como enum)
 * @param ultimaConexion  último latido o inicio de sesión (UTC)
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
        Instant ultimaConexion,
        String rol) {

}
