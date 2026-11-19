package com.miaa.lecturas.dtos;

/**
 * Se acaba de guardar un reporte nuevo (POST /reportes o /reportes/sync).
 * AvisosReportes lo manda a los admins conectados, solo cuando la transacción ya se confirmó.
 * Un reenvío del mismo clientSyncId NO lo genera: ese reporte ya se había avisado.
 */
public record NuevoReporteEvent(ReporteResumenDTO reporte) {
}
