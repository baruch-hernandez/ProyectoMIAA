import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ClipboardList, Gauge, LogOut, Plus } from 'lucide-react';
import { cerrarSesion, obtenerUsuario } from '../../utils/sesion';

/**
 * Marco común de las pantallas de quejas del lecturista:
 * barra superior con menú + contenido de la página (<Outlet />).
 */
export function LecturistaLayout() {
  const navigate = useNavigate();
  const usuario = obtenerUsuario();

  const salir = () => {
    cerrarSesion();
    navigate('/', { replace: true });
  };

  const claseEnlace = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
      isActive ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 text-white rounded-lg flex items-center justify-center font-black text-xl">
              M
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 leading-none">MIAA · Lecturista</h1>
              <span className="text-xs text-slate-500">{usuario?.nombre}</span>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-1">
            {/* end: para que "Mis quejas" no quede activo también en /mis-quejas/nueva */}
            <NavLink to="/mis-quejas" end className={claseEnlace}>
              <ClipboardList size={16} aria-hidden="true" /> Mis quejas
            </NavLink>
            <NavLink to="/mis-quejas/nueva" className={claseEnlace}>
              <Plus size={16} aria-hidden="true" /> Nueva
            </NavLink>
            {/* La pantalla de lecturas tiene su propio encabezado, por eso vive fuera de este layout */}
            <NavLink to="/lecturas" className={claseEnlace}>
              <Gauge size={16} aria-hidden="true" /> Lecturas
            </NavLink>
            <button
              type="button"
              onClick={salir}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition"
            >
              <LogOut size={16} aria-hidden="true" /> Salir
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
