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
 * usuarios.rol guarda la CLAVE del rol ("ADMIN", "NOTIFICADOR") y es llave foránea a roles.clave.
 * Se eligió una clave de texto (y no un id numérico) para que se lea igual en la base, en el
 * JWT y en los @PreAuthorize("hasRole('ADMIN')").
 *
 * CatalogoRoles llena este catálogo al arrancar, crea la llave foránea si falta y pasa a
 * NOTIFICADOR a los usuarios que tenían la clave vieja LECTURISTA.
 */
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
