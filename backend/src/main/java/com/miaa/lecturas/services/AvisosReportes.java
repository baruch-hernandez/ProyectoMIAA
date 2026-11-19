package com.miaa.lecturas.services;

import com.miaa.lecturas.dtos.NuevoReporteEvent;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Supplier;

/**
 * Historia 6 (tareas 1.3 y 1.4): avisos en tiempo real a los admins con Server-Sent Events.
 *
 * Cada pestaña del panel abre GET /api/reportes/eventos (solo ADMIN, con su JWT como cualquier
 * petición) y se queda escuchando. Al guardarse un reporte nuevo, ya confirmado en PostgreSQL,
 * a todas les llega:
 *
 *   event: nuevo-reporte
 *   data: { ...ReporteResumenDTO }
 *
 * Al celular no se le manda nada: solo los admins se suscriben.
 */
@Component
public class AvisosReportes {

    /** Una conexión dura esto; luego el navegador se vuelve a conectar solo. */
    static final long DURACION_MS = 30 * 60_000L;

    // shortcut: las conexiones viven en memoria de ESTE backend (hay uno solo); con varios, hace falta Redis o similar
    private final List<SseEmitter> conectados = new CopyOnWriteArrayList<>();

    public SseEmitter suscribir() {
        SseEmitter emisor = new SseEmitter(DURACION_MS);
        emisor.onCompletion(() -> conectados.remove(emisor));
        emisor.onTimeout(emisor::complete);
        emisor.onError(e -> conectados.remove(emisor));
        conectados.add(emisor);
        // Algo de inmediato: así el navegador sabe que ya está conectado (y los proxies sueltan las cabeceras)
        enviar(emisor, () -> SseEmitter.event().comment("conectado"));
        return emisor;
    }

    /** Solo después del COMMIT: si la transacción se deshace, no se avisa de un reporte que no existe. */
    @TransactionalEventListener
    public void alGuardarse(NuevoReporteEvent evento) {
        difundir(() -> SseEmitter.event().name("nuevo-reporte").data(evento.reporte()));
    }

    /** Cada 25 s: mantiene viva la conexión en proxies y detecta las pestañas que ya se cerraron. */
    @Scheduled(fixedRate = 25_000)
    public void latir() {
        difundir(() -> SseEmitter.event().comment("ping"));
    }

    int conectados() {
        return conectados.size();
    }

    // Un builder por envío: SseEventBuilder no se puede reusar (build() le agrega el fin de evento)
    private void difundir(Supplier<SseEmitter.SseEventBuilder> evento) {
        conectados.forEach(emisor -> enviar(emisor, evento));
    }

    private void enviar(SseEmitter emisor, Supplier<SseEmitter.SseEventBuilder> evento) {
        try {
            emisor.send(evento.get());
        } catch (IOException | IllegalStateException e) {
            conectados.remove(emisor); // la pestaña se cerró o se cortó la red
        }
    }
}
