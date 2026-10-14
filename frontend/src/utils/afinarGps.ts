// "Afinar" la ubicación: en vez de quedarnos con la PRIMERA lectura del GPS (que suele venir
// de wifi o de las antenas, con ±50–500 m), escuchamos varias lecturas unos segundos y nos
// quedamos con la más precisa. Se detiene sola al llegar a la precisión objetivo o al tiempo límite.
import type { Coordenadas } from '../types/reporte';

export interface LecturaGps {
  punto: Coordenadas;
  /** Radio de error en metros (±). Entre más chico, mejor. */
  precision: number;
}

export interface OpcionesAfinado {
  /** Con esta precisión (m) o mejor, ya no se espera más. */
  objetivoM?: number;
  /** Tiempo máximo esperando una mejor lectura (ms). */
  maxMs?: number;
}

export interface EventosAfinado {
  /** Llega una lectura MÁS precisa que todas las anteriores. */
  onMejora: (lectura: LecturaGps) => void;
  /** Terminó: con la mejor lectura, o null si nunca llegó ninguna. */
  onFin: (mejor: LecturaGps | null, motivo: 'objetivo' | 'tiempo' | 'manual') => void;
  /** El navegador falló antes de dar cualquier lectura (p. ej. no dieron permiso). */
  onError: (error: GeolocationPositionError) => void;
}

export interface ControlAfinado {
  /** "Usar este punto": termina ya con la mejor lectura hasta ahora (llama a onFin). */
  terminar: () => void;
  /** Lo abandona sin avisar (p. ej. la persona movió el marcador a mano o salió de la pantalla). */
  cancelar: () => void;
}

export const OBJETIVO_PRECISION_M = 15;
export const MAX_AFINADO_MS = 20_000;

/** ¿La nueva lectura es mejor que la que tenemos? (precisión en metros: menos es mejor) */
export function esMasPrecisa(nueva: number, actual: number | undefined): boolean {
  return Number.isFinite(nueva) && nueva > 0 && (actual === undefined || nueva < actual);
}

export function afinarUbicacion(
  geo: Geolocation,
  eventos: EventosAfinado,
  { objetivoM = OBJETIVO_PRECISION_M, maxMs = MAX_AFINADO_MS }: OpcionesAfinado = {},
): ControlAfinado {
  let mejor: LecturaGps | null = null;
  let activo = true;
  let idVigilancia = 0;
  let limite = 0;

  const limpiar = () => {
    activo = false;
    geo.clearWatch(idVigilancia); // si aún no existe (respuesta inmediata), no hace nada
    window.clearTimeout(limite);
  };
  const terminarCon = (motivo: 'objetivo' | 'tiempo' | 'manual') => {
    if (!activo) return;
    limpiar();
    eventos.onFin(mejor, motivo);
  };

  idVigilancia = geo.watchPosition(
    (pos) => {
      if (!activo) return;
      const precision = Math.round(pos.coords.accuracy);
      if (!esMasPrecisa(precision, mejor?.precision)) return;
      mejor = { punto: { lat: pos.coords.latitude, lng: pos.coords.longitude }, precision };
      eventos.onMejora(mejor);
      if (precision <= objetivoM) terminarCon('objetivo');
    },
    (error) => {
      if (!activo) return;
      // Si ya tenemos alguna lectura, un error suelto (p. ej. timeout) no importa: seguimos esperando
      if (mejor && error.code !== error.PERMISSION_DENIED) return;
      limpiar();
      if (mejor) eventos.onFin(mejor, 'manual');
      else eventos.onError(error);
    },
    // maximumAge 0: lecturas nuevas, no una posición vieja guardada por el navegador
    { enableHighAccuracy: true, maximumAge: 0, timeout: maxMs },
  );
  if (activo) limite = window.setTimeout(() => terminarCon('tiempo'), maxMs);
  else geo.clearWatch(idVigilancia); // terminó antes de tener el id: ahora sí se puede apagar

  return {
    terminar: () => terminarCon('manual'),
    cancelar: () => { if (activo) limpiar(); },
  };
}
