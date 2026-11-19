import api from './api';
import type { CuentaEmpleado, EdicionEmpleado, EmpleadosRespuesta, NuevoEmpleado, UbicacionEmpleado } from '../types/reporte';

export const usuariosApi = {
  /** Lista con actividad, "en línea" y si está dado de baja. segundoPlano = refresco automático (sin gota de carga) */
  empleados: async (segundoPlano = false) => (await api.get<EmpleadosRespuesta>('/empleados', { segundoPlano })).data,

  ubicacion: async (id: number) => (await api.get<UbicacionEmpleado>(`/empleados/${id}/ubicacion`, { segundoPlano: true })).data, // se consulta cada segundo

  /** Mapa de cuadrillas: los notificadores con su estado, última ubicación, dirección y última conexión */
  ubicaciones: async () => (await api.get<UbicacionEmpleado[]>('/cuadrillas', { segundoPlano: true })).data, // cada segundo

  cuenta: async (id: number) => (await api.get<CuentaEmpleado>(`/empleados/${id}`)).data,

  crear: async (datos: NuevoEmpleado) => (await api.post<CuentaEmpleado>('/empleados', datos)).data,

  editar: async (id: number, datos: EdicionEmpleado) =>
    (await api.put<CuentaEmpleado>(`/empleados/${id}`, datos)).data,

  restablecerPassword: async (id: number, passwordTemporal: string) =>
    (await api.post<CuentaEmpleado>(`/empleados/${id}/password`, { passwordTemporal })).data,

  /** false = dar de baja, true = reactivar */
  cambiarHabilitado: async (id: number, habilitado: boolean) =>
    (await api.put<CuentaEmpleado>(`/empleados/${id}/habilitado`, { habilitado })).data,

  desbloquear: async (id: number) =>
    (await api.post<CuentaEmpleado>(`/empleados/${id}/desbloquear`)).data,
};
