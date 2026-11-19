package com.miaa.lecturas.entities;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "usuarios")
@Data
@NoArgsConstructor
// Sin @AllArgsConstructor: nadie lo usa (siempre new Usuario() + setters) y con él la extensión
// de Java de VS Code marca el error falso "Flexible Constructor Bodies" (bug de Lombok + JDT).
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nombre;

    private String username;

    private String email;

    // WRITE_ONLY: Jackson puede leerlo de un JSON que llega, pero NUNCA lo escribe en las respuestas
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @ToString.Exclude
    private String password;

    /**
     * Clave del rol: ADMIN o NOTIFICADOR. Es llave foránea a la tabla "roles" (ver
     * Rol y DataInitializer).
     */
    @Column(name = "rol", length = 30)
    private String rol;

    /**
     * Último inicio de sesión. Junto con el último reporte dice si el empleado está
     * activo.
     */
    @Column(name = "ultimo_acceso")
    private java.time.LocalDateTime ultimoAcceso;

    // Boolean y no boolean: las filas que ya existían quedan en NULL al agregar la columna

    /**
     * null o true = puede entrar. false = dado de baja (NO se borra: sus reportes
     * se conservan).
     */
    @Column(name = "habilitado")
    private Boolean habilitado;

    /**
     * true = entró con una contraseña temporal y debe cambiarla antes de usar la
     * app.
     */
    @Column(name = "debe_cambiar_password")
    private Boolean debeCambiarPassword;

    /** Versión del aviso de privacidad que aceptó (null = nunca). */
    @Column(name = "aviso_privacidad_version", length = 30)
    private String avisoPrivacidadVersion;

    @Column(name = "aviso_privacidad_fecha")
    private java.time.LocalDateTime avisoPrivacidadFecha;

    @Column(name = "fecha_alta")
    private java.time.LocalDateTime fechaAlta;

    /**
     * Contraseñas incorrectas seguidas desde el último acceso correcto (null = 0).
     */
    @Column(name = "intentos_fallidos")
    private Integer intentosFallidos;

    /**
     * Hasta cuándo está bloqueada por intentos fallidos (null o fecha pasada = no
     * está bloqueada).
     */
    @Column(name = "bloqueado_hasta")
    private java.time.LocalDateTime bloqueadoHasta;

    // Estos dos NO son getters (no empiezan con get/is): Jackson y JPA los ignoran.
    public boolean estaHabilitado() {
        return !Boolean.FALSE.equals(habilitado);
    }

    public boolean tieneQueCambiarPassword() {
        return Boolean.TRUE.equals(debeCambiarPassword);
    }

}
