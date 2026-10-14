package com.miaa.lecturas.dtos;

import java.time.LocalDateTime;

/** Datos de la cuenta de un lecturista, como los ve el ADMIN en su ficha. */
public record CuentaEmpleadoDTO(
        Long id,
        String nombre,
        String username,
        String email,
        boolean habilitado,
        boolean debeCambiarPassword,
        LocalDateTime fechaAlta,
        LocalDateTime ultimoAcceso,
        LocalDateTime avisoPrivacidadFecha,
        /** Bloqueada por intentos fallidos hasta esta hora (null = no está bloqueada). */
        LocalDateTime bloqueadoHasta) {
}
