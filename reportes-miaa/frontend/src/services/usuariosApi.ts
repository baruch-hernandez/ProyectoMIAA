import api from './api';
import type { EmpleadosRespuesta } from '../types/reporte';

export const usuariosApi = {
  /** GET /usuarios/empleados (solo ADMIN): lecturistas con su actividad */
  empleados: async () => (await api.get<EmpleadosRespuesta>('/usuarios/empleados')).data,
};
