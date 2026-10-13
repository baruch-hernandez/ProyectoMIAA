package com.miaa.lecturas.controllers;

import com.miaa.lecturas.config.UsuarioPrincipal;
import com.miaa.lecturas.dtos.UbicacionRequestDTO;
import com.miaa.lecturas.services.UbicacionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * El lecturista comparte SU ubicación (nadie puede mandar la de otro: el id sale del token).
 *
 *   POST   /ubicacion   { latitud, longitud, precision, fecha }   → 204
 *   DELETE /ubicacion   al cerrar sesión: deja de aparecer "en línea" → 204
 */
@RestController
@RequestMapping({ "/ubicacion", "/api/v1/ubicacion" })
@PreAuthorize("hasRole('LECTURISTA')")
public class UbicacionController {

    private final UbicacionService ubicacionService;

    public UbicacionController(UbicacionService ubicacionService) {
        this.ubicacionService = ubicacionService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void actualizar(@AuthenticationPrincipal UsuarioPrincipal yo,
                           @Valid @RequestBody UbicacionRequestDTO request) {
        ubicacionService.actualizar(yo, request);
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void dejarDeCompartir(@AuthenticationPrincipal UsuarioPrincipal yo) {
        ubicacionService.dejarDeCompartir(yo);
    }
}
