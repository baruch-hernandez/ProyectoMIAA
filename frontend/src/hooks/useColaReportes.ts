import { useCallback, useEffect, useState } from 'react';
import type { ReportePendiente } from '../utils/colaReportes';
import { alCambiarCola, descartarPendiente, enviarPendientes, listarPendientes } from '../utils/colaReportes';
import { obtenerUsuario } from '../utils/sesion';

/** Cada cuánto reintenta solo mientras haya pendientes (además de al volver la red). */
const REINTENTO_MS = 60_000;

/**
 * Los reportes guardados sin conexión del notificador con sesión.
 * Con `automatico` (se usa UNA vez, en NotificadorLayout) además los envía solos:
 * al abrir la app, al volver la red y cada minuto mientras queden.
 */
export function useColaReportes({ automatico = false } = {}) {
  const usuarioId = obtenerUsuario()?.id;
  const [pendientes, setPendientes] = useState<ReportePendiente[]>([]);
  const [enviando, setEnviando] = useState(false);

  // Leer la lista ahora y cada vez que cambie (guardar, enviar, descartar)
  useEffect(() => {
    if (usuarioId == null) return;
    let vivo = true;
    const leer = () => {
      listarPendientes(usuarioId)
        .then((l) => { if (vivo) setPendientes(l); })
        .catch(() => { /* navegador sin IndexedDB (modo privado viejo): sin cola */ });
    };
    leer();
    const quitar = alCambiarCola(leer);
    return () => { vivo = false; quitar(); };
  }, [usuarioId]);

  const enviarAhora = useCallback(async (incluirRechazados = true) => {
    if (usuarioId == null) return 0;
    setEnviando(true);
    try {
      return await enviarPendientes(usuarioId, incluirRechazados);
    } finally {
      setEnviando(false);
    }
  }, [usuarioId]);

  // Envío automático
  const hayPendientes = pendientes.some((p) => !p.error);
  useEffect(() => {
    if (!automatico || usuarioId == null) return;
    const intentar = () => { enviarPendientes(usuarioId).catch(() => undefined); };
    intentar(); // al abrir la app
    window.addEventListener('online', intentar);
    const reintento = hayPendientes ? window.setInterval(intentar, REINTENTO_MS) : undefined;
    return () => {
      window.removeEventListener('online', intentar);
      window.clearInterval(reintento);
    };
  }, [automatico, usuarioId, hayPendientes]);

  return { pendientes, enviando, enviarAhora, descartar: descartarPendiente };
}
