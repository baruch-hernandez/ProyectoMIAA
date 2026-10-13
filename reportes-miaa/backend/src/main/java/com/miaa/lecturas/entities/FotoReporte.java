package com.miaa.lecturas.entities;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Una foto de evidencia de un reporte.
 *
 * Antes las fotos eran una simple lista de textos (@ElementCollection), sin id:
 * no había forma de decir "borra ESTA foto". Ahora cada foto es una fila con su id.
 *
 * Guarda DOS horas, porque MIAA pidió priorizar la de captura:
 *  - fechaCaptura: cuándo se TOMÓ la foto (EXIF de la cámara o fecha del archivo).
 *  - fechaSubida:  cuándo llegó al servidor (solo como referencia).
 *
 * Se usa Instant (un instante exacto, sin zona) para que no haya confusiones de
 * horario: el front lo muestra en la hora local del celular o la PC.
 */
@Entity
@Table(name = "fotos_reporte", indexes = @Index(name = "idx_fotos_reporte", columnList = "reporte_id"))
@Getter
@Setter
@NoArgsConstructor
public class FotoReporte {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reporte_id", nullable = false)
    private Reporte reporte;

    /** La imagen como data URL base64 ("data:image/jpeg;base64,..."). A futuro: archivo + URL. */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String datos;

    /** Resolución real, medida por el servidor (no la que diga el cliente). */
    @Column(nullable = false)
    private Integer ancho;

    @Column(nullable = false)
    private Integer alto;

    @Column(name = "fecha_captura", nullable = false)
    private Instant fechaCaptura;

    /** De dónde salió fechaCaptura: EXIF (la más confiable), ARCHIVO o SUBIDA. */
    @Enumerated(EnumType.STRING)
    @Column(name = "origen_fecha", nullable = false, length = 10)
    private OrigenFechaFoto origenFecha;

    @Column(name = "fecha_subida", nullable = false, updatable = false)
    private Instant fechaSubida;

    @PrePersist
    void alSubir() {
        fechaSubida = Instant.now();
    }
}
