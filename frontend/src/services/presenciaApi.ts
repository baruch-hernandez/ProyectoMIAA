import api from './api';
import type { UbicacionNueva } from '../types/reporte';

/**
 * Disponibilidad tipo WhatsApp (tarea 2.4). El backend saca QUIÉN es del token:
 * nadie puede marcar "en línea" a otro.
 */
export const presenciaApi = {
  /** "Sigo aquí", con la ubicación si la hay: cada segundo con la app a la vista (useCompartirUbicacion). */
  latido: async (punto?: UbicacionNueva) => {
    await api.post('/heartbeat', punto, { segundoPlano: true });
  },

  /** La pestaña se ocultó o se apagó la pantalla: sale inactivo al instante. */
  pausar: async () => {
    await api.delete('/yo/conexion', { segundoPlano: true });
  },

  /** Avisa al backend que cerró sesión: sale DESCONECTADO al instante (tarea 2.2). */
  logout: async () => {
    await api.post('/auth/logout');
  },
};

/**
 * Cierra la sesión en el servidor sin hacer esperar al usuario: si no hay red o el servidor
 * no contesta en 1.5 s, se sigue de todos modos (el token se borra igual en el navegador y
 * el backend lo marcará DESCONECTADO solo, cuando deje de recibir latidos).
 */
export async function avisarLogout(): Promise<void> {
  await Promise.race([
    presenciaApi.logout().catch(() => undefined),
    new Promise((listo) => setTimeout(listo, 1500)),
  ]);
}
