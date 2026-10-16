package com.miaa.lecturas.entities;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "roles")
@Getter
@Setter
@NoArgsConstructor
public class Rol {

    /** Administrador (jefe): consulta reportes y administra empleados. */
    public static final String ADMIN = "ADMIN";
    /** Empleado de campo (notificador): sube reportes de domicilios. Antes se llamaba LECTURISTA. */
    public static final String NOTIFICADOR = "NOTIFICADOR";

    @Id
    @Column(length = 30)
    private String clave;

    /** Nombre para mostrar en pantalla. */
    @Column(nullable = false, length = 60)
    private String nombre;

    @Column(length = 255)
    private String descripcion;

    public Rol(String clave, String nombre, String descripcion) {
        this.clave = clave;
        this.nombre = nombre;
        this.descripcion = descripcion;
    }
}
