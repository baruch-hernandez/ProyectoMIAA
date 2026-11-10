package com.miaa.lecturas.dtos;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Un reporte completo, con fotos y notas.
 *
 * @param puedeEditar     true solo para quien lo subió: puede agregar notas y quitar/poner fotos.
 * @param puedeModificar  true si además todavía está a tiempo de corregir o borrar el reporte.
 * @param puedeCorregir   true si puede corregir domicilio, ubicación o descripción:
 *                        el autor a tiempo (= puedeModificar) o cualquier ADMIN.
 * @param modificableHasta hasta cuándo puede corregirlo o borrarlo (null si no es suyo).
 *                    El ADMIN los ve en false (no toca notas ni fotos). El front lo usa para mostrar
 *                    u ocultar botones, pero quien de verdad lo hace cumplir es ReporteService.
 */
public record ReporteDetalleDTO(
        Long id,
        String folio,
        String calle,
        String numeroExterior,
        String numeroInterior,
        String colonia,
        String codigoPostal,
        String municipio,
        String referencias,
        String numeroContrato,
        Double latitud,
        Double longitud,
        String descripcion,
        String autor,
        LocalDateTime fechaCreacion,
        LocalDateTime fechaActualizacion,
        LocalDateTime fechaEdicion,
        List<FotoDTO> fotos,
        List<NotaDTO> notas,
        boolean puedeEditar,
        boolean puedeModificar,
        LocalDateTime modificableHasta,
        boolean puedeCorregir) {
}
