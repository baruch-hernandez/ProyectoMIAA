// Cuántas peticiones está esperando el usuario ahorita (la gota de carga se llena mientras sea > 0).
// Las de fondo (latido, ubicación, mapas que se actualizan solos) no cuentan: llevan
// { segundoPlano: true } en su config de axios (ver api.ts).

let pendientes = 0;
const oyentes = new Set<() => void>();

export function cambiarCarga(delta: 1 | -1): void {
  pendientes = Math.max(0, pendientes + delta);
  oyentes.forEach((avisar) => avisar());
}

/** Para useSyncExternalStore */
export function suscribirCarga(avisar: () => void): () => void {
  oyentes.add(avisar);
  return () => { oyentes.delete(avisar); };
}

export const leerCarga = (): number => pendientes;
