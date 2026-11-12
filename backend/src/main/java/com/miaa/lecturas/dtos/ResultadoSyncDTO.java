package com.miaa.lecturas.dtos;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;
import java.util.Map;

/**
 * Respuesta de POST /reportes/sync (Sprint 4, tarea 1.4): qué reportes del lote quedaron guardados
 * y cuáles se rechazaron y por qué. Un rechazo no detiene a los demás del lote.
 *
 *   { "sincronizados": [ { "clientSyncId": "…", "id": 42, "folio": "R-2026-000042" } ],
 *     "rechazados":    [ { "clientSyncId": "…", "motivo": "Revisa los datos del reporte",
 *                          "errores": { "latitud": "Faltan las coordenadas del domicilio" } } ] }
 *
 * Un reporte que ya se había recibido (reintento) sale en "sincronizados" con su id de siempre.
 */
public record ResultadoSyncDTO(List<Sincronizado> sincronizados, List<Rechazado> rechazados) {

    public record Sincronizado(String clientSyncId, Long id, String folio) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Rechazado(String clientSyncId, String motivo, Map<String, String> errores) {
    }
}
