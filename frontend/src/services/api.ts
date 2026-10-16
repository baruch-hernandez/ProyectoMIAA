import axios from 'axios';
import { cerrarSesion, guardarAvisoLogin, obtenerToken, RUTA_REQUISITOS } from '../utils/sesion';

// Cambiar https://localhost:8500 por http://localhost:8090
const URL_API: string = import.meta.env.VITE_API_URL || 'http://localhost:8500';

if (import.meta.env.PROD && URL_API.startsWith('http://')) {
  console.error(`[MIAA] VITE_API_URL usa http:// (${URL_API}). En producción debe ser https://`);
}

const api = axios.create({ baseURL: URL_API });

// ---------- Antes de cada petición: agregar el token ----------
api.interceptors.request.use((config) => {
  const token = obtenerToken();

  // NO enviar cabecera Authorization en peticiones de autenticación/login
  if (token && config.url && !config.url.includes('/auth/login')) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }

  return config;
});

// ---------- Después de cada respuesta: si el token ya no sirve, al login ----------
api.interceptors.response.use(
  (response) => response,
  (error) => {
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