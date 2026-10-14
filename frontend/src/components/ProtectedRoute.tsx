import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { obtenerToken, obtenerUsuario, rutaInicio, RUTA_REQUISITOS, tieneRequisitosPendientes } from '../utils/sesion';
import type { RolUsuario } from '../utils/sesion';

interface ProtectedRouteProps {
  /** Un solo rol permitido (como se usaba antes). */
  allowedRole?: RolUsuario;
  /** Varios roles permitidos, p. ej. ['ADMIN', 'LECTURISTA']. */
  allowedRoles?: RolUsuario[];
}

/**
 * Protege rutas en el FRONT. Ojo: esto solo es comodidad visual; cualquiera
 * puede editar su sessionStorage. La seguridad REAL la pone el backend con el JWT.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRole, allowedRoles }) => {
  const token = obtenerToken();
  const usuario = obtenerUsuario();

  // 1. Sin sesión → al login
  if (!token || !usuario) {
    return <Navigate to="/" replace />;
  }

  // 2. Le falta cambiar su contraseña temporal o aceptar el aviso → a resolverlo primero
  //    (el backend tampoco le deja hacer nada más: responde 403 REQUISITO_PENDIENTE)
  if (tieneRequisitosPendientes(usuario)) {
    return <Navigate to={RUTA_REQUISITOS} replace />;
  }

  // 3. Con sesión pero sin el rol requerido → a la pantalla de SU rol
  const permitidos = allowedRoles ?? (allowedRole ? [allowedRole] : undefined);
  if (permitidos && !permitidos.includes(usuario.rol)) {
    return <Navigate to={rutaInicio(usuario.rol)} replace />;
  }

  return <Outlet />;
};
