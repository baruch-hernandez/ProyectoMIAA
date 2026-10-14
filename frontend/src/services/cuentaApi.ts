import api from './api';
import type { Cuenta } from '../types/reporte';

/** La cuenta de quien tiene la sesión abierta (cualquier rol). */
export const cuentaApi = {
  yo: async () => (await api.get<Cuenta>('/usuarios/yo')).data,

  cambiarPassword: async (actual: string, nueva: string) =>
    (await api.put<Cuenta>('/usuarios/yo/password', { actual, nueva })).data,

  aceptarAviso: async (version: string) =>
    (await api.post<Cuenta>('/usuarios/yo/aviso-privacidad', { version })).data,
};
