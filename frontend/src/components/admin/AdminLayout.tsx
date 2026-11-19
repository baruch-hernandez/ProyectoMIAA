import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BellRing, ClipboardList, KeyRound, LogOut, Map as IconoMapa, Users, Volume2, VolumeX, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cerrarSesion, obtenerUsuario } from '../../utils/sesion';
import { Marca } from '../Marca';
import { avisarLogout } from '../../services/presenciaApi';
import type { EstadoAvisos } from '../../services/avisosReportes';
import { useAvisosReportes } from '../../hooks/useAvisosReportes';
import type { ReporteResumen } from '../../types/reporte';

interface Destino {
  to: string;
  texto: string;
  icono: LucideIcon;
  end?: boolean;
}

// El administrador consulta y corrige los reportes de los empleados, ve si están activos y dónde andan.
const DESTINOS: Destino[] = [
  { to: '/admin', texto: 'Reportes', icono: ClipboardList, end: false },
  { to: '/admin/empleados', texto: 'Empleados', icono: Users },
  { to: '/admin/mapa', texto: 'Mapa', icono: IconoMapa },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const usuario = obtenerUsuario();
  // Avisos en tiempo real de reportes nuevos, en cualquier pantalla del panel
  const avisos = useAvisosReportes();
  const { marcarLeidos } = avisos;
  const enBandeja = pathname === '/admin';
  useEffect(() => { if (enBandeja) marcarLeidos(); }, [enBandeja, marcarLeidos]);

  const salir = async () => {
    await avisarLogout();
    cerrarSesion();
    navigate('/', { replace: true });
  };

  // "Reportes" queda activo en /admin y en /admin/reportes/:id, pero no en las otras secciones
  const claseActiva = (to: string, isActive: boolean) =>
    to === '/admin' ? pathname === '/admin' || pathname.startsWith('/admin/reportes') : isActive;

  return (
    <div className="min-h-dvh bg-miaa-fondo lg:flex">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between bg-miaa-marino text-white sticky top-0 h-dvh">
        <div>
          <div className="px-6 py-6 border-b border-white/10">
            <Marca tono="oscuro" className="h-14" />
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
                {to === '/admin' && <Insignia cuantos={avisos.noLeidos} />}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="p-4 border-t border-white/10">
          <div className="mb-3 flex items-center justify-between">
            <EstadoEnVivo estado={avisos.estado} />
            <BotonSonido silencio={avisos.silencio} onAlternar={avisos.alternarSilencio} />
          </div>
          <p className="text-xs text-miaa-bruma">Conectado como</p>
          <p className="mt-0.5 text-sm font-semibold truncate">{usuario?.nombre ?? 'Administrador'}</p>
          <Link to="/admin/password" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-miaa-bruma hover:text-white">
            <KeyRound size={13} aria-hidden="true" /> Cambiar contraseña
          </Link>
          <button
            type="button"
            onClick={salir}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-white/10 text-sm font-semibold hover:bg-white hover:text-red-700 transition-colors"
          >
            <LogOut size={16} aria-hidden="true" /> Cerrar sesión
          </button>
        </div>
      </aside>

      <header className="lg:hidden sticky top-0 z-30 bg-miaa-marino text-white">
        <div className="px-4 h-16 flex items-center justify-between">
          <Marca tono="oscuro" />
          <div className="flex items-center gap-1">
          <BotonSonido silencio={avisos.silencio} onAlternar={avisos.alternarSilencio} />
          <Link to="/admin/password" aria-label="Cambiar contraseña" className="grid place-items-center size-10 rounded-xl text-miaa-bruma hover:bg-white/10 hover:text-white">
            <KeyRound size={18} aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={salir}
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-sm font-semibold text-miaa-bruma hover:bg-white/10 hover:text-white"
          >
            <LogOut size={18} aria-hidden="true" /> Salir
          </button>
          </div>
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
              {to === '/admin' && <Insignia cuantos={avisos.noLeidos} />}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1 min-w-0 px-4 sm:px-8 py-6 lg:py-10 max-w-6xl">
        <Outlet />
      </main>

      {avisos.ultimo && (
        <AvisoNuevoReporte
          reporte={avisos.ultimo}
          masPendientes={avisos.noLeidos - 1}
          onVer={() => { marcarLeidos(); navigate(`/admin/reportes/${avisos.ultimo!.id}`); }}
          onCerrar={avisos.cerrarAviso}
        />
      )}
    </div>
  );
}

/** Contador de reportes nuevos sin ver, junto a "Reportes". */
function Insignia({ cuantos }: { cuantos: number }) {
  if (cuantos <= 0) return null;
  return (
    <span className="ml-auto min-w-5 rounded-full bg-miaa-ambar px-1.5 text-center text-xs font-bold leading-5 text-miaa-marino"
      aria-label={`${cuantos} reportes nuevos sin ver`}>
      {cuantos > 99 ? '99+' : cuantos}
    </span>
  );
}

function BotonSonido({ silencio, onAlternar }: { silencio: boolean; onAlternar: () => void }) {
  const Icono = silencio ? VolumeX : Volume2;
  return (
    <button
      type="button"
      onClick={onAlternar}
      aria-pressed={!silencio}
      aria-label={silencio ? 'Activar el sonido de los avisos' : 'Silenciar los avisos'}
      title={silencio ? 'Avisos sin sonido' : 'Avisos con sonido'}
      className="grid size-10 place-items-center rounded-xl text-miaa-bruma hover:bg-white/10 hover:text-white"
    >
      <Icono size={18} aria-hidden="true" />
    </button>
  );
}

function EstadoEnVivo({ estado }: { estado: EstadoAvisos }) {
  const enVivo = estado === 'en-vivo';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-miaa-bruma" role="status">
      <span className={`size-2 rounded-full ${enVivo ? 'bg-emerald-400' : 'bg-slate-400 animate-pulse'}`} aria-hidden="true" />
      {enVivo ? 'Avisos en vivo' : estado === 'conectando' ? 'Conectando avisos…' : 'Reconectando avisos…'}
    </span>
  );
}

/** Aviso fijo (no se va solo) del último reporte que llegó. */
function AvisoNuevoReporte({ reporte, masPendientes, onVer, onCerrar }: {
  reporte: ReporteResumen; masPendientes: number; onVer: () => void; onCerrar: () => void;
}) {
  return (
    <div
      className="fixed bottom-4 right-4 left-4 z-40 sm:left-auto sm:w-96 rounded-2xl border border-amber-200 bg-white p-4 shadow-xl"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-miaa-ambar/30 text-miaa-marino">
          <BellRing size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-miaa-marino">Nuevo reporte {reporte.folio}</p>
          <p className="text-sm text-slate-700">{reporte.autor} · {reporte.colonia}, {reporte.municipio}</p>
          <p className="mt-0.5 text-sm text-slate-600 line-clamp-2">{reporte.descripcion}</p>
          {masPendientes > 0 && (
            <p className="mt-1 text-xs font-semibold text-slate-500">
              y {masPendientes} {masPendientes === 1 ? 'reporte nuevo más' : 'reportes nuevos más'}
            </p>
          )}
          <button type="button" onClick={onVer} className="mt-2 text-sm font-semibold text-miaa-azul underline">
            Ver reporte
          </button>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar aviso" className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100">
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
