package com.miaa.lecturas.entities;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * ÚLTIMA ubicación conocida de un empleado (una fila por empleado, se sobrescribe).
 *
 * A propósito NO se guarda historial de recorridos: la ubicación es un dato personal
 * (LFPDPPP) y para "ver dónde está ahorita" basta con la última. Menos datos guardados
 * = menos riesgo si algo se filtra.
 *
 * Se comparte solo mientras el notificador tiene la app abierta y la sesión iniciada.
 */
@Entity
@Table(name = "ubicaciones_empleado")
@Getter
@Setter
@NoArgsConstructor
public class UbicacionEmpleado {

    /** La misma llave que el usuario: un empleado = una fila. */
    @Id
    @Column(name = "usuario_id")
    private Long usuarioId;

    @Column(nullable = false)
    private Double latitud;

    @Column(nullable = false)
    private Double longitud;

    /** Radio de error en metros que reporta el celular (±). */
    @Column(name = "precision_metros")
    private Double precisionMetros;

    /** Cuándo la midió el celular. */
    @Column(name = "fecha_dispositivo", nullable = false)
    private Instant fechaDispositivo;

    /** Cuándo la recibió el servidor. "En línea" se calcula con ESTA (el reloj del celular puede estar mal). */
    @Column(name = "fecha_recibida", nullable = false)
    private Instant fechaRecibida;

    /** false cuando el notificador cierra sesión: deja de aparecer "en línea" al instante. */
    @Column(nullable = false)
    private boolean compartiendo;
}
