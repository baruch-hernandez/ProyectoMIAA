import axios from 'axios';
import { cerrarSesion, guardarAvisoLogin, obtenerToken, RUTA_REQUISITOS } from '../utils/sesion';

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
// El backend responde 401 cuando el JWT venció (24 h), es inválido o la cuenta fue dada de baja.
// 403 con codigo REQUISITO_PENDIENTE: debe cambiar su contraseña o aceptar el aviso.
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
