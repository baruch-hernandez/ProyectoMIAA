package com.miaa.lecturas.controllers;

import com.miaa.lecturas.dtos.CuentaEmpleadoDTO;
import com.miaa.lecturas.dtos.EdicionEmpleadoDTO;
import com.miaa.lecturas.dtos.EmpleadosDTO;
import com.miaa.lecturas.dtos.HabilitadoDTO;
import com.miaa.lecturas.dtos.NuevoEmpleadoDTO;
import com.miaa.lecturas.dtos.PasswordTemporalDTO;
import com.miaa.lecturas.dtos.UbicacionEmpleadoDTO;
import com.miaa.lecturas.services.EmpleadoService;
import com.miaa.lecturas.services.GestionEmpleadosService;
import com.miaa.lecturas.services.UbicacionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
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
 *   GET  /usuarios/empleados                    lista con actividad y "en línea"
 *   POST /usuarios/empleados                    dar de alta (contraseña temporal)
 *   GET  /usuarios/empleados/{id}               datos de su cuenta
 *   PUT  /usuarios/empleados/{id}               editar nombre, usuario, correo
 *   POST /usuarios/empleados/{id}/password      restablecer contraseña (temporal)
 *   PUT  /usuarios/empleados/{id}/habilitado    dar de baja / reactivar
 *   POST /usuarios/empleados/{id}/desbloquear   quitar el bloqueo por intentos fallidos
 *   GET  /usuarios/empleados/{id}/ubicacion     ubicación en vivo
 */
@RestController
@RequestMapping({ "/usuarios", "/api/v1/usuarios" })
@PreAuthorize("hasRole('ADMIN')")
public class UsuarioController {

    private final EmpleadoService empleadoService;
    private final UbicacionService ubicacionService;
    private final GestionEmpleadosService gestionEmpleados;

    public UsuarioController(EmpleadoService empleadoService, UbicacionService ubicacionService,
                             GestionEmpleadosService gestionEmpleados) {
        this.empleadoService = empleadoService;
        this.ubicacionService = ubicacionService;
        this.gestionEmpleados = gestionEmpleados;
    }

    /**
     * GET /usuarios/empleados (solo ADMIN)
     * → { diasInactivo: 7, empleados: [{ id, nombre, username, ultimoAcceso, ultimoReporte,
     *      totalReportes, ultimaActividad, activo, diasSinActividad, enLinea }] }
     */
    @GetMapping("/empleados")
    public EmpleadosDTO empleados() {
        return empleadoService.listar();
    }

    /**
     * GET /usuarios/empleados/{id}/ubicacion (solo ADMIN)
     * Última ubicación del notificador y si está en línea. El mapa del admin lo consulta cada 5 s.
     */
    @GetMapping("/empleados/{id}/ubicacion")
    public UbicacionEmpleadoDTO ubicacion(@PathVariable("id") Long id) {
        return ubicacionService.deEmpleado(id);
    }

    @PostMapping("/empleados")
    @ResponseStatus(HttpStatus.CREATED)
    public CuentaEmpleadoDTO crear(@Valid @RequestBody NuevoEmpleadoDTO request) {
        return gestionEmpleados.crear(request);
    }

    @GetMapping("/empleados/{id}")
    public CuentaEmpleadoDTO cuenta(@PathVariable("id") Long id) {
        return gestionEmpleados.obtener(id);
    }

    @PutMapping("/empleados/{id}")
    public CuentaEmpleadoDTO editar(@PathVariable("id") Long id, @Valid @RequestBody EdicionEmpleadoDTO request) {
        return gestionEmpleados.editar(id, request);
    }

    @PostMapping("/empleados/{id}/password")
    public CuentaEmpleadoDTO restablecerPassword(@PathVariable("id") Long id,
                                                 @Valid @RequestBody PasswordTemporalDTO request) {
        return gestionEmpleados.restablecerPassword(id, request.passwordTemporal());
    }

    @PutMapping("/empleados/{id}/habilitado")
    public CuentaEmpleadoDTO cambiarHabilitado(@PathVariable("id") Long id, @Valid @RequestBody HabilitadoDTO request) {
        return gestionEmpleados.cambiarHabilitado(id, request.habilitado());
    }

    @PostMapping("/empleados/{id}/desbloquear")
    public CuentaEmpleadoDTO desbloquear(@PathVariable("id") Long id) {
        return gestionEmpleados.desbloquear(id);
    }
}
