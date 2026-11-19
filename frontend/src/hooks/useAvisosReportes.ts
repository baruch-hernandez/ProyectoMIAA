import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReporteResumen } from '../types/reporte';
import type { EstadoAvisos } from '../services/avisosReportes';
import { alNuevoReporte, conectarAvisos, desbloquearSonido, sonarAviso } from '../services/avisosReportes';

const LLAVE_SILENCIO = 'miaa.avisos.silencio';

function leerSilencio(): boolean {
  try {
    return localStorage.getItem(LLAVE_SILENCIO) === '1';
  } catch {
    return false;
  }
}

/**
 * Historia 6 (tareas 2.3 y 2.4), para la barra del admin: conexión en vivo, reportes no leídos,
 * el último (para el aviso) y el sonido con su botón de silencio (se recuerda en este navegador).
 */
export function useAvisosReportes() {
  const [estado, setEstado] = useState<EstadoAvisos>('conectando');
  const [noLeidos, setNoLeidos] = useState<ReporteResumen[]>([]);
  const [ultimo, setUltimo] = useState<ReporteResumen | null>(null);
  const [silencio, setSilencio] = useState(leerSilencio);
  const silencioActual = useRef(silencio);
  useEffect(() => { silencioActual.current = silencio; }, [silencio]);

  useEffect(() => conectarAvisos(setEstado), []);

  useEffect(() => {
    // El navegador solo deja sonar después de que la persona toca la página
    document.addEventListener('pointerdown', desbloquearSonido, { once: true });
    const dejar = alNuevoReporte((r) => {
      setNoLeidos((l) => (l.some((x) => x.id === r.id) ? l : [r, ...l]));
      setUltimo(r);
      if (!silencioActual.current) sonarAviso();
    });
    return () => {
      dejar();
      document.removeEventListener('pointerdown', desbloquearSonido);
    };
  }, []);

  const alternarSilencio = useCallback(() => {
    setSilencio((s) => {
      try { localStorage.setItem(LLAVE_SILENCIO, s ? '0' : '1'); } catch { /* sin almacenamiento: solo esta vez */ }
      if (s) desbloquearSonido();
      return !s;
    });
  }, []);

  const marcarLeidos = useCallback(() => { setNoLeidos([]); setUltimo(null); }, []);
  const cerrarAviso = useCallback(() => setUltimo(null), []);

  return { estado, noLeidos: noLeidos.length, ultimo, silencio, alternarSilencio, marcarLeidos, cerrarAviso };
}
