// Una función por endpoint de quejas. Los componentes nunca escriben URLs a mano.
import axios from 'axios';
import api from './api';
import type { EstadoQueja, Nota, QuejaDetalle, QuejaRequest, QuejaResumen } from '../types/queja';

export const quejasApi = {
  misQuejas: async (estado?: EstadoQueja) =>
    (await api.get<QuejaResumen[]>('/quejas/mias', { params: estado ? { estado } : undefined })).data,

  detalle: async (id: number) => (await api.get<QuejaDetalle>(`/quejas/${id}`)).data,

  crear: async (datos: QuejaRequest) => (await api.post<QuejaDetalle>('/quejas', datos)).data,

  agregarNota: async (id: number, texto: string) =>
    (await api.post<Nota>(`/quejas/${id}/notas`, { texto })).data,
};

export interface ErrorApi {
  mensaje: string;
  /** Errores por campo que manda @Valid: { calle: "La calle es obligatoria" } */
  errores: Record<string, string>;
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
    };
  }
  return { mensaje: 'Ocurrió un error inesperado.', errores: {} };
}
