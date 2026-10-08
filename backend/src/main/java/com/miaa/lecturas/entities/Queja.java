package com.miaa.lecturas.entities;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Una queja registrada por un lecturista sobre un domicilio.
 *
 * Usamos @Getter/@Setter y NO @Data a propósito: @Data genera equals/hashCode/toString
 * con TODOS los campos, incluidas las relaciones (notas → queja → notas → ...),
 * lo que provoca ciclos infinitos y consultas inesperadas a la BD.
 *
 * El domicilio va "embebido" en la queja para mantenerlo simple. Si después necesitan
 * el historial de quejas de una misma casa, conviene una tabla `domicilios`
 * (o usar el número de contrato como llave).
 */
@Entity
@Table(name = "quejas", indexes = {
        @Index(name = "idx_quejas_creado_por", columnList = "creado_por_id"),
        @Index(name = "idx_quejas_estado", columnList = "estado")
})
@Getter
@Setter
@NoArgsConstructor
public class Queja {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ---------- Domicilio ----------
    @Column(nullable = false, length = 150)
    private String calle;

    @Column(name = "numero_exterior", nullable = false, length = 20)
    private String numeroExterior;

    @Column(name = "numero_interior", length = 20)
    private String numeroInterior;

    @Column(nullable = false, length = 100)
    private String colonia;

    @Column(name = "codigo_postal", nullable = false, length = 5)
    private String codigoPostal;

    @Column(nullable = false, length = 60)
    private String municipio;

    @Column(length = 255)
    private String referencias;

    /** Número de contrato/cuenta MIAA del domicilio (opcional). */
    @Column(name = "numero_contrato", length = 30)
    private String numeroContrato;

    private Double latitud;
    private Double longitud;

    // ---------- La queja ----------
    @Enumerated(EnumType.STRING) // guarda "FUGA_AGUA", no un número: si reordenas el enum no se rompe
    @Column(nullable = false, length = 30)
    private CategoriaQueja categoria;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String descripcion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private PrioridadQueja prioridad = PrioridadQueja.MEDIA;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EstadoQueja estado = EstadoQueja.PENDIENTE;

    // ---------- Relaciones ----------
    // LAZY: el usuario no se carga de la BD hasta que se necesita.
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "creado_por_id", nullable = false)
    private Usuario creadoPor;

    /** Trabajador que atenderá la queja (lo asigna el jefe en la siguiente parte). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "asignado_a_id")
    private Usuario asignadoA;

    @OneToMany(mappedBy = "queja", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("fechaCreacion ASC")
    private List<NotaQueja> notas = new ArrayList<>();

    /**
     * Fotos de evidencia en base64 (ya comprimidas en el front a ≤200 KB).
     * Sirve para empezar; a futuro conviene guardar archivos y aquí solo la URL.
     */
    @ElementCollection
    @CollectionTable(name = "fotos_queja", joinColumns = @JoinColumn(name = "queja_id"))
    @Column(name = "foto_base64", columnDefinition = "TEXT")
    private List<String> fotos = new ArrayList<>();

    // ---------- Fechas (las pone el servidor, nunca el cliente) ----------
    @Column(name = "fecha_creacion", nullable = false, updatable = false)
    private LocalDateTime fechaCreacion;

    @Column(name = "fecha_actualizacion", nullable = false)
    private LocalDateTime fechaActualizacion;

    @PrePersist
    void alCrear() {
        fechaCreacion = LocalDateTime.now();
        fechaActualizacion = fechaCreacion;
    }

    @PreUpdate
    void alActualizar() {
        fechaActualizacion = LocalDateTime.now();
    }

    /** Folio legible para el usuario, p. ej. Q-2026-000042 */
    public String getFolio() {
        if (id == null) {
            return null; // todavía no se guarda en la BD
        }
        int anio = fechaCreacion != null ? fechaCreacion.getYear() : LocalDateTime.now().getYear();
        return "Q-%d-%06d".formatted(anio, id);
    }

    /** Domicilio en una sola línea, para listas. */
    public String getDomicilioCompleto() {
        String interior = (numeroInterior == null || numeroInterior.isBlank()) ? "" : " Int. " + numeroInterior;
        return "%s #%s%s, %s, C.P. %s, %s".formatted(calle, numeroExterior, interior, colonia, codigoPostal, municipio);
    }
}
