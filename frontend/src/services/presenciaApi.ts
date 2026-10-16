import api from './api';

/**
 * Disponibilidad tipo WhatsApp (tarea 2.4). El backend saca QUIÉN es del token:
 * nadie puede marcar "en línea" a otro.
 */
export const presenciaApi = {
  /** "Sigo aquí": se manda cada 30 s mientras la app esté abierta (usePresencia). */
  latido: async () => {
    await api.post('/usuarios/yo/conexion');
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
export async function avisarLogout(extra: Promise<unknown>[] = []): Promise<void> {
  await Promise.race([
    Promise.allSettled([presenciaApi.logout(), ...extra]),
    new Promise((listo) => setTimeout(listo, 1500)),
  ]);
}
