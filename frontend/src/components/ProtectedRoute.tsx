import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import {
  obtenerToken,
  obtenerUsuario,
  cerrarSesion,
  RUTA_REQUISITOS,
  tieneRequisitosPendientes,
  guardarAvisoLogin
} from '../utils/sesion';
import type { RolUsuario } from '../utils/sesion';

interface ProtectedRouteProps {
  /** Un solo rol permitido. */
  allowedRole?: RolUsuario | string;
  /** Varios roles permitidos, p. ej. ['ADMIN', 'Administrador']. */
  allowedRoles?: (RolUsuario | string)[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRole, allowedRoles }) => {
  const token = obtenerToken();
  const usuario = obtenerUsuario();

  if (!token || !usuario) {
    return <Navigate to="/" replace />;
  }

  const rolActual = String(usuario.rol).toUpperCase();

  // La web es solo para administradores: los notificadores usan la app
  const esEmpleado = rolActual === 'EMPLEADO' || rolActual === 'NOTIFICADOR' || rolActual === 'LECTURISTA';

  if (esEmpleado) {
    cerrarSesion();
    guardarAvisoLogin(
      'Acceso denegado. Esta plataforma es únicamente para administradores. Por favor ingresa desde la aplicación móvil.'
    );
    return <Navigate to="/" replace />;
  }

  if (tieneRequisitosPendientes(usuario)) {
    return <Navigate to={RUTA_REQUISITOS} replace />;
  }

  const permitidos = allowedRoles ?? (allowedRole ? [allowedRole] : undefined);
  if (permitidos) {
    const permitidosUpper = permitidos.map((r) => String(r).toUpperCase());
    if (!permitidosUpper.includes(rolActual)) {
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
};