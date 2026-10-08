package com.miaa.lecturas.entities;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Bitácora de una queja: comentarios del lecturista, del jefe o de quien la atienda.
 * Tabla "notas_queja" para no chocar con nada existente.
 */
@Entity
@Table(name = "notas_queja", indexes = @Index(name = "idx_notas_queja", columnList = "queja_id"))
@Getter
@Setter
@NoArgsConstructor
public class NotaQueja {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "queja_id", nullable = false)
    private Queja queja;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "autor_id", nullable = false)
    private Usuario autor;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String texto;

    @Column(name = "fecha_creacion", nullable = false, updatable = false)
    private LocalDateTime fechaCreacion;

    public NotaQueja(Queja queja, Usuario autor, String texto) {
        this.queja = queja;
        this.autor = autor;
        this.texto = texto;
    }

    @PrePersist
    void alCrear() {
        fechaCreacion = LocalDateTime.now();
    }
}
