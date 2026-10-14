package com.miaa.lecturas.dtos;

public class AuthResponseDTO {

    private String token;
    private Long id;
    private String nombre;
    private String rol;
    /** Entró con contraseña temporal: el front lo manda a cambiarla antes que nada. */
    private boolean debeCambiarPassword;
    /** No ha aceptado la versión vigente del aviso de privacidad. */
    private boolean avisoPrivacidadPendiente;

    // Constructor vacío (necesario para instanciar new AuthResponseDTO())
    public AuthResponseDTO() {
    }

    // Constructor completo
    public AuthResponseDTO(String token, Long id, String nombre, String rol,
                           boolean debeCambiarPassword, boolean avisoPrivacidadPendiente) {
        this.token = token;
        this.id = id;
        this.nombre = nombre;
        this.rol = rol;
        this.debeCambiarPassword = debeCambiarPassword;
        this.avisoPrivacidadPendiente = avisoPrivacidadPendiente;
    }

    // Getters y Setters
    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public String getRol() {
        return rol;
    }

    public void setRol(String rol) {
        this.rol = rol;
    }

    public boolean isDebeCambiarPassword() {
        return debeCambiarPassword;
    }

    public void setDebeCambiarPassword(boolean debeCambiarPassword) {
        this.debeCambiarPassword = debeCambiarPassword;
    }

    public boolean isAvisoPrivacidadPendiente() {
        return avisoPrivacidadPendiente;
    }

    public void setAvisoPrivacidadPendiente(boolean avisoPrivacidadPendiente) {
        this.avisoPrivacidadPendiente = avisoPrivacidadPendiente;
    }
}