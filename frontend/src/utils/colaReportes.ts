// Reportes que no se pudieron enviar por falta de señal: se guardan EN EL CELULAR y se
// envían solos cuando vuelve la conexión.
//
// ¿Por qué IndexedDB y no localStorage? Un reporte con 3 fotos pesa 1–4 MB y localStorage
// se llena con ~5 MB. IndexedDB aguanta cientos de MB y guarda objetos tal cual.
//
// ¿Y si se envía dos veces? Cada reporte lleva un clienteId (UUID) generado al llenarlo.
// Si el servidor ya lo había recibido (p. ej. llegó pero se cortó la respuesta), lo
// reconoce y NO lo duplica.
import axios from 'axios';
import { esErrorDeRed, leerError, reportesApi } from '../services/reportesApi';
import type { ReporteRequest } from '../types/reporte';

export interface ReportePendiente {
  clienteId: string;
  /** De quién es (si otro notificador entra en el mismo celular, no se mezclan) */
  usuarioId: number;
  guardadoEn: string; // ISO
  datos: ReporteRequest;
  /** El SERVIDOR lo rechazó (no fue la red): no se reintenta solo, el notificador decide */
  error?: string;
  intentos: number;
}

const BD = 'miaa';
const VERSION_BD = 1;
const ALMACEN = 'reportesPendientes';

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const solicitud = indexedDB.open(BD, VERSION_BD);
    solicitud.onupgradeneeded = () => {
      // Solo corre la primera vez (o al subir VERSION_BD): crea el "almacén"
      solicitud.result.createObjectStore(ALMACEN, { keyPath: 'clienteId' });
    };
    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
  });
}

/** Una operación dentro de una transacción, como promesa. */
async function operar<T>(modo: IDBTransactionMode, fn: (almacen: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const bd = await abrir();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = bd.transaction(ALMACEN, modo);
      const solicitud = fn(tx.objectStore(ALMACEN));
      tx.oncomplete = () => resolve(solicitud.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    bd.close();
  }
}

// ---------- avisos de cambio (para que las pantallas se actualicen) ----------
const oyentes = new Set<() => void>();
export function alCambiarCola(fn: () => void): () => void {
  oyentes.add(fn);
  return () => { oyentes.delete(fn); };
}
function notificar() {
  oyentes.forEach((fn) => fn());
}

// ---------- operaciones ----------
export async function guardarPendiente(p: ReportePendiente): Promise<void> {
  await operar('readwrite', (a) => a.put(p));
  notificar();
}

export async function listarPendientes(usuarioId: number): Promise<ReportePendiente[]> {
  const todos = await operar('readonly', (a) => a.getAll() as IDBRequest<ReportePendiente[]>);
  return todos
    .filter((p) => p.usuarioId === usuarioId)
    .sort((x, y) => x.guardadoEn.localeCompare(y.guardadoEn)); // los más viejos primero
}

export async function descartarPendiente(clienteId: string): Promise<void> {
  await operar('readwrite', (a) => a.delete(clienteId));
  notificar();
}

// ---------- envío ----------
let enCurso: Promise<number> | null = null;

/**
 * Intenta enviar los pendientes de este usuario, del más viejo al más nuevo.
 *  - Si falla por la RED: se detiene (sigue sin señal; se reintenta después).
 *  - Si el SERVIDOR lo rechaza (400/409…): lo marca con el error y sigue con los demás.
 *  - 401/403 (sesión vencida, requisitos pendientes): se detiene sin marcar nada.
 * Los marcados con error solo se reintentan si `incluirRechazados` (botón "Enviar ahora").
 * Regresa cuántos se enviaron. Si ya hay un envío en curso, regresa ese mismo.
 */
export function enviarPendientes(usuarioId: number, incluirRechazados = false): Promise<number> {
  if (enCurso) return enCurso;
  enCurso = (async () => {
    let enviados = 0;
    for (const p of await listarPendientes(usuarioId)) {
      if (p.error && !incluirRechazados) continue;
      try {
        await reportesApi.crear({ ...p.datos, clienteId: p.clienteId });
        await operar('readwrite', (a) => a.delete(p.clienteId));
        enviados++;
      } catch (err) {
        const status = axios.isAxiosError(err) ? err.response?.status : undefined;
        if (esErrorDeRed(err) || status === 401 || status === 403) break;
        await operar('readwrite', (a) => a.put({ ...p, error: leerError(err).mensaje, intentos: p.intentos + 1 }));
      }
    }
    notificar();
    return enviados;
  })().finally(() => { enCurso = null; });
  return enCurso;
}
