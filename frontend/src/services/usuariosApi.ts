import api from './api';
import type { CuentaEmpleado, EdicionEmpleado, EmpleadosRespuesta, NuevoEmpleado, UbicacionEmpleado } from '../types/reporte';

/** Empleados (solo ADMIN). */
export const usuariosApi = {
  /** Lista con actividad, "en línea" y si está dado de baja */
  empleados: async () => (await api.get<EmpleadosRespuesta>('/usuarios/empleados')).data,

  /** Última ubicación y si está en línea */
  ubicacion: async (id: number) => (await api.get<UbicacionEmpleado>(`/usuarios/empleados/${id}/ubicacion`)).data,

  /** Datos de su cuenta */
  cuenta: async (id: number) => (await api.get<CuentaEmpleado>(`/usuarios/empleados/${id}`)).data,

  crear: async (datos: NuevoEmpleado) => (await api.post<CuentaEmpleado>('/usuarios/empleados', datos)).data,

  editar: async (id: number, datos: EdicionEmpleado) =>
    (await api.put<CuentaEmpleado>(`/usuarios/empleados/${id}`, datos)).data,

  restablecerPassword: async (id: number, passwordTemporal: string) =>
    (await api.post<CuentaEmpleado>(`/usuarios/empleados/${id}/password`, { passwordTemporal })).data,

  /** false = dar de baja, true = reactivar */
  cambiarHabilitado: async (id: number, habilitado: boolean) =>
    (await api.put<CuentaEmpleado>(`/usuarios/empleados/${id}/habilitado`, { habilitado })).data,

  /** Quitar el bloqueo por intentos fallidos */
  desbloquear: async (id: number) =>
    (await api.post<CuentaEmpleado>(`/usuarios/empleados/${id}/desbloquear`)).data,
};
