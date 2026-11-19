import axios from 'axios';
import { cerrarSesion, guardarAvisoLogin, obtenerToken, RUTA_REQUISITOS } from '../utils/sesion';
import { cambiarCarga } from './carga';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** true = petición de fondo (latido, ubicación, refresco automático): no muestra la gota de carga */
    segundoPlano?: boolean;
    /** uso interno: ya se contó en la gota de carga */
    cargaContada?: boolean;
  }
}

export const URL_API: string = import.meta.env.VITE_API_URL || 'http://localhost:8500/api';

if (import.meta.env.PROD && URL_API.startsWith('http://')) {
  console.error(`[MIAA] VITE_API_URL usa http:// (${URL_API}). En producción debe ser https://`);
}

const api = axios.create({ baseURL: URL_API });

api.interceptors.request.use((config) => {
  const token = obtenerToken();

  // NO enviar cabecera Authorization en peticiones de autenticación/login
  if (token && config.url && !config.url.includes('/auth/login')) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }

  if (!config.segundoPlano) {
    config.cargaContada = true;
    cambiarCarga(1);
  }
  return config;
});

/** La petición terminó (bien o mal): la gota deja de contarla. */
function terminarCarga(config?: { cargaContada?: boolean }) {
  if (config?.cargaContada) {
    config.cargaContada = false;
    cambiarCarga(-1);
  }
}

// ---------- Después de cada respuesta: si el token ya no sirve, al login ----------
api.interceptors.response.use(
  (response) => {
    terminarCarga(response.config);
    return response;
  },
  (error) => {
    terminarCarga(error?.config);
    const esLogin = String(error?.config?.url ?? '').includes('/auth/login');
    const status = error?.response?.status;
    const codigo = error?.response?.data?.codigo;

    if (status === 401 && !esLogin) {
      if (codigo === 'CUENTA_DESHABILITADA') guardarAvisoLogin(error.response.data.message);
      cerrarSesion();
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    } else if (status === 403 && codigo === 'REQUISITO_PENDIENTE' && window.location.pathname !== RUTA_REQUISITOS) {
      window.location.href = RUTA_REQUISITOS;
    }
    return Promise.reject(error);
  },
);

export default api;