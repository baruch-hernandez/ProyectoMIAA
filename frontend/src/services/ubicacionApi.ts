import api from './api';
import type { UbicacionNueva } from '../types/reporte';

/** El notificador comparte SU ubicación (el backend saca quién es del token). */
export const ubicacionApi = {
  enviar: async (u: UbicacionNueva) => {
    await api.post('/usuarios/heartbeat', u); // también cuenta como latido
  },
  /** Al cerrar sesión: deja de aparecer "en línea" de inmediato. */
  dejarDeCompartir: async () => {
    await api.delete('/ubicacion');
  },
};
