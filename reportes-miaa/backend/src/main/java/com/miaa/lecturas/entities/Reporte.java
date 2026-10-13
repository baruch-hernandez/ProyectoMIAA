package com.miaa.lecturas.entities;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Un reporte que sube un lecturista sobre un domicilio.
 *
 * Por indicación de MIAA, un reporte es solo: el DOMICILIO, la DESCRIPCIÓN, las FOTOS
 * y las NOTAS. No tiene categoría, prioridad, estado ni persona asignada.
 *
 * Tablas nuevas ("reportes", "fotos_reporte", "notas_reporte") en vez de reusar "quejas":
 * las columnas viejas (categoria, estado...) son NOT NULL y ddl-auto=update no las borra,
 * así que cualquier INSERT nuevo fallaría.
 *
 * @Getter/@Setter y NO @Data: @Data genera equals/hashCode/toString con las relaciones
 * (fotos → reporte → fotos → ...) y provoca ciclos infinitos.
 */
@Entity
@Table(name = "reportes", indexes = {
        @Index(name = "idx_reportes_creado_por", columnList = "creado_por_id"),
        @Index(name = "idx_reportes_fecha", columnList = "fecha_creacion")
})
@Getter
@Setter
@NoArgsConstructor
public class Reporte {

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

    // ---------- El reporte ----------
    @Column(nullable = false, columnDefinition = "TEXT")
    private String descripcion;

    // ---------- Relaciones ----------
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "creado_por_id", nullable = false)
    private Usuario creadoPor;

    // orphanRemoval: si quitas una foto de esta lista, JPA hace el DELETE solo.
    @OneToMany(mappedBy = "reporte", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("fechaCaptura ASC, id ASC")
    private List<FotoReporte> fotos = new ArrayList<>();

    @OneToMany(mappedBy = "reporte", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("fechaCreacion ASC")
    private List<NotaReporte> notas = new ArrayList<>();

    // ---------- Fechas del reporte (las pone el servidor) ----------
    // Ojo: la hora que importa de cada FOTO es la de captura (FotoReporte.fechaCaptura).
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

    /** Mantiene las DOS puntas de la relación sincronizadas. */
    public void agregarFoto(FotoReporte foto) {
        foto.setReporte(this);
        fotos.add(foto);
    }

    /** Folio legible, p. ej. R-2026-000042 */
    public String getFolio() {
        if (id == null) {
            return null;
        }
        int anio = fechaCreacion != null ? fechaCreacion.getYear() : LocalDateTime.now().getYear();
        return "R-%d-%06d".formatted(anio, id);
    }

    /** Domicilio en una sola línea, para listas. */
    public String getDomicilioCompleto() {
        String interior = (numeroInterior == null || numeroInterior.isBlank()) ? "" : " Int. " + numeroInterior;
        return "%s #%s%s, %s, C.P. %s, %s".formatted(calle, numeroExterior, interior, colonia, codigoPostal, municipio);
    }
}
