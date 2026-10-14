package com.miaa.lecturas.controllers;

import com.miaa.lecturas.config.UsuarioPrincipal;
import com.miaa.lecturas.dtos.FotoDTO;
import com.miaa.lecturas.dtos.FotoRequestDTO;
import com.miaa.lecturas.dtos.NotaDTO;
import com.miaa.lecturas.dtos.NotaRequestDTO;
import com.miaa.lecturas.dtos.ReporteDetalleDTO;
import com.miaa.lecturas.dtos.ReporteEdicionDTO;
import com.miaa.lecturas.dtos.ReporteRequestDTO;
import com.miaa.lecturas.dtos.ReporteResumenDTO;
import com.miaa.lecturas.services.ReporteService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Reportes de domicilios.
 *
 *  LECTURISTA
 *   POST   /reportes                         subir un reporte (con clienteId no se duplica al reenviar)
 *   PUT    /reportes/{id}                    corregir domicilio/descripción (primeras 24 h)
 *   DELETE /reportes/{id}                    borrarlo (primeras 24 h)
 *   GET    /reportes/mios                    mis reportes
 *   POST   /reportes/{id}/notas              agregar una nota
 *   POST   /reportes/{id}/fotos              poner una foto (máx. 3)
 *   DELETE /reportes/{id}/fotos/{fotoId}     quitar una foto
 *  ADMIN (solo consulta)
 *   GET    /reportes                         los reportes de todos los empleados
 *  AMBOS
 *   GET    /reportes/{id}                    detalle (el lecturista solo los suyos)
 *
 * @PreAuthorize dice QUÉ ROL entra; ReporteService decide sobre QUÉ reporte.
 * Los nombres en @PathVariable("id") van explícitos para que funcione aunque el IDE
 * compile sin la opción "-parameters".
 */
@RestController
@RequestMapping({ "/reportes", "/api/v1/reportes" })
public class ReporteController {

    private final ReporteService reporteService;

    public ReporteController(ReporteService reporteService) {
        this.reporteService = reporteService;
    }

    @PostMapping
    @PreAuthorize("hasRole('LECTURISTA')")
    @ResponseStatus(HttpStatus.CREATED)
    public ReporteDetalleDTO crear(@AuthenticationPrincipal UsuarioPrincipal yo,
                                   @Valid @RequestBody ReporteRequestDTO request) {
        return reporteService.crear(yo, request);
    }

    @GetMapping("/mios")
    @PreAuthorize("hasRole('LECTURISTA')")
    public List<ReporteResumenDTO> mios(@AuthenticationPrincipal UsuarioPrincipal yo) {
        return reporteService.mios(yo);
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<ReporteResumenDTO> todos() {
        return reporteService.todos();
    }

    @GetMapping("/{id}")
    public ReporteDetalleDTO detalle(@AuthenticationPrincipal UsuarioPrincipal yo,
                                     @PathVariable("id") Long id) {
        return reporteService.detalle(yo, id);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('LECTURISTA')")
    public ReporteDetalleDTO editar(@AuthenticationPrincipal UsuarioPrincipal yo,
                                    @PathVariable("id") Long id,
                                    @Valid @RequestBody ReporteEdicionDTO request) {
        return reporteService.editar(yo, id, request);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('LECTURISTA')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void borrar(@AuthenticationPrincipal UsuarioPrincipal yo, @PathVariable("id") Long id) {
        reporteService.borrar(yo, id);
    }

    @PostMapping("/{id}/notas")
    @PreAuthorize("hasRole('LECTURISTA')")
    @ResponseStatus(HttpStatus.CREATED)
    public NotaDTO agregarNota(@AuthenticationPrincipal UsuarioPrincipal yo,
                               @PathVariable("id") Long id,
                               @Valid @RequestBody NotaRequestDTO request) {
        return reporteService.agregarNota(yo, id, request.texto());
    }

    @PostMapping("/{id}/fotos")
    @PreAuthorize("hasRole('LECTURISTA')")
    @ResponseStatus(HttpStatus.CREATED)
    public FotoDTO agregarFoto(@AuthenticationPrincipal UsuarioPrincipal yo,
                               @PathVariable("id") Long id,
                               @Valid @RequestBody FotoRequestDTO request) {
        return reporteService.agregarFoto(yo, id, request);
    }

    @DeleteMapping("/{id}/fotos/{fotoId}")
    @PreAuthorize("hasRole('LECTURISTA')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void borrarFoto(@AuthenticationPrincipal UsuarioPrincipal yo,
                           @PathVariable("id") Long id,
                           @PathVariable("fotoId") Long fotoId) {
        reporteService.borrarFoto(yo, id, fotoId);
    }
}
