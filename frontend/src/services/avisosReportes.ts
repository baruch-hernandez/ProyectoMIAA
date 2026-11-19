// Avisos en tiempo real de reportes nuevos (Server-Sent Events, GET /reportes/eventos).
//
// ¿Por qué fetch y no EventSource? EventSource no deja mandar la cabecera Authorization: habría que
// poner el JWT en la URL, y las URLs quedan en historiales y bitácoras. Con fetch va como en cualquier
// otra petición y el backend lo valida igual (solo ADMIN).
import type { FiltrosReportes, ReporteResumen } from '../types/reporte';
import { obtenerToken } from '../utils/sesion';
import { URL_API } from './api';

export type EstadoAvisos = 'conectando' | 'en-vivo' | 'reconectando';

// ---------- quién se entera (la barra del admin y la bandeja) ----------
const oyentes = new Set<(r: ReporteResumen) => void>();

/** Avisa a [fn] de cada reporte nuevo. Regresa cómo dejar de escuchar. */
export function alNuevoReporte(fn: (r: ReporteResumen) => void): () => void {
  oyentes.add(fn);
  return () => { oyentes.delete(fn); };
}

/** ¿Un reporte que llegó en vivo entra en los filtros de la bandeja? (los mismos que aplica el backend) */
export function coincideConFiltros(r: ReporteResumen, f: FiltrosReportes): boolean {
  const dia = r.fechaCreacion.slice(0, 10); // fecha de recepción, en hora del servidor (como el filtro)
  return (f.empleadoId === '' || f.empleadoId === String(r.autorId))
    && (f.desde === '' || dia >= f.desde)
    && (f.hasta === '' || dia <= f.hasta);
}

export interface EventoSse {
  nombre: string;
  datos: string;
}

/**
 * Separa los eventos COMPLETOS de [texto] (terminan en línea vacía). Regresa además lo que sobró:
 * un evento a medias que se completa con lo que llegue después. Las líneas ":" son comentarios (pings).
 */
export function leerEventos(texto: string): { eventos: EventoSse[]; resto: string } {
  const bloques = texto.replace(/\r\n?/g, '\n').split('\n\n');
  const resto = bloques.pop() ?? '';
  const eventos: EventoSse[] = [];
  for (const bloque of bloques) {
    let nombre = 'message';
    const datos: string[] = [];
    for (const linea of bloque.split('\n')) {
      if (linea.startsWith('event:')) nombre = linea.slice(6).trim();
      else if (linea.startsWith('data:')) datos.push(linea.slice(5).replace(/^ /, ''));
    }
    if (datos.length) eventos.push({ nombre, datos: datos.join('\n') });
  }
  return { eventos, resto };
}

const ESPERA_MIN_MS = 2_000;
const ESPERA_MAX_MS = 30_000;

/**
 * Se conecta al canal con el JWT de la sesión y se queda escuchando. Si se corta (red, reinicio del
 * backend o los 30 min que dura cada conexión), se vuelve a conectar solo: 2 s, 4 s, 8 s… hasta 30 s.
 * Con 401/403 (sesión vencida o sin permiso) ya no insiste. Regresa cómo desconectarse.
 */
export function conectarAvisos(alCambiarEstado: (e: EstadoAvisos) => void): () => void {
  let cerrado = false;
  let control: AbortController | undefined;
  let reintento: number | undefined;
  let espera = ESPERA_MIN_MS;

  const conectar = async () => {
    control = new AbortController();
    try {
      const r = await fetch(`${URL_API}/reportes/eventos`, {
        headers: { Authorization: `Bearer ${obtenerToken() ?? ''}`, Accept: 'text/event-stream' },
        cache: 'no-store',
        signal: control.signal,
      });
      if (r.status === 401 || r.status === 403) return; // el resto del panel ya lleva al login
      if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
      alCambiarEstado('en-vivo');
      espera = ESPERA_MIN_MS;
      const lector = r.body.pipeThrough(new TextDecoderStream()).getReader();
      let resto = '';
      for (;;) {
        const { value, done } = await lector.read();
        if (done) break;
        const leido = leerEventos(resto + value);
        resto = leido.resto;
        for (const e of leido.eventos.filter((x) => x.nombre === 'nuevo-reporte')) {
          try {
            const reporte = JSON.parse(e.datos) as ReporteResumen;
            oyentes.forEach((fn) => fn(reporte));
          } catch { /* un evento mal formado no tumba la conexión */ }
        }
      }
    } catch { /* sin red o se cerró: abajo se reintenta */ }
    if (cerrado) return;
    alCambiarEstado('reconectando');
    reintento = window.setTimeout(conectar, espera);
    espera = Math.min(espera * 2, ESPERA_MAX_MS);
  };

  alCambiarEstado('conectando');
  void conectar();
  return () => {
    cerrado = true;
    control?.abort();
    window.clearTimeout(reintento);
  };
}

// ---------- alerta sonora (Web Audio: sin archivos de sonido) ----------
let audio: AudioContext | undefined;

/**
 * Los navegadores no dejan sonar nada hasta que la persona toca la página. Se llama en el primer
 * clic: desde ahí, los avisos ya pueden sonar.
 */
export function desbloquearSonido(): void {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch { /* navegador sin Web Audio: sin sonido */ }
}

/** Dos tonos cortos ("din-don"). */
export function sonarAviso(): void {
  if (!audio || audio.state !== 'running') return;
  const ahora = audio.currentTime;
  [[880, 0], [1318.5, 0.16]].forEach(([frecuencia, desfase]) => {
    const tono = audio!.createOscillator();
    const volumen = audio!.createGain();
    tono.frequency.value = frecuencia;
    volumen.gain.setValueAtTime(0.0001, ahora + desfase);
    volumen.gain.exponentialRampToValueAtTime(0.25, ahora + desfase + 0.02);
    volumen.gain.exponentialRampToValueAtTime(0.0001, ahora + desfase + 0.3);
    tono.connect(volumen).connect(audio!.destination);
    tono.start(ahora + desfase);
    tono.stop(ahora + desfase + 0.32);
  });
}
