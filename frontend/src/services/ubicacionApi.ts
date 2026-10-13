import api from './api';
import type { UbicacionNueva } from '../types/reporte';

/** El lecturista comparte SU ubicación (el backend saca quién es del token). */
export const ubicacionApi = {
  enviar: async (u: UbicacionNueva) => {
    await api.post('/ubicacion', u);
  },
  /** Al cerrar sesión: deja de aparecer "en línea" de inmediato. */
  dejarDeCompartir: async () => {
    await api.delete('/ubicacion');
  },
};
