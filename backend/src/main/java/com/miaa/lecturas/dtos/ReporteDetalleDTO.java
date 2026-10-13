package com.miaa.lecturas.dtos;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Un reporte completo, con fotos y notas.
 *
 * @param puedeEditar true solo para quien lo subió: puede agregar notas y quitar/poner fotos.
 *                    El ADMIN lo ve en false (solo consulta). El front lo usa para mostrar
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
        List<FotoDTO> fotos,
        List<NotaDTO> notas,
        boolean puedeEditar) {
}
