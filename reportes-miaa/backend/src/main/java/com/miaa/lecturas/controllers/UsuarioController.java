package com.miaa.lecturas.controllers;

import com.miaa.lecturas.dtos.EmpleadosDTO;
import com.miaa.lecturas.services.EmpleadoService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({ "/usuarios", "/api/v1/usuarios" })
public class UsuarioController {

    private final EmpleadoService empleadoService;

    public UsuarioController(EmpleadoService empleadoService) {
        this.empleadoService = empleadoService;
    }

    /**
     * GET /usuarios/empleados (solo ADMIN)
     * → { diasInactivo: 7, empleados: [{ id, nombre, username, ultimoAcceso, ultimoReporte,
     *      totalReportes, ultimaActividad, activo, diasSinActividad }] }
     */
    @GetMapping("/empleados")
    @PreAuthorize("hasRole('ADMIN')")
    public EmpleadosDTO empleados() {
        return empleadoService.listar();
    }
}
