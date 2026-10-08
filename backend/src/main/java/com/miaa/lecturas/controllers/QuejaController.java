package com.miaa.lecturas.controllers;

import com.miaa.lecturas.config.UsuarioPrincipal;
import com.miaa.lecturas.dtos.NotaDTO;
import com.miaa.lecturas.dtos.NotaRequestDTO;
import com.miaa.lecturas.dtos.QuejaDetalleDTO;
import com.miaa.lecturas.dtos.QuejaRequestDTO;
import com.miaa.lecturas.dtos.QuejaResumenDTO;
import com.miaa.lecturas.entities.EstadoQueja;
import com.miaa.lecturas.services.QuejaService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Endpoints de quejas del LECTURISTA (el empleado de campo que visita los domicilios).
 * Solo ADMIN y LECTURISTA pueden usarlos (ver SecurityConfig).
 *
 *  POST /quejas                 registrar una queja
 *  GET  /quejas/mias?estado=X   mis quejas (filtro opcional)
 *  GET  /quejas/{id}            detalle con fotos y notas
 *  POST /quejas/{id}/notas      agregar una nota
 *
 * El controlador es "delgado": recibe, valida con @Valid y delega al servicio.
 * Nota: los nombres en @PathVariable("id") / @RequestParam(name = ...) van explícitos
 * para que funcione aunque el IDE compile sin la opción "-parameters".
 */
@RestController
@RequestMapping({ "/quejas", "/api/v1/quejas" })
public class QuejaController {

    private final QuejaService quejaService;

    public QuejaController(QuejaService quejaService) {
        this.quejaService = quejaService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public QuejaDetalleDTO crear(@AuthenticationPrincipal UsuarioPrincipal yo,
                                 @Valid @RequestBody QuejaRequestDTO request) {
        return quejaService.crear(yo, request);
    }

    @GetMapping("/mias")
    public List<QuejaResumenDTO> misQuejas(@AuthenticationPrincipal UsuarioPrincipal yo,
                                           @RequestParam(name = "estado", required = false) EstadoQueja estado) {
        return quejaService.misQuejas(yo, estado);
    }

    @GetMapping("/{id}")
    public QuejaDetalleDTO detalle(@AuthenticationPrincipal UsuarioPrincipal yo,
                                   @PathVariable("id") Long id) {
        return quejaService.detalle(yo, id);
    }

    @PostMapping("/{id}/notas")
    @ResponseStatus(HttpStatus.CREATED)
    public NotaDTO agregarNota(@AuthenticationPrincipal UsuarioPrincipal yo,
                               @PathVariable("id") Long id,
                               @Valid @RequestBody NotaRequestDTO request) {
        return quejaService.agregarNota(yo, id, request.texto());
    }
}
