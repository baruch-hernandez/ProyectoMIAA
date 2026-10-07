package com.miaa.lecturas.entities;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "lecturas")
public class Lectura {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Acepta "numeroMedidor" o "numContrato" desde el JSON del frontend
    @Column(name = "num_contrato")
    @JsonProperty("numMedidor")
    private String numeroMedidor;

    @Column(name = "lectura_anterior")
    private Double lecturaAnterior;

    @Column(name = "lectura_actual")
    private Double lecturaActual;

    private Double consumo;

    // Guarda en la columna 'fecha_captura' de PostgreSQL
    @Column(name = "fecha_captura")
    @JsonProperty("fechaRegistro")
    private LocalDateTime fechaRegistro;

    // Guarda en la columna 'foto_evidencia_url' de PostgreSQL
    @Column(name = "foto_evidencia_url")
    @JsonProperty("fotoUrl")
    private String fotoUrl;

    private String direccion;
    private String observaciones;

    @ManyToOne
    @JoinColumn(name = "ruta_id")
    private Ruta ruta;

    @ManyToOne
    @JoinColumn(name = "usuario_id")
    private Usuario usuario;

    @PrePersist
    public void prePersist() {
        if (this.fechaRegistro == null) {
            this.fechaRegistro = LocalDateTime.now();
        }
    }

    public Lectura() {
    }

    // Getters y Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getNumeroMedidor() {
        return numeroMedidor;
    }

    public void setNumeroMedidor(String numeroMedidor) {
        this.numeroMedidor = numeroMedidor;
    }

    public Double getLecturaAnterior() {
        return lecturaAnterior;
    }

    public void setLecturaAnterior(Double lecturaAnterior) {
        this.lecturaAnterior = lecturaAnterior;
    }

    public Double getLecturaActual() {
        return lecturaActual;
    }

    public void setLecturaActual(Double lecturaActual) {
        this.lecturaActual = lecturaActual;
    }

    public Double getConsumo() {
        return consumo;
    }

    public void setConsumo(Double consumo) {
        this.consumo = consumo;
    }

    public LocalDateTime getFechaRegistro() {
        return fechaRegistro;
    }

    public void setFechaRegistro(LocalDateTime fechaRegistro) {
        this.fechaRegistro = fechaRegistro;
    }

    public String getFotoUrl() {
        return fotoUrl;
    }

    public void setFotoUrl(String fotoUrl) {
        this.fotoUrl = fotoUrl;
    }

    public String getDireccion() {
        return direccion;
    }

    public void setDireccion(String direccion) {
        this.direccion = direccion;
    }

    public String getObservaciones() {
        return observaciones;
    }

    public void setObservaciones(String observaciones) {
        this.observaciones = observaciones;
    }

    public Ruta getRuta() {
        return ruta;
    }

    public void setRuta(Ruta ruta) {
        this.ruta = ruta;
    }

    public Usuario getUsuario() {
        return usuario;
    }

    public void setUsuario(Usuario usuario) {
        this.usuario = usuario;
    }
}