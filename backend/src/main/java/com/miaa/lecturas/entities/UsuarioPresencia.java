package com.miaa.lecturas.entities;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.DynamicUpdate;

import java.time.Instant;

/**
 * Presencia y ÚLTIMA ubicación de cada empleado (una fila por empleado, se sobrescribe).
 *
 * A propósito NO se guarda historial de recorridos: la ubicación es un dato personal (LFPDPPP)
 * y para "ver dónde está ahorita" basta con la última.
 *
 * DynamicUpdate: el latido (cada segundo) y la geocodificación escriben columnas distintas de la
 * misma fila; así uno no pisa con un valor viejo lo que acaba de guardar el otro.
 */
@Entity
@Table(name = "usuario_presencia")
@DynamicUpdate
@Getter
@Setter
@NoArgsConstructor
public class UsuarioPresencia {

    @Id
    @Column(name = "usuario_id")
    private Long usuarioId;

    /** null si nunca ha compartido su ubicación. */
    @Column(name = "ultima_latitud")
    private Double ultimaLatitud;

    @Column(name = "ultima_longitud")
    private Double ultimaLongitud;

    /** Radio de error en metros que reporta el celular (±). */
    @Column(name = "precision_metros")
    private Double precisionMetros;

    /** Cuándo llegó al servidor esa ubicación (no la hora del celular, que puede estar mal). */
    @Column(name = "fecha_ubicacion_utc")
    private Instant fechaUbicacionUtc;

    /** La pone GeocodificadorInverso unos segundos después, solo si se movió lo suficiente. */
    @Column(name = "direccion_geocodificada", length = 300)
    private String direccionGeocodificada;

    /** Último latido (o inicio de sesión) recibido. */
    @Column(name = "ultima_conexion_utc", nullable = false)
    private Instant ultimaConexionUtc;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_conexion", nullable = false, length = 10)
    private EstadoConexion estadoConexion;
}
