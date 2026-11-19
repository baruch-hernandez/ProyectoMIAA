package com.miaa.lecturas.controllers;

import com.miaa.lecturas.config.UsuarioPrincipal;
import com.miaa.lecturas.dtos.CuentaEmpleadoDTO;
import com.miaa.lecturas.dtos.EdicionEmpleadoDTO;
import com.miaa.lecturas.dtos.EmpleadosDTO;
import com.miaa.lecturas.dtos.HabilitadoDTO;
import com.miaa.lecturas.dtos.NuevoEmpleadoDTO;
import com.miaa.lecturas.dtos.PasswordTemporalDTO;
import com.miaa.lecturas.dtos.UbicacionEmpleadoDTO;
import com.miaa.lecturas.services.EmpleadoService;
import com.miaa.lecturas.services.GestionEmpleadosService;
import com.miaa.lecturas.services.PresenciaService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Empleados (solo ADMIN). Todo el controlador exige el rol con @PreAuthorize a nivel clase.
 *
 *   GET  /empleados                    lista con actividad y "en línea"
 *   POST /empleados                    dar de alta con su rol (contraseña temporal)
 *   GET  /empleados/{id}               datos de su cuenta
 *   PUT  /empleados/{id}               editar nombre, usuario, correo y rol
 *   POST /empleados/{id}/password      restablecer contraseña (temporal)
 *   PUT  /empleados/{id}/habilitado    dar de baja / reactivar
 *   POST /empleados/{id}/desbloquear   quitar el bloqueo por intentos fallidos
 *   GET  /empleados/{id}/ubicacion     ubicación en vivo
 *   (el mapa de todos es GET /cuadrillas, en CuadrillasController)
 */
@RestController
@RequestMapping("/empleados")
@PreAuthorize("hasRole('ADMIN')")
public class UsuarioController {

    private final EmpleadoService empleadoService;
    private final PresenciaService presenciaService;
    private final GestionEmpleadosService gestionEmpleados;

    public UsuarioController(EmpleadoService empleadoService, PresenciaService presenciaService,
                             GestionEmpleadosService gestionEmpleados) {
        this.empleadoService = empleadoService;
        this.presenciaService = presenciaService;
        this.gestionEmpleados = gestionEmpleados;
    }

    @GetMapping
    public EmpleadosDTO empleados() {
        return empleadoService.listar();
    }

    @GetMapping("/{id}/ubicacion")
    @SuppressWarnings("null")
    public UbicacionEmpleadoDTO ubicacion(@PathVariable("id") Long id) {
        return presenciaService.deEmpleado(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CuentaEmpleadoDTO crear(@Valid @RequestBody NuevoEmpleadoDTO request) {
        return gestionEmpleados.crear(request);
    }

    @GetMapping("/{id}")
    public CuentaEmpleadoDTO cuenta(@PathVariable("id") Long id) {
        return gestionEmpleados.obtener(id);
    }

    @PutMapping("/{id}")
    public CuentaEmpleadoDTO editar(@PathVariable("id") Long id, @Valid @RequestBody EdicionEmpleadoDTO request,
                                    @AuthenticationPrincipal UsuarioPrincipal yo) {
        return gestionEmpleados.editar(id, request, yo);
    }

    @PostMapping("/{id}/password")
    public CuentaEmpleadoDTO restablecerPassword(@PathVariable("id") Long id,
                                                 @Valid @RequestBody PasswordTemporalDTO request) {
        return gestionEmpleados.restablecerPassword(id, request.passwordTemporal());
    }

    @PutMapping("/{id}/habilitado")
    public CuentaEmpleadoDTO cambiarHabilitado(@PathVariable("id") Long id, @Valid @RequestBody HabilitadoDTO request,
                                               @AuthenticationPrincipal UsuarioPrincipal yo) {
        return gestionEmpleados.cambiarHabilitado(id, request.habilitado(), yo);
    }

    @PostMapping("/{id}/desbloquear")
    public CuentaEmpleadoDTO desbloquear(@PathVariable("id") Long id) {
        return gestionEmpleados.desbloquear(id);
    }
}
