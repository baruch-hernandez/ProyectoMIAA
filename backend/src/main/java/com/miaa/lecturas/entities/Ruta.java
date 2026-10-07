package com.miaa.lecturas.entities;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;

@Entity
@Table(name = "rutas")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Ruta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "codigo_sector")
    private String codigoSector;

    private String colonia;

    private String estado; // PENDIENTE, EN_PROCESO, COMPLETADA

    @Column(columnDefinition = "TEXT")
    private String puntos; // Almacena el JSON de coordenadas del mapa

    @Column(name = "fecha_asignacion")
    private LocalDate fechaAsignacion;

    // Relación con el Lecturista (Usuario)
    @ManyToOne
    @JoinColumn(name = "lecturista_id")
    private Usuario lecturista;
}