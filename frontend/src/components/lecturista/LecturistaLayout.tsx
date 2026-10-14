import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ClipboardList, KeyRound, LogOut, MapPin, MapPinOff, Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cerrarSesion, obtenerUsuario } from '../../utils/sesion';
import { ubicacionApi } from '../../services/ubicacionApi';
import type { EstadoUbicacion } from '../../hooks/useCompartirUbicacion';
import { useCompartirUbicacion } from '../../hooks/useCompartirUbicacion';
import { useColaReportes } from '../../hooks/useColaReportes';
import { Marca } from '../Marca';

interface Destino {
  to: string;
  texto: string;
  icono: LucideIcon;
  end?: boolean;
  destacado?: boolean;
}

const DESTINOS: Destino[] = [
  { to: '/reportes', texto: 'Mis reportes', icono: ClipboardList, end: true },
  { to: '/reportes/nuevo', texto: 'Nuevo reporte', icono: Plus, destacado: true },
];

const TEXTO_UBICACION: Record<EstadoUbicacion, { corto: string; activa: boolean }> = {
  iniciando: { corto: 'Activando ubicación…', activa: false },
  compartiendo: { corto: 'Ubicación activa', activa: true },
  'sin-permiso': { corto: 'Ubicación desactivada', activa: false },
  'no-disponible': { corto: 'Sin ubicación', activa: false },
  error: { corto: 'Sin señal GPS', activa: false },
};

/**
 * Indicador SIEMPRE visible de que se comparte la ubicación (transparencia: el
 * empleado debe saberlo). Al tocarlo explica qué se comparte y qué no.
 */
function IndicadorUbicacion({ estado }: { estado: EstadoUbicacion }) {
  const [abierto, setAbierto] = useState(false);
  const { corto, activa } = TEXTO_UBICACION[estado];
  const Icono = activa || estado === 'iniciando' ? MapPin : MapPinOff;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-controls="info-ubicacion"
        className={`inline-flex items-center gap-1.5 h-9 px-2.5 rounded-full text-xs font-bold transition-colors ${
          activa ? 'bg-[#d3fbf2] text-[#0b6b58]' : estado === 'iniciando' ? 'bg-slate-100 text-slate-600' : 'bg-[#fff4cc] text-[#7a5600]'
        }`}
      >
        {activa ? (
          <span className="relative flex size-2" aria-hidden="true">
            <span className="absolute inline-flex size-full rounded-full bg-miaa-menta opacity-75 animate-ping" />
            <span className="relative inline-flex size-2 rounded-full bg-[#0fa987]" />
          </span>
        ) : (
          <Icono size={14} aria-hidden="true" />
        )}
        <span className="hidden sm:inline">{corto}</span>
        <span className="sm:hidden">{activa ? 'GPS' : 'GPS off'}</span>
      </button>

      {abierto && (
        <div
          id="info-ubicacion"
          role="dialog"
          aria-label="Ubicación compartida"
          className="absolute right-0 mt-2 w-72 rounded-2xl bg-white border border-slate-200 shadow-xl shadow-miaa-marino/10 p-4 text-sm text-slate-700 z-40"
        >
          <p className="font-bold text-miaa-marino">{corto}</p>
          <p className="mt-1.5 leading-relaxed">
            Mientras tengas la app abierta, tu jefe puede ver <strong>dónde estás ahorita</strong> para coordinar el
            trabajo de campo. No se guarda tu recorrido, solo la última ubicación, y deja de compartirse al cerrar sesión.
          </p>
          {estado === 'sin-permiso' && (
            <p className="mt-2 leading-relaxed text-[#7a5600]">
              No diste permiso de ubicación. Para activarlo, toca el candado junto a la dirección del navegador y permite la ubicación.
            </p>
          )}
          <button type="button" onClick={() => setAbierto(false)} className="mt-3 h-9 px-3 rounded-lg font-semibold text-miaa-azul hover:bg-slate-100">
            Entendido
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Marco de las pantallas del lecturista.
 *  - Escritorio: menú en la barra superior.
 *  - Celular: barra inferior fija, al alcance del pulgar (se usa en la calle).
 */
export function LecturistaLayout() {
  const navigate = useNavigate();
  const usuario = obtenerUsuario();
  const estadoUbicacion = useCompartirUbicacion();
  // Envía solos los reportes guardados sin conexión (al abrir, al volver la red, cada minuto)
  useColaReportes({ automatico: true });

  const salir = async () => {
    // Avisar que deja de compartir (máx. 1.5 s: si no hay red, salimos de todos modos)
    await Promise.race([
      ubicacionApi.dejarDeCompartir().catch(() => undefined),
      new Promise((listo) => setTimeout(listo, 1500)),
    ]);
    cerrarSesion();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-dvh bg-miaa-fondo">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Marca />

          <nav className="hidden md:flex items-center gap-1" aria-label="Principal">
            {DESTINOS.map(({ to, texto, icono: Icono, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 h-10 px-3.5 rounded-xl text-sm font-semibold transition-colors ${
                    isActive ? 'bg-miaa-bruma/60 text-miaa-marino' : 'text-slate-600 hover:text-miaa-marino hover:bg-slate-100'
                  }`
                }
              >
                <Icono size={18} aria-hidden="true" /> {texto}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <IndicadorUbicacion estado={estadoUbicacion} />
            <span className="hidden sm:block text-right leading-tight">
              <span className="block text-sm font-bold text-miaa-marino">{usuario?.nombre}</span>
              <span className="block text-xs text-slate-500">Lecturista</span>
            </span>
            <Link to="/cuenta/password" aria-label="Cambiar contraseña" title="Cambiar contraseña"
              className="grid place-items-center size-10 rounded-xl text-slate-500 hover:text-miaa-marino hover:bg-slate-100">
              <KeyRound size={18} aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={salir}
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-sm font-semibold text-slate-600 hover:text-red-700 hover:bg-red-50 transition-colors"
            >
              <LogOut size={18} aria-hidden="true" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* pb extra en celular para que la barra inferior no tape el contenido */}
      <main className="max-w-5xl mx-auto px-4 pt-6 pb-28 md:pb-10">
        <Outlet />
      </main>

      {/* Barra inferior (solo celular) */}
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-30 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]"
        aria-label="Principal"
      >
        <ul className="grid grid-cols-2">
          {DESTINOS.map(({ to, texto, icono: Icono, end, destacado }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-1 h-16 text-xs font-semibold ${
                    isActive ? 'text-miaa-marino' : 'text-slate-500'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`grid place-items-center rounded-full transition-colors ${
                        destacado
                          ? 'size-10 -mt-1 bg-miaa-ambar text-miaa-marino'
                          : `size-8 ${isActive ? 'bg-miaa-bruma/70' : ''}`
                      }`}
                    >
                      <Icono size={destacado ? 22 : 20} aria-hidden="true" />
                    </span>
                    {texto}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
