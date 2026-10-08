import api from './api';
import type { LecturistaResumen } from '../utils/rutas';

export const usuariosApi = {
  /** GET /usuarios/lecturistas (solo ADMIN) */
  lecturistas: async () => (await api.get<LecturistaResumen[]>('/usuarios/lecturistas')).data,
};
