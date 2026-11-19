package com.miaa.lecturas.controllers;

import com.miaa.lecturas.dtos.UbicacionEmpleadoDTO;
import com.miaa.lecturas.services.PresenciaService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Sprint 5 (tarea 1.5): el mapa de cuadrillas del admin.
 *
 *   GET /cuadrillas   todos los notificadores habilitados con su estado
 *                                       (ACTIVO/INACTIVO), última ubicación, dirección y última conexión
 */
@RestController
@RequestMapping("/cuadrillas")
@PreAuthorize("hasRole('ADMIN')")
public class CuadrillasController {

    private final PresenciaService presenciaService;

    public CuadrillasController(PresenciaService presenciaService) {
        this.presenciaService = presenciaService;
    }

    @GetMapping
    public List<UbicacionEmpleadoDTO> ubicaciones() {
        return presenciaService.cuadrillas();
    }
}
