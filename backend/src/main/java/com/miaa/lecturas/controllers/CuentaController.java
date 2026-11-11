package com.miaa.lecturas.controllers;

import com.miaa.lecturas.config.UsuarioPrincipal;
import com.miaa.lecturas.dtos.AceptarAvisoDTO;
import com.miaa.lecturas.dtos.CambioPasswordDTO;
import com.miaa.lecturas.dtos.CuentaDTO;
import com.miaa.lecturas.services.CuentaService;
import com.miaa.lecturas.services.PresenciaService;
import com.miaa.lecturas.services.UbicacionService;
import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * La cuenta de quien hace la petición (cualquier rol). Estas rutas siguen disponibles
 * aunque tenga requisitos pendientes: son justo para resolverlos.
 *
 *   GET  /usuarios/yo
 *   PUT  /usuarios/yo/password           { actual, nueva }
 *   POST /usuarios/yo/aviso-privacidad   { version }
 *   POST /usuarios/yo/conexion           latido "sigo aquí" (cada segundo)
 *   DELETE /usuarios/yo/conexion         la app se pausó: inactivo al instante
 */
@RestController
@RequestMapping({ "/usuarios/yo", "/api/v1/usuarios/yo" })
public class CuentaController {

    private final PresenciaService presenciaService;
    private final CuentaService cuentaService;
    private final UbicacionService ubicacionService;

    public CuentaController(CuentaService cuentaService, PresenciaService presenciaService,
                            UbicacionService ubicacionService) {
        this.cuentaService = cuentaService;
        this.presenciaService = presenciaService;
        this.ubicacionService = ubicacionService;
    }

    @GetMapping
    public CuentaDTO yo(@AuthenticationPrincipal UsuarioPrincipal yo) {
        return cuentaService.yo(yo);
    }

    @PutMapping("/password")
    public CuentaDTO cambiarPassword(@AuthenticationPrincipal UsuarioPrincipal yo,
                                     @Valid @RequestBody CambioPasswordDTO request) {
        return cuentaService.cambiarPassword(yo, request.actual(), request.nueva());
    }

    @PostMapping("/aviso-privacidad")
    public CuentaDTO aceptarAviso(@AuthenticationPrincipal UsuarioPrincipal yo,
                                  @Valid @RequestBody AceptarAvisoDTO request) {
        return cuentaService.aceptarAviso(yo, request.version());
    }
    @SuppressWarnings("null")
    @PostMapping("/conexion")
@ResponseStatus(HttpStatus.NO_CONTENT)
public void checarVida(@AuthenticationPrincipal UsuarioPrincipal user) {
    presenciaService.vidaChecar(user.id());
}

    /** La app se fue al fondo o se apagó la pantalla: sale inactivo y del mapa al instante. */
    @SuppressWarnings("null")
    @DeleteMapping("/conexion")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void pausar(@AuthenticationPrincipal UsuarioPrincipal yo) {
        presenciaService.desconectar(yo.id());
        ubicacionService.dejarDeCompartir(yo);
    }
}
