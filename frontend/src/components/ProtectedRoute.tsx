import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

interface ProtectedRouteProps {
  allowedRole?: 'ADMIN' | 'LECTURISTA';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRole }) => {
  const token = localStorage.getItem('token');
  const usuarioRaw = localStorage.getItem('usuario');

  // 1. Si no hay token registrado, redirige al Login
  if (!token || !usuarioRaw) {
    return <Navigate to="/" replace />;
  }

  const usuario = JSON.parse(usuarioRaw);

  // 2. Si se requiere un rol específico y el usuario no lo tiene
  if (allowedRole && usuario.rol !== allowedRole) {
    // Redirige al panel correspondiente según su rol real
    return usuario.rol === 'ADMIN' 
      ? <Navigate to="/admin" replace /> 
      : <Navigate to="/lecturas" replace />;
  }

  // Si todo es correcto, renderiza el componente hijo
  return <Outlet />;
};