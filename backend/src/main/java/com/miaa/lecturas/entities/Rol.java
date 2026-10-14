package com.miaa.lecturas.entities;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Catálogo de roles (tabla "roles").
 *
 * usuarios.rol guarda la CLAVE del rol ("ADMIN", "LECTURISTA") y es llave foránea a roles.clave.
 * Se eligió una clave de texto (y no un id numérico) para no tocar los usuarios que ya existen
 * ni los @PreAuthorize("hasRole('ADMIN')"): el valor de la columna no cambia.
 *
 * DataInitializer llena este catálogo al arrancar y crea la llave foránea si falta.
 */
@Entity
@Table(name = "roles")
@Getter
@Setter
@NoArgsConstructor
public class Rol {

    /** Administrador (jefe): consulta reportes y administra empleados. */
    public static final String ADMIN = "ADMIN";
    /** Empleado de campo (lecturista / notificador): sube reportes. */
    public static final String LECTURISTA = "LECTURISTA";

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
