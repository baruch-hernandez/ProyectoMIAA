import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8080/api/v1', // o tu URL base
});

// Interceptor de peticiones
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  
  // NO enviar cabecera Authorization si la petición es para hacer login
  if (token && config.url && !config.url.includes('/auth/login')) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }
  
  return config;
});

export default api;