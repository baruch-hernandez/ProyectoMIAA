import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ClipboardList, LogOut, Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cerrarSesion, obtenerUsuario } from '../../utils/sesion';
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

/**
 * Marco de las pantallas del lecturista.
 *  - Escritorio: menú en la barra superior.
 *  - Celular: barra inferior fija, al alcance del pulgar (se usa en la calle).
 */
export function LecturistaLayout() {
  const navigate = useNavigate();
  const usuario = obtenerUsuario();

  const salir = () => {
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

          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-right leading-tight">
              <span className="block text-sm font-bold text-miaa-marino">{usuario?.nombre}</span>
              <span className="block text-xs text-slate-500">Lecturista</span>
            </span>
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
