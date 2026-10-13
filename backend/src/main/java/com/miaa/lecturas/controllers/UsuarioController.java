package com.miaa.lecturas.controllers;

import com.miaa.lecturas.dtos.EmpleadosDTO;
import com.miaa.lecturas.dtos.UbicacionEmpleadoDTO;
import com.miaa.lecturas.services.EmpleadoService;
import com.miaa.lecturas.services.UbicacionService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({ "/usuarios", "/api/v1/usuarios" })
public class UsuarioController {

    private final EmpleadoService empleadoService;
    private final UbicacionService ubicacionService;

    public UsuarioController(EmpleadoService empleadoService, UbicacionService ubicacionService) {
        this.empleadoService = empleadoService;
        this.ubicacionService = ubicacionService;
    }

    /**
     * GET /usuarios/empleados (solo ADMIN)
     * → { diasInactivo: 7, empleados: [{ id, nombre, username, ultimoAcceso, ultimoReporte,
     *      totalReportes, ultimaActividad, activo, diasSinActividad, enLinea }] }
     */
    @GetMapping("/empleados")
    @PreAuthorize("hasRole('ADMIN')")
    public EmpleadosDTO empleados() {
        return empleadoService.listar();
    }

    /**
     * GET /usuarios/empleados/{id}/ubicacion (solo ADMIN)
     * Última ubicación del lecturista y si está en línea. El mapa del admin lo consulta cada 5 s.
     */
    @GetMapping("/empleados/{id}/ubicacion")
    @PreAuthorize("hasRole('ADMIN')")
    public UbicacionEmpleadoDTO ubicacion(@PathVariable("id") Long id) {
        return ubicacionService.deEmpleado(id);
    }
}
