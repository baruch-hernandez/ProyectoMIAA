package com.miaa.lecturas.controllers;

import com.miaa.lecturas.config.UsuarioPrincipal;
import com.miaa.lecturas.dtos.UbicacionRequestDTO;
import com.miaa.lecturas.services.PresenciaService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * El latido de presencia (Sprint 5, tarea 1.2). Nadie puede mandar el de otro: el id sale del token.
 *
 *   POST /usuarios/heartbeat   sin cuerpo, o { latitud, longitud, precision }   → 204
 *                              (fuera de Aguascalientes → 400)
 *
 * Se quedan por compatibilidad con apps y webs ya instaladas (hacen lo mismo):
 *   POST   /ubicacion          = latido con coordenadas
 *   DELETE /ubicacion          = cerrar sesión / pausar (INACTIVO)
 *   POST, DELETE /usuarios/yo/conexion  (CuentaController)
 */
@RestController
public class PresenciaController {

    private final PresenciaService presenciaService;

    public PresenciaController(PresenciaService presenciaService) {
        this.presenciaService = presenciaService;
    }

    @SuppressWarnings("null")
    @PostMapping({ "/usuarios/heartbeat", "/api/v1/usuarios/heartbeat" })
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void latido(@AuthenticationPrincipal UsuarioPrincipal yo,
                       @Valid @RequestBody(required = false) UbicacionRequestDTO ubicacion) {
        presenciaService.latido(yo.id(), ubicacion);
    }

    @SuppressWarnings("null")
    @PostMapping({ "/ubicacion", "/api/v1/ubicacion" })
    @PreAuthorize("hasRole('NOTIFICADOR')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void ubicacion(@AuthenticationPrincipal UsuarioPrincipal yo, @Valid @RequestBody UbicacionRequestDTO ubicacion) {
        presenciaService.latido(yo.id(), ubicacion);
    }

    @SuppressWarnings("null")
    @DeleteMapping({ "/ubicacion", "/api/v1/ubicacion" })
    @PreAuthorize("hasRole('NOTIFICADOR')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void dejarDeCompartir(@AuthenticationPrincipal UsuarioPrincipal yo) {
        presenciaService.desconectar(yo.id());
    }
}
