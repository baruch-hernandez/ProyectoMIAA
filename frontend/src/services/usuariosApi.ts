import api from './api';
import type { EmpleadosRespuesta, UbicacionEmpleado } from '../types/reporte';

export const usuariosApi = {
  /** GET /usuarios/empleados (solo ADMIN): lecturistas con su actividad */
  empleados: async () => (await api.get<EmpleadosRespuesta>('/usuarios/empleados')).data,

  /** GET /usuarios/empleados/{id}/ubicacion (solo ADMIN): última ubicación y si está en línea */
  ubicacion: async (id: number) => (await api.get<UbicacionEmpleado>(`/usuarios/empleados/${id}/ubicacion`)).data,
};
