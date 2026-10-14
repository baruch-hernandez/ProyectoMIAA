// Una función por endpoint de reportes. Los componentes nunca escriben URLs a mano.
import axios from 'axios';
import api from './api';
import type { Foto, FotoNueva, Nota, ReporteDetalle, ReporteEdicion, ReporteRequest, ReporteResumen } from '../types/reporte';

export const reportesApi = {
  /** LECTURISTA: sus reportes */
  mios: async () => (await api.get<ReporteResumen[]>('/reportes/mios')).data,

  /** ADMIN: los de todos los empleados */
  todos: async () => (await api.get<ReporteResumen[]>('/reportes')).data,

  detalle: async (id: number) => (await api.get<ReporteDetalle>(`/reportes/${id}`)).data,

  /**
   * timeout de 60 s: con señal mala, mejor rendirse y guardarlo para después
   * (si sí llegó, el clienteId evita que se duplique al reenviarlo).
   */
  crear: async (datos: ReporteRequest) => (await api.post<ReporteDetalle>('/reportes', datos, { timeout: 60_000 })).data,

  /** Corregir domicilio, ubicación o descripción (solo el autor, primeras 24 h) */
  editar: async (id: number, datos: ReporteEdicion) => (await api.put<ReporteDetalle>(`/reportes/${id}`, datos)).data,

  /** Borrar (solo el autor, primeras 24 h) */
  borrar: async (id: number) => {
    await api.delete(`/reportes/${id}`);
  },

  agregarNota: async (id: number, texto: string) =>
    (await api.post<Nota>(`/reportes/${id}/notas`, { texto })).data,

  agregarFoto: async (id: number, foto: FotoNueva) =>
    (await api.post<Foto>(`/reportes/${id}/fotos`, foto)).data,

  borrarFoto: async (id: number, fotoId: number) => {
    await api.delete(`/reportes/${id}/fotos/${fotoId}`);
  },
};

export interface ErrorApi {
  mensaje: string;
  /** Errores por campo que manda @Valid: { calle: "La calle es obligatoria" } */
  errores: Record<string, string>;
  /** Código del backend para casos especiales, p. ej. CUENTA_BLOQUEADA o DEMASIADOS_INTENTOS */
  codigo?: string;
  /** Segundos que hay que esperar antes de reintentar (429 y 423) */
  segundos?: number;
}

/**
 * ¿Falló por la RED (sin señal, servidor inalcanzable, tiempo agotado) y no porque el
 * servidor dijera que algo está mal? Solo en ese caso conviene guardar y reintentar.
 */
export function esErrorDeRed(err: unknown): boolean {
  return axios.isAxiosError(err) && !err.response;
}

/** Convierte cualquier error (axios, red, código) en algo que se pueda mostrar. */
export function leerError(err: unknown): ErrorApi {
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      return { mensaje: 'No se pudo conectar con el servidor. ¿Está corriendo el backend?', errores: {} };
    }
    const data = err.response.data;
    if (typeof data === 'string' && data.trim()) {
      return { mensaje: data, errores: {} };
    }
    return {
      mensaje: data?.message ?? `Error ${err.response.status}`,
      errores: data?.errores ?? {},
      codigo: typeof data?.codigo === 'string' ? data.codigo : undefined,
      segundos: typeof data?.segundos === 'number' ? data.segundos : undefined,
    };
  }
  if (err instanceof Error && err.message) {
    return { mensaje: err.message, errores: {} };
  }
  return { mensaje: 'Ocurrió un error inesperado.', errores: {} };
}
