package com.miaa.lecturas.controllers;

import com.miaa.lecturas.config.UsuarioPrincipal;
import com.miaa.lecturas.dtos.FotoDTO;
import com.miaa.lecturas.dtos.FotoRequestDTO;
import com.miaa.lecturas.dtos.NotaDTO;
import com.miaa.lecturas.dtos.NotaRequestDTO;
import com.miaa.lecturas.dtos.PaginaReportesDTO;
import com.miaa.lecturas.dtos.ReporteDetalleDTO;
import com.miaa.lecturas.dtos.ReporteEdicionDTO;
import com.miaa.lecturas.dtos.ReporteRequestDTO;
import com.miaa.lecturas.dtos.ReporteResumenDTO;
import com.miaa.lecturas.dtos.ResultadoSyncDTO;
import com.miaa.lecturas.services.AvisosReportes;
import com.miaa.lecturas.services.ReporteService;
import com.miaa.lecturas.services.SincronizacionService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.format.annotation.DateTimeFormat.ISO;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Reportes de domicilios.
 *
 *  NOTIFICADOR
 *   POST   /reportes                         subir un reporte (con clienteId no se duplica al reenviar)
 *   POST   /reportes/sync                    subir de golpe los guardados sin conexión
 *   DELETE /reportes/{id}                    borrarlo (primeras 24 h)
 *   GET    /reportes/mios                    mis reportes
 *   POST   /reportes/{id}/fotos              poner una foto (máx. 3, primeras 24 h)
 *   DELETE /reportes/{id}/fotos/{fotoId}     quitar una foto (primeras 24 h)
 *  ADMIN
 *   GET    /reportes?pagina=0&tamano=50      los reportes de todos los empleados, por páginas
 *          &empleadoId=7&desde=2026-11-01&hasta=2026-11-18   filtros opcionales (días incluidos)
 *   GET    /reportes/eventos                 avisos de reportes nuevos en tiempo real
 *  AMBOS
 *   GET    /reportes/{id}                    detalle (el notificador solo los suyos)
 *   GET    /reportes/{id}/miniatura          JPEG chico de la primera foto
 *   POST   /reportes/{id}/notas              agregar una nota (el notificador al suyo; el admin a cualquiera)
 *   PUT    /reportes/{id}                    corregir datos (el notificador, el suyo y a tiempo; el admin, cualquiera)
 *
 * @PreAuthorize dice QUÉ ROL entra; ReporteService decide sobre QUÉ reporte.
 * Los nombres en @PathVariable("id") van explícitos para que funcione aunque el IDE
 * compile sin la opción "-parameters".
 */
@RestController
@RequestMapping("/reportes")
public class ReporteController {

    private final ReporteService reporteService;
    private final SincronizacionService sincronizacionService;
    private final AvisosReportes avisos;

    public ReporteController(ReporteService reporteService, SincronizacionService sincronizacionService,
                             AvisosReportes avisos) {
        this.reporteService = reporteService;
        this.sincronizacionService = sincronizacionService;
        this.avisos = avisos;
    }

    @PostMapping
    @PreAuthorize("hasRole('NOTIFICADOR')")
    @ResponseStatus(HttpStatus.CREATED)
    public ReporteDetalleDTO crear(@AuthenticationPrincipal UsuarioPrincipal yo,
                                   @Valid @RequestBody ReporteRequestDTO request) {
        return reporteService.crear(yo, request);
    }

    /**
     * Multipart: la parte "reportes" (JSON, lista) y una parte por foto (binaria), con el nombre que
     * dice cada foto en "parte". Responde 200 aunque algún reporte se rechace (ver ResultadoSyncDTO).
     */
    @PostMapping(path = "/sync", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('NOTIFICADOR')")
    public ResultadoSyncDTO sincronizar(@AuthenticationPrincipal UsuarioPrincipal yo,
                                        @RequestPart("reportes") String reportes,
                                        @RequestParam Map<String, MultipartFile> archivos) {
        return sincronizacionService.sincronizar(yo, reportes, archivos);
    }

    @GetMapping("/mios")
    @PreAuthorize("hasRole('NOTIFICADOR')")
    public List<ReporteResumenDTO> mios(@AuthenticationPrincipal UsuarioPrincipal yo) {
        return reporteService.mios(yo);
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public PaginaReportesDTO todos(@RequestParam(name = "pagina", defaultValue = "0") int pagina,
                                   @RequestParam(name = "tamano", defaultValue = "50") int tamano,
                                   @RequestParam(name = "empleadoId", required = false) Long empleadoId,
                                   @RequestParam(name = "desde", required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate desde,
                                   @RequestParam(name = "hasta", required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate hasta) {
        return reporteService.todos(pagina, tamano, empleadoId, desde, hasta);
    }

    /** Avisos de reportes nuevos en tiempo real (Server-Sent Events). Ver AvisosReportes. */
    @GetMapping(path = "/eventos", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public SseEmitter eventos() {
        return avisos.suscribir();
    }

    @GetMapping(path = "/{id}/miniatura", produces = MediaType.IMAGE_JPEG_VALUE)
    public ResponseEntity<byte[]> miniatura(@AuthenticationPrincipal UsuarioPrincipal yo, @PathVariable("id") Long id) {
        return ResponseEntity.ok()
                // privada (lleva token); 5 min, porque en las primeras 24 h el autor puede cambiar las fotos
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePrivate())
                .body(reporteService.miniatura(yo, id));
    }

    @GetMapping("/{id}")
    public ReporteDetalleDTO detalle(@AuthenticationPrincipal UsuarioPrincipal yo,
                                     @PathVariable("id") Long id) {
        return reporteService.detalle(yo, id);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('NOTIFICADOR', 'ADMIN')")
    public ReporteDetalleDTO editar(@AuthenticationPrincipal UsuarioPrincipal yo,
                                    @PathVariable("id") Long id,
                                    @Valid @RequestBody ReporteEdicionDTO request) {
        return reporteService.editar(yo, id, request);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('NOTIFICADOR')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void borrar(@AuthenticationPrincipal UsuarioPrincipal yo, @PathVariable("id") Long id) {
        reporteService.borrar(yo, id);
    }

    @PostMapping("/{id}/notas")
    @PreAuthorize("hasAnyRole('NOTIFICADOR', 'ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public NotaDTO agregarNota(@AuthenticationPrincipal UsuarioPrincipal yo,
                               @PathVariable("id") Long id,
                               @Valid @RequestBody NotaRequestDTO request) {
        return reporteService.agregarNota(yo, id, request.texto());
    }

    @PostMapping("/{id}/fotos")
    @PreAuthorize("hasRole('NOTIFICADOR')")
    @ResponseStatus(HttpStatus.CREATED)
    public FotoDTO agregarFoto(@AuthenticationPrincipal UsuarioPrincipal yo,
                               @PathVariable("id") Long id,
                               @Valid @RequestBody FotoRequestDTO request) {
        return reporteService.agregarFoto(yo, id, request);
    }

    @DeleteMapping("/{id}/fotos/{fotoId}")
    @PreAuthorize("hasRole('NOTIFICADOR')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void borrarFoto(@AuthenticationPrincipal UsuarioPrincipal yo,
                           @PathVariable("id") Long id,
                           @PathVariable("fotoId") Long fotoId) {
        reporteService.borrarFoto(yo, id, fotoId);
    }
}
