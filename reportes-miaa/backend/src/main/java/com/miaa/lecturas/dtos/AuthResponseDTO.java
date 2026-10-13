package com.miaa.lecturas.dtos;

public class AuthResponseDTO {

    private String token;
    private Long id;
    private String nombre;
    private String rol;

    // Constructor vacío (necesario para instanciar new AuthResponseDTO())
    public AuthResponseDTO() {
    }

    // Constructor completo
    public AuthResponseDTO(String token, Long id, String nombre, String rol) {
        this.token = token;
        this.id = id;
        this.nombre = nombre;
        this.rol = rol;
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
}