package com.miaa.lecturas.dtos;

import com.miaa.lecturas.entities.EstadoConexion;

import java.time.Instant;

/**
 * Lo que ve el ADMIN de cada empleado en el mapa (GET /cuadrillas) y en su ficha.
 *
 * @param estadoConexion       ACTIVO con la sesión iniciada y un latido reciente; si no, INACTIVO
 * @param enLinea              lo mismo que estadoConexion == ACTIVO (lo usa la ficha del empleado)
 * @param tieneUbicacion       false si nunca ha compartido su ubicación
 * @param ultimaConexion       último latido (UTC): el front lo muestra en hora de Aguascalientes
 * @param fechaRecibida        cuándo llegó la última ubicación (null si nunca)
 * @param segundosDesdeUltima  cuánto hace que llegó la última ubicación (null si nunca)
 * @param segundosParaEnLinea  sin latido en este tiempo = INACTIVO
 */
public record UbicacionEmpleadoDTO(
        Long empleadoId,
        String nombre,
        String username,
        String rol,
        EstadoConexion estadoConexion,
        boolean enLinea,
        boolean tieneUbicacion,
        Double latitud,
        Double longitud,
        Double precisionMetros,
        String direccionGeocodificada,
        Instant ultimaConexion,
        Instant fechaRecibida,
        Long segundosDesdeUltima,
        long segundosParaEnLinea) {
}
