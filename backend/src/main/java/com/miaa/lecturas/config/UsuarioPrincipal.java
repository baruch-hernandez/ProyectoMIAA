package com.miaa.lecturas.config;

/**
 * "Quién está haciendo la petición". Se arma a partir del JWT en cada request,
 * sin consultar la base de datos.
 *
 * En los controladores se recibe así:
 *   public algo miMetodo(@AuthenticationPrincipal UsuarioPrincipal yo) { ... }
 */
public record UsuarioPrincipal(Long id, String username, String nombre, String rol) {

    public boolean esAdmin() {
        return "ADMIN".equals(rol);
    }
}
