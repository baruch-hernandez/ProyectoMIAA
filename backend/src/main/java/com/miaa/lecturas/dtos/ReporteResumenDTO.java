package com.miaa.lecturas.dtos;

import com.miaa.lecturas.entities.Reporte;

import java.time.Instant;
import java.time.LocalDateTime;

/**
 * Un renglón de la lista de reportes (sin fotos: solo cuántas tiene y de dónde sacar la miniatura).
 * También es lo que lleva el aviso en tiempo real al admin (NuevoReporteEvent).
 */
public record ReporteResumenDTO(
        Long id,
        String folio,
        String domicilio,
        String colonia,
        String municipio,
        String descripcion, // recortada a 180 caracteres
        String autor,
        Long autorId,
        LocalDateTime fechaCreacion,
        long totalFotos,
        long totalNotas,
        boolean editado,
        Double latitud,
        Double longitud,
        /** Cuándo se llenó en campo (UTC); null en reportes de antes de guardarla. */
        Instant fechaCaptura,
        /** Ruta de la miniatura de la primera foto, relativa a la API ("/reportes/7/miniatura"); null sin fotos. */
        String miniatura) {

    private static final int LARGO_VISTA_PREVIA = 180;

    public static ReporteResumenDTO desde(Reporte r, long totalFotos, long totalNotas) {
        String d = r.getDescripcion();
        String vistaPrevia = d.length() > LARGO_VISTA_PREVIA ? d.substring(0, LARGO_VISTA_PREVIA).trim() + "…" : d;
        return new ReporteResumenDTO(
                r.getId(),
                r.getFolio(),
                r.getDomicilioCompleto(),
                r.getColonia(),
                r.getMunicipio(),
                vistaPrevia,
                r.getCreadoPor().getNombre(),
                r.getCreadoPor().getId(),
                r.getFechaCreacion(),
                totalFotos,
                totalNotas,
                r.getFechaEdicion() != null,
                r.getLatitud(),
                r.getLongitud(),
                r.getFechaCaptura(),
                totalFotos > 0 ? "/reportes/" + r.getId() + "/miniatura" : null);
    }
}
