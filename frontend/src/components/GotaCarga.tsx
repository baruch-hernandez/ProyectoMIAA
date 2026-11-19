import { useEffect, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { destelloCarga, hayDestello, leerCarga, suscribirCarga } from '../services/carga';

/** Antes de esto no se muestra una petición: una respuesta rápida no hace parpadear la pantalla
 *  (salvo un destello: al abrir o recargar la página, cambiar de pantalla o dar "Actualizar"). */
const RETRASO_MS = 300;
/** Mientras espera, el agua sube sola hacia este nivel sin llegar nunca (no sabemos cuánto falta). */
const TOPE_ESPERANDO = 0.9;
const PASO_MS = 120;
/** Ya terminó: se ve llena un momento y se desvanece. */
const LLENA_MS = 350;

// Gota de 80×118: punta arriba y abajo un círculo de radio 40 con centro en y=78
const GOTA = 'M40 2 C40 20 78 52 78 78 A38 38 0 0 1 2 78 C2 52 40 20 40 2 Z';
const ALTO = 118;

type Fase = 'oculta' | 'llenando' | 'llena';

/**
 * Pantalla de carga de MIAA: una gota que se llena de agua mientras el usuario espera una
 * respuesta del servidor (cualquier petición de api.ts que no sea de segundo plano), y un momento
 * cada vez que se abre, recarga o cambia la pantalla.
 * Va una sola vez en App, encima de todas las pantallas (admin, notificador y login), y tapa
 * la pantalla para que no se mande dos veces lo mismo mientras tanto.
 */
export function GotaCarga() {
  const pendientes = useSyncExternalStore(suscribirCarga, leerCarga);
  const inmediata = useSyncExternalStore(suscribirCarga, hayDestello);
  const { pathname } = useLocation();
  const [fase, setFase] = useState<Fase>('oculta');
  const [nivel, setNivel] = useState(0);

  // Al abrir o recargar la página y en cada cambio de pantalla
  useEffect(() => destelloCarga(), [pathname]);

  // oculta --(espera más de RETRASO_MS)--> llenando --(ya no espera nada)--> llena --> oculta.
  // Si llega otra petición mientras se desvanece, termina de irse y vuelve a aparecer después.
  // Los setState van dentro de temporizadores, no directo en el efecto.
  const esperando = pendientes > 0;
  useEffect(() => {
    let t: number | undefined;
    if (fase === 'oculta' && esperando) {
      t = window.setTimeout(() => { setNivel(0.08); setFase('llenando'); }, inmediata ? 0 : RETRASO_MS);
    } else if (fase === 'llenando' && !esperando) {
      t = window.setTimeout(() => { setNivel(1); setFase('llena'); }, 0);
    } else if (fase === 'llena') {
      t = window.setTimeout(() => setFase('oculta'), LLENA_MS);
    }
    return () => window.clearTimeout(t);
  }, [esperando, fase, inmediata]);

  // El agua sube poco a poco: cada paso recorre una parte de lo que falta para el tope
  useEffect(() => {
    if (fase !== 'llenando') return;
    const t = window.setInterval(() => setNivel((n) => n + (TOPE_ESPERANDO - n) * 0.035), PASO_MS);
    return () => window.clearInterval(t);
  }, [fase]);

  if (fase === 'oculta') return null;

  const arriba = ALTO * (1 - nivel);
  return (
    <div
      data-gota-carga
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-[2000] flex flex-col items-center justify-center gap-3 bg-white/70 backdrop-blur-[2px] transition-opacity duration-300 ${fase === 'llena' ? 'opacity-0' : 'opacity-100'}`}
    >
      <svg viewBox="0 0 80 118" className="h-28 w-auto drop-shadow-sm" aria-hidden="true">
        <defs>
          <clipPath id="gota-carga-forma">
            <path d={GOTA} />
          </clipPath>
          <linearGradient id="gota-carga-agua" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#22bcff" />
            <stop offset="1" stopColor="#074376" />
          </linearGradient>
        </defs>
        <path d={GOTA} fill="#eef6fb" />
        <g clipPath="url(#gota-carga-forma)">
          <g className="gota-nivel" style={{ transform: `translateY(${arriba - 6}px)` }}>
            {/* Dos olas de 80 de ancho: al recorrerse 80 a la izquierda se repite sin que se note */}
            <path className="gota-ola" d="M0 6 Q20 0 40 6 T80 6 T120 6 T160 6 V130 H0 Z" fill="url(#gota-carga-agua)" />
          </g>
        </g>
        <path d={GOTA} fill="none" stroke="#074376" strokeWidth="3" strokeLinejoin="round" />
      </svg>
      <p className="text-sm font-semibold text-miaa-marino">Cargando…</p>
    </div>
  );
}
