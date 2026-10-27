import type { RolUsuario } from './sesion';

/** Los roles que el administrador puede asignar (los mismos de la tabla "roles" del backend). */
export const ROLES: { clave: RolUsuario; nombre: string; descripcion: string }[] = [
  {
    clave: 'NOTIFICADOR',
    nombre: 'Notificador',
    descripcion: 'Trabaja en campo con la app del celular: sube reportes con ubicación y fotos.',
  },
  {
    clave: 'ADMIN',
    nombre: 'Administrador',
    descripcion: 'Usa este panel web: consulta todos los reportes y administra a los empleados.',
  },
];

export function nombreRol(rol: string | null | undefined): string {
  return ROLES.find((r) => r.clave === rol)?.nombre ?? (rol ?? '—');
}
