package com.miaa.lecturas.config;

public record UsuarioPrincipal(Long id, String username, String nombre, String rol) {

    public boolean esAdmin() {
        return "ADMIN".equals(rol);
    }
}
