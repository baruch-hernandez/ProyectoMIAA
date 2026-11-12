package com.miaa.lecturas.dtos;

import java.util.List;

/**
 * Una página de la lista de reportes del admin (GET /reportes?pagina=0&tamano=50).
 *
 * @param total     cuántos reportes hay en total (no solo en esta página)
 * @param empleados cuántos empleados distintos han reportado
 * @param hayMas    true si después de esta página vienen más
 */
public record PaginaReportesDTO(List<ReporteResumenDTO> reportes, long total, long empleados,
                                int pagina, boolean hayMas) {
}
