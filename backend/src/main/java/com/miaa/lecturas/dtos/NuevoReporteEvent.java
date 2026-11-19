package com.miaa.lecturas.dtos;

/**
 * Historia 6 (tarea 1.4): se acaba de guardar un reporte nuevo (POST /reportes o /reportes/sync).
 * AvisosReportes lo manda a los admins conectados, solo cuando la transacción ya se confirmó.
 * Un reenvío del mismo clientSyncId NO lo genera: ese reporte ya se había avisado.
 */
public record NuevoReporteEvent(ReporteResumenDTO reporte) {
}
