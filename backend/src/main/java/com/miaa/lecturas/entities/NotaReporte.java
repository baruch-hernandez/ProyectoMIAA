package com.miaa.lecturas.entities;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/** Bitácora de un reporte: comentarios que agrega el notificador después de subirlo. */
@Entity
@Table(name = "notas_reporte", indexes = @Index(name = "idx_notas_reporte", columnList = "reporte_id"))
@Getter
@Setter
@NoArgsConstructor
public class NotaReporte {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reporte_id", nullable = false)
    private Reporte reporte;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "autor_id", nullable = false)
    private Usuario autor;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String texto;

    @Column(name = "fecha_creacion", nullable = false, updatable = false)
    private LocalDateTime fechaCreacion;

    public NotaReporte(Reporte reporte, Usuario autor, String texto) {
        this.reporte = reporte;
        this.autor = autor;
        this.texto = texto;
    }

    @PrePersist
    void alCrear() {
        fechaCreacion = LocalDateTime.now();
    }
}
