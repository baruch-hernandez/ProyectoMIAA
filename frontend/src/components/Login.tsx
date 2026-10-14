import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LoaderCircle, Lock, Timer } from 'lucide-react';
import api from '../services/api';
import { leerError } from '../services/reportesApi';
import { guardarSesion, rutaInicio, leerAvisoLogin } from '../utils/sesion';
import type { RolUsuario } from '../utils/sesion';
import { Marca } from './Marca';

interface LoginResponse {
  token: string;
  id: number;
  nombre: string;
  rol: RolUsuario;
  debeCambiarPassword: boolean;
  avisoPrivacidadPendiente: boolean;
}

/** 125 → "2:05" */
function formatoEspera(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
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
  // Si la sesión anterior terminó por algo (p. ej. "tu cuenta fue dada de baja"), se muestra aquí
  const [error, setError] = useState(() => leerAvisoLogin() ?? '');
  const [loading, setLoading] = useState(false);
  // Protección contra fuerza bruta: el backend responde 429 (demasiados intentos desde este equipo)
  // o 423 (cuenta bloqueada) con los segundos que hay que esperar.
  const [codigoError, setCodigoError] = useState<string | undefined>();
  const [esperaHasta, setEsperaHasta] = useState<number | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const navigate = useNavigate();

  // Cuenta regresiva mientras haya que esperar
  useEffect(() => {
    if (esperaHasta === null) return;
    const reloj = window.setInterval(() => {
      const n = Date.now();
      setAhora(n);
      if (n >= esperaHasta) {
        setEsperaHasta(null);
        setError('Ya puedes volver a intentar.');
        setCodigoError('LISTO');
      }
    }, 1000);
    return () => window.clearInterval(reloj);
  }, [esperaHasta]);

  const segundosRestantes = esperaHasta === null ? 0 : Math.max(0, Math.ceil((esperaHasta - ahora) / 1000));
  // Solo el rate limit (429) bloquea el botón: con la cuenta bloqueada (423) el servidor
  // vuelve a decir que espere, y si el admin la desbloquea puede entrar de inmediato.
  const botonEnEspera = codigoError === 'DEMASIADOS_INTENTOS' && segundosRestantes > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (botonEnEspera) return;
    setError('');
    setCodigoError(undefined);
    setEsperaHasta(null);
    setLoading(true);

    try {
      const response = await api.post<LoginResponse>('/auth/login', { username, password });
      const { token, id, nombre, rol, debeCambiarPassword, avisoPrivacidadPendiente } = response.data;
      const usuario = { id, nombre, rol, debeCambiarPassword, avisoPrivacidadPendiente };

      // Se guarda también el id (antes se perdía y todo caía al id 2)
      guardarSesion(token, usuario);

      // Cada rol tiene su pantalla de inicio; si tiene requisitos pendientes
      // (contraseña temporal o aviso de privacidad), primero va a resolverlos.
      navigate(rutaInicio(rol, usuario), { replace: true });
    } catch (err) {
      const { mensaje, codigo, segundos } = leerError(err);
      setError(mensaje);
      setCodigoError(codigo);
      if ((codigo === 'DEMASIADOS_INTENTOS' || codigo === 'CUENTA_BLOQUEADA') && segundos) {
        const n = Date.now();
        setAhora(n);
        setEsperaHasta(n + segundos * 1000);
      }
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

          {error && codigoError === 'LISTO' && (
            <div className="mt-5 p-3 rounded-xl bg-[#d3fbf2] text-[#0b6b58] text-sm font-medium" role="status">
              {error}
            </div>
          )}
          {error && (codigoError === 'CUENTA_BLOQUEADA' || codigoError === 'DEMASIADOS_INTENTOS') && (
            <div className="mt-5 p-3 rounded-xl bg-amber-50 border border-amber-300 text-[#6b4a00] text-sm flex gap-2.5" role="alert">
              {codigoError === 'CUENTA_BLOQUEADA'
                ? <Lock size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
                : <Timer size={18} className="shrink-0 mt-0.5" aria-hidden="true" />}
              <div>
                <p className="font-semibold">{codigoError === 'CUENTA_BLOQUEADA' ? 'Cuenta bloqueada' : 'Demasiados intentos'}</p>
                <p>{error}</p>
                {segundosRestantes > 0 && (
                  <p className="mt-1 font-semibold cifras" aria-live="off">Tiempo restante: {formatoEspera(segundosRestantes)}</p>
                )}
              </div>
            </div>
          )}
          {error && !['LISTO', 'CUENTA_BLOQUEADA', 'DEMASIADOS_INTENTOS'].includes(codigoError ?? '') && (
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
              disabled={loading || botonEnEspera}
              className="w-full h-12 rounded-xl bg-miaa-marino text-white font-bold text-base hover:bg-blue-800 active:bg-blue-900 disabled:opacity-60 inline-flex items-center justify-center gap-2 transition-colors"
            >
              {loading && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
              {loading ? 'Entrando…' : botonEnEspera ? `Espera ${formatoEspera(segundosRestantes)}` : 'Entrar'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};
