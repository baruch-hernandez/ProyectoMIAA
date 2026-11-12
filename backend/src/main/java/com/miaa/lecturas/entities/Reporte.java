package com.miaa.lecturas.entities;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;


@Entity
@Table(name = "reportes", indexes = {
        @Index(name = "idx_reportes_creado_por", columnList = "creado_por_id"),
        @Index(name = "idx_reportes_fecha", columnList = "fecha_creacion"),
        // UNIQUE: el mismo reporte reenviado (sin conexión, reintentos) nunca crea otra fila
        @Index(name = "idx_reportes_client_sync_id", columnList = "client_sync_id", unique = true)
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

    // ---------- Predio ----------
    /**
     * HABITACIONAL, COMERCIAL... (ver ReporteRequestDTO). String y no enum para que Hibernate no cree
     * un CHECK que luego no se actualiza (ver EsquemaFotos). Null solo en reportes de antes del campo.
     */
    @Column(name = "tipo_predio", length = 20)
    private String tipoPredio;

    /** Clave catastral del predio (opcional). */
    @Column(name = "clave_catastral", length = 30)
    private String claveCatastral;

    private Double latitud;
    private Double longitud;

    /**
     * Id que generó el celular (UUID): evita duplicados al reenviar un reporte guardado sin conexión.
     * Antes se llamaba cliente_id: EsquemaReportes pasa los datos viejos a esta columna.
     */
    @Column(name = "client_sync_id", length = 36)
    private String clienteId;

    /** Cuándo lo llenó el notificador (UTC). Puede ser horas antes de llegar si se guardó sin conexión. */
    @Column(name = "fecha_captura")
    private Instant fechaCaptura;

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

    /** Cuándo el notificador corrigió domicilio o descripción (null = nunca). El admin lo ve como "Editado". */
    @Column(name = "fecha_edicion")
    private LocalDateTime fechaEdicion;

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
