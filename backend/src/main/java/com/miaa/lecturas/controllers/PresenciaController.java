package com.miaa.lecturas.controllers;

import com.miaa.lecturas.config.UsuarioPrincipal;
import com.miaa.lecturas.dtos.UbicacionRequestDTO;
import com.miaa.lecturas.services.PresenciaService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * El latido de presencia (Sprint 5, tarea 1.2). Nadie puede mandar el de otro: el id sale del token.
 * Lo usan la app y la web, uno por segundo.
 *
 *   POST /usuarios/heartbeat   sin cuerpo, o { latitud, longitud, precision }   → 204
 *                              (fuera de Aguascalientes → 400)
 *
 * Pausar (INACTIVO al instante) es DELETE /usuarios/yo/conexion, en CuentaController.
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
}
