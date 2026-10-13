import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import api from '../services/api';
import { leerError } from '../services/reportesApi';
import { guardarSesion, rutaInicio } from '../utils/sesion';
import type { RolUsuario } from '../utils/sesion';
import { Marca } from './Marca';

interface LoginResponse {
  token: string;
  id: number;
  nombre: string;
  rol: RolUsuario;
}

/** Olas decorativas del panel marino (dibujo propio, no es el logo de MIAA). */
function Olas() {
  return (
    <svg
      className="absolute inset-x-0 bottom-0 w-full h-56 text-white"
      viewBox="0 0 600 220"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d="M0 120 C 100 80, 200 160, 300 120 S 500 80, 600 120 V220 H0Z" fill="currentColor" opacity="0.06" />
      <path d="M0 150 C 120 110, 220 190, 330 150 S 520 110, 600 150 V220 H0Z" fill="currentColor" opacity="0.08" />
      <path d="M0 185 C 140 150, 240 215, 360 182 S 530 150, 600 182 V220 H0Z" fill="#22bcff" opacity="0.35" />
    </svg>
  );
}

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
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

      // Se guarda también el id (antes se perdía y todo caía al id 2)
      guardarSesion(token, { id, nombre, rol });

      // Cada rol tiene su pantalla de inicio (ver utils/sesion.ts)
      navigate(rutaInicio(rol), { replace: true });
    } catch (err) {
      setError(leerError(err).mensaje);
    } finally {
      setLoading(false);
    }
  };

  const claseInput =
    'w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-base text-slate-900 placeholder:text-slate-400 focus:border-miaa-cielo focus:outline-none focus:ring-4 focus:ring-miaa-cielo/20';

  return (
    <div className="min-h-dvh grid lg:grid-cols-[1.1fr_1fr] bg-white">
      {/* Panel institucional (en celular se vuelve una franja arriba) */}
      <section className="relative overflow-hidden bg-miaa-marino text-white px-6 pt-8 pb-28 lg:px-14 lg:py-14 flex flex-col">
        <Marca tono="oscuro" />
        <div className="relative z-10 mt-10 lg:mt-auto lg:mb-24 max-w-md">
          <h1 className="text-3xl lg:text-5xl font-extrabold leading-tight text-balance">
            Reportes de domicilios en campo
          </h1>
          <p className="mt-4 text-miaa-bruma text-base lg:text-lg leading-relaxed">
            Registra lo que ves en cada domicilio y da seguimiento desde tu celular.
          </p>
        </div>
        <Olas />
      </section>

      {/* Formulario */}
      <section className="flex items-center justify-center px-6 py-10 -mt-16 lg:mt-0">
        <div className="w-full max-w-sm bg-white rounded-2xl p-6 lg:p-0 shadow-lg shadow-miaa-marino/10 lg:shadow-none relative z-10">
          <h2 className="text-2xl font-extrabold text-miaa-marino">Inicia sesión</h2>
          <p className="mt-1 text-sm text-slate-600">Uso exclusivo para personal de MIAA.</p>

          {error && (
            <div className="mt-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label htmlFor="login-usuario" className="block text-sm font-semibold text-miaa-marino mb-1.5">
                Usuario o correo
              </label>
              <input
                id="login-usuario"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={claseInput}
                placeholder="lecturista1"
                required
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-semibold text-miaa-marino mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={verPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${claseInput} pr-12`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setVerPassword((v) => !v)}
                  aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-1 top-1 size-10 grid place-items-center rounded-lg text-slate-500 hover:text-miaa-marino"
                >
                  {verPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-miaa-marino text-white font-bold text-base hover:bg-blue-800 active:bg-blue-900 disabled:opacity-60 inline-flex items-center justify-center gap-2 transition-colors"
            >
              {loading && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};
