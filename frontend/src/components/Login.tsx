import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { leerError } from '../services/quejasApi';
import { guardarSesion, rutaInicio } from '../utils/sesion';
import type { RolUsuario } from '../utils/sesion';

interface LoginResponse {
  token: string;
  id: number;
  nombre: string;
  rol: RolUsuario;
}

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post<LoginResponse>('/auth/login', { username, password });
      const { token, id, nombre, rol } = response.data;

      // Ahora también se guarda el id (antes se perdía y todo caía al id 2)
      guardarSesion(token, { id, nombre, rol });

      // Cada rol tiene su pantalla de inicio (ver utils/sesion.ts)
      navigate(rutaInicio(rol), { replace: true });
    } catch (err) {
      setError(leerError(err).mensaje);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 border border-slate-200">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-900">MIAA</h1>
          <p className="text-slate-500 text-sm mt-1">Modelo Integral de Aguas de Aguascalientes</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 text-sm rounded" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="login-usuario" className="block text-sm font-medium text-slate-700 mb-1">Usuario</label>
            <input
              id="login-usuario"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Ej. admin o lecturista1"
              required
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition duration-200 shadow-md disabled:bg-blue-300"
          >
            {loading ? 'Iniciando sesión...' : 'Ingresar al Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
};
