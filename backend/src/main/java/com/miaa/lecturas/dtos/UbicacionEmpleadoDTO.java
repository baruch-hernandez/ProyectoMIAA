package com.miaa.lecturas.dtos;

import java.time.Instant;

/**
 * Lo que ve el ADMIN en el mapa en vivo.
 *
 * @param enLinea           true si el servidor recibió su ubicación hace poco (y no cerró sesión)
 * @param tieneUbicacion    false si el empleado nunca ha compartido su ubicación
 * @param segundosDesdeUltima cuánto hace que llegó la última (null si nunca)
 */
public record UbicacionEmpleadoDTO(
        Long empleadoId,
        String nombre,
        String username,
        boolean tieneUbicacion,
        boolean enLinea,
        Double latitud,
        Double longitud,
        Double precisionMetros,
        Instant fechaDispositivo,
        Instant fechaRecibida,
        Long segundosDesdeUltima,
        int segundosParaEnLinea) {
}
