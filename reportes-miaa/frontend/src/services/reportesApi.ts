// Una función por endpoint de reportes. Los componentes nunca escriben URLs a mano.
import axios from 'axios';
import api from './api';
import type { Foto, FotoNueva, Nota, ReporteDetalle, ReporteRequest, ReporteResumen } from '../types/reporte';

export const reportesApi = {
  /** LECTURISTA: sus reportes */
  mios: async () => (await api.get<ReporteResumen[]>('/reportes/mios')).data,

  /** ADMIN: los de todos los empleados */
  todos: async () => (await api.get<ReporteResumen[]>('/reportes')).data,

  detalle: async (id: number) => (await api.get<ReporteDetalle>(`/reportes/${id}`)).data,

  crear: async (datos: ReporteRequest) => (await api.post<ReporteDetalle>('/reportes', datos)).data,

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
  if (err instanceof Error && err.message) {
    return { mensaje: err.message, errores: {} };
  }
  return { mensaje: 'Ocurrió un error inesperado.', errores: {} };
}
