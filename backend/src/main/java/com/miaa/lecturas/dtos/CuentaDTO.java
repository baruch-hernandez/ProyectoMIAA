package com.miaa.lecturas.dtos;

/**
 * GET /usuarios/yo — quién soy y qué me falta para poder usar la app.
 *
 * @param debeCambiarPassword      entró con contraseña temporal: tiene que cambiarla
 * @param avisoPrivacidadPendiente no ha aceptado la versión vigente del aviso de privacidad
 * @param avisoPrivacidadVersion   versión vigente del aviso (la que se debe aceptar)
 */
public record CuentaDTO(
        Long id,
        String nombre,
        String username,
        String email,
        String rol,
        boolean debeCambiarPassword,
        boolean avisoPrivacidadPendiente,
        String avisoPrivacidadVersion) {
}
