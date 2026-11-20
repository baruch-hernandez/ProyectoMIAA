import api from './api';
import type { Cuenta } from '../types/reporte';

/** La cuenta de quien tiene la sesión abierta (cualquier rol). */
export const cuentaApi = {
  yo: async () => (await api.get<Cuenta>('/yo')).data,

  cambiarPassword: async (actual: string, nueva: string) =>
    (await api.put<Cuenta>('/yo/password', { actual, nueva })).data,

  aceptarAviso: async (version: string) =>
    (await api.post<Cuenta>('/yo/aviso', { version })).data,

  /** "Olvidé mi contraseña" (sin sesión): manda un código al correo. Responde igual exista o no la cuenta. */
  olvidePassword: async (usuario: string) => {
    await api.post('/auth/password/olvide', { usuario });
  },

  restablecerPassword: async (usuario: string, codigo: string, nueva: string) => {
    await api.post('/auth/password/restablecer', { usuario, codigo, nueva });
  },
};
