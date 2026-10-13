import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ClipboardList, LogOut, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cerrarSesion, obtenerUsuario } from '../../utils/sesion';
import { Marca } from '../Marca';

interface Destino {
  to: string;
  texto: string;
  icono: LucideIcon;
  end?: boolean;
}

// El administrador SOLO consulta: los reportes de los empleados y si están activos.
const DESTINOS: Destino[] = [
  { to: '/admin', texto: 'Reportes', icono: ClipboardList, end: false },
  { to: '/admin/empleados', texto: 'Empleados', icono: Users },
];

/**
 * Marco del panel del administrador.
 *  - Escritorio: menú lateral marino.
 *  - Celular: barra superior con pestañas.
 */
export function AdminLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const usuario = obtenerUsuario();

  const salir = () => {
    cerrarSesion();
    navigate('/', { replace: true });
  };

  // "Reportes" queda activo en /admin y en /admin/reportes/:id, pero no en /admin/empleados
  const claseActiva = (to: string, isActive: boolean) =>
    to === '/admin' ? isActive && !pathname.startsWith('/admin/empleados') : isActive;

  return (
    <div className="min-h-dvh bg-miaa-fondo lg:flex">
      {/* ---------- Menú lateral (escritorio) ---------- */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between bg-miaa-marino text-white sticky top-0 h-dvh">
        <div>
          <div className="px-6 py-6 border-b border-white/10">
            <Marca tono="oscuro" />
          </div>
          <nav className="p-4 space-y-1" aria-label="Principal">
            {DESTINOS.map(({ to, texto, icono: Icono, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 h-11 px-4 rounded-xl text-sm font-semibold transition-colors ${
                    claseActiva(to, isActive) ? 'bg-white/15 text-white' : 'text-miaa-bruma hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icono size={18} aria-hidden="true" /> {texto}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="p-4 border-t border-white/10">
          <p className="text-xs text-miaa-bruma">Conectado como</p>
          <p className="mt-0.5 text-sm font-semibold truncate">{usuario?.nombre ?? 'Administrador'}</p>
          <button
            type="button"
            onClick={salir}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-white/10 text-sm font-semibold hover:bg-white hover:text-red-700 transition-colors"
          >
            <LogOut size={16} aria-hidden="true" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ---------- Barra superior (celular y tableta) ---------- */}
      <header className="lg:hidden sticky top-0 z-30 bg-miaa-marino text-white">
        <div className="px-4 h-16 flex items-center justify-between">
          <Marca tono="oscuro" />
          <button
            type="button"
            onClick={salir}
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-sm font-semibold text-miaa-bruma hover:bg-white/10 hover:text-white"
          >
            <LogOut size={18} aria-hidden="true" /> Salir
          </button>
        </div>
        <nav className="px-4 flex gap-1" aria-label="Principal">
          {DESTINOS.map(({ to, texto, icono: Icono, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `inline-flex items-center gap-2 h-11 px-3 border-b-[3px] text-sm font-semibold ${
                  claseActiva(to, isActive) ? 'border-miaa-ambar text-white' : 'border-transparent text-miaa-bruma'
                }`
              }
            >
              <Icono size={17} aria-hidden="true" /> {texto}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1 min-w-0 px-4 sm:px-8 py-6 lg:py-10 max-w-6xl">
        <Outlet />
      </main>
    </div>
  );
}
