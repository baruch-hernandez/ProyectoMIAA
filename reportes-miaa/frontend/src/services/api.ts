import axios from 'axios';
import { cerrarSesion, obtenerToken } from '../utils/sesion';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8500',
});

// ---------- Antes de cada petición: agregar el token ----------
api.interceptors.request.use((config) => {
  const token = obtenerToken();

  // NO enviar cabecera Authorization si la petición es para hacer login
  if (token && config.url && !config.url.includes('/auth/login')) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }

  return config;
});

// ---------- Después de cada respuesta: si el token ya no sirve, al login ----------
// El backend responde 401 cuando el JWT venció (24 h) o es inválido.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const esLogin = String(error?.config?.url ?? '').includes('/auth/login');

    if (error?.response?.status === 401 && !esLogin) {
      cerrarSesion();
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
