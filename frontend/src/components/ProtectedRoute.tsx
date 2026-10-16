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

/**
 * Tarea 3.3: Ruteo Protegido y Redirección por Rol en la Web MIAA.
 * Garantiza que solo Administradores puedan ingresar al panel Web.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRole, allowedRoles }) => {
  const token = obtenerToken();
  const usuario = obtenerUsuario();

  // Tarea 3.3 Paso 2.1: Si no existe JWT, redirige al login
  if (!token || !usuario) {
    return <Navigate to="/" replace />;
  }

  // Normalización del rol del usuario
  const rolActual = String(usuario.rol).toUpperCase();

  // Tarea 3.3 Paso 3: Bloqueo estricto para Empleados / Notificadores en plataforma Web
  const esEmpleado = rolActual === 'EMPLEADO' || rolActual === 'NOTIFICADOR' || rolActual === 'LECTURISTA';

  if (esEmpleado) {
    // Borrar la sesión y guardar el mensaje de restricción
    cerrarSesion();
    guardarAvisoLogin(
      'Acceso denegado. Esta plataforma es únicamente para administradores. Por favor ingresa desde la aplicación móvil.'
    );
    return <Navigate to="/" replace />;
  }

  // Tarea 3.3 Paso 2.2: Redirección por requisitos pendientes
  if (tieneRequisitosPendientes(usuario)) {
    return <Navigate to={RUTA_REQUISITOS} replace />;
  }

  // Tarea 3.3 Paso 3: Validación por roles permitidos pasados por props
  const permitidos = allowedRoles ?? (allowedRole ? [allowedRole] : undefined);
  if (permitidos) {
    const permitidosUpper = permitidos.map((r) => String(r).toUpperCase());
    if (!permitidosUpper.includes(rolActual)) {
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
};