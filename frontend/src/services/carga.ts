// Cuántas peticiones está esperando el usuario ahorita (la gota de carga se llena mientras sea > 0).
// Las de fondo (latido, ubicación, mapas que se actualizan solos) no cuentan: llevan
// { segundoPlano: true } en su config de axios (ver api.ts).

let pendientes = 0;
let destellos = 0;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((oyente) => oyente());

export function cambiarCarga(delta: 1 | -1): void {
  pendientes = Math.max(0, pendientes + delta);
  avisar();
}

/** Cuánto se ve la gota, como mínimo, al cambiar de pantalla o recargar. */
export const DESTELLO_MS = 700;

/**
 * Muestra la gota de inmediato (sin esperar el retraso) y al menos DESTELLO_MS, aunque lo que se
 * cargue llegue rápido: al abrir o recargar la página, cambiar de pantalla o dar "Actualizar".
 * Devuelve cómo quitarlo antes (para la limpieza de un useEffect).
 */
export function destelloCarga(): () => void {
  destellos++;
  pendientes++;
  avisar();
  let vivo = true;
  const quitar = () => {
    if (!vivo) return;
    vivo = false;
    window.clearTimeout(t);
    destellos--;
    pendientes = Math.max(0, pendientes - 1);
    avisar();
  };
  const t = window.setTimeout(quitar, DESTELLO_MS);
  return quitar;
}

/** Para useSyncExternalStore */
export function suscribirCarga(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => { oyentes.delete(oyente); };
}

export const leerCarga = (): number => pendientes;
export const hayDestello = (): boolean => destellos > 0;
