import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, MapPin, RefreshCw, Search, UserPlus } from 'lucide-react';
import { usuariosApi } from '../../services/usuariosApi';
import { leerError } from '../../services/reportesApi';
import type { Empleado, EmpleadosRespuesta } from '../../types/reporte';
import { fechaRelativa, formatoFecha } from '../../utils/catalogos';
import { nombreRol } from '../../utils/roles';
import { claseInput } from '../../utils/estilos';

function EstadoEmpleado({ activo, habilitado = true }: { activo: boolean; habilitado?: boolean }) {
  if (!habilitado) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
        <span className="size-1.5 rounded-full bg-red-600" aria-hidden="true" /> Dado de baja
      </span>
    );
  }
  return activo ? (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#d3fbf2] px-2.5 py-1 text-xs font-bold text-[#0b6b58]">
      <span className="size-1.5 rounded-full bg-miaa-menta" aria-hidden="true" /> Activo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700">
      <span className="size-1.5 rounded-full bg-slate-500" aria-hidden="true" /> Inactivo
    </span>
  );
}

/** "hace 3 días" con la fecha completa al pasar el mouse; "Nunca" si no hay. */
function Cuando({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-slate-400">Nunca</span>;
  return <time dateTime={iso} title={formatoFecha(iso)}>{fechaRelativa(iso)}</time>;
}

/** Cada cuánto se refresca la lista sola, para ver quién entra o sale. */
const REFRESCO_MS = 1_000;

/** Etiqueta chica junto al nombre: solo se marca a los administradores (la mayoría son notificadores). */
function EtiquetaRol({ rol }: { rol: Empleado['rol'] }) {
  if (rol !== 'ADMIN') return null;
  return (
    <span className="ml-1.5 inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-[0.7rem] font-bold text-miaa-marino align-middle">
      {nombreRol(rol)}
    </span>
  );
}

function textoInactividad(e: Empleado): string {
  if (e.diasSinActividad == null) return 'Nunca ha entrado';
  if (e.diasSinActividad === 0) return 'Con actividad hoy';
  return e.diasSinActividad === 1 ? '1 día sin actividad' : `${e.diasSinActividad} días sin actividad`;
}

type FiltroEstado = 'todos' | 'activo' | 'inactivo' | 'baja';

function estadoDe(e: Empleado): Exclude<FiltroEstado, 'todos'> {
  if (!e.habilitado) return 'baja';
  return e.activo ? 'activo' : 'inactivo';
}

/** Para buscar sin importar mayúsculas ni acentos: "jose" encuentra a "José". */
const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function EmpleadosAdmin() {
  const navigate = useNavigate();
  const [datos, setDatos] = useState<EmpleadosRespuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<FiltroEstado>('todos');

  useEffect(() => {
    let ignorar = false;
    usuariosApi
      .empleados()
      .then((d) => { if (!ignorar) setDatos(d); })
      .catch((err) => { if (!ignorar) setError(leerError(err).mensaje); })
      .finally(() => { if (!ignorar) setCargando(false); });
    return () => { ignorar = true; };
  }, [recarga]);

  // Se actualiza sola cada segundo (sin el esqueleto de carga: la tabla se queda en pantalla)
  useEffect(() => {
    const intervalo = window.setInterval(() => setRecarga((n) => n + 1), REFRESCO_MS);
    return () => window.clearInterval(intervalo);
  }, []);

  const recargar = () => {
    setCargando(true);
    setError(null);
    setRecarga((n) => n + 1);
  };

  const empleados = datos?.empleados ?? [];
  const activos = empleados.filter((e) => e.activo).length;
  const termino = normalizar(busqueda.trim());
  const visibles = empleados.filter((e) =>
    (filtro === 'todos' || estadoDe(e) === filtro) && normalizar(`${e.nombre} ${e.username}`).includes(termino));
  const limpiarFiltros = () => { setBusqueda(''); setFiltro('todos'); };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-miaa-marino">Empleados</h1>
          <p className="mt-1 text-slate-600 max-w-xl">
            Un empleado está <strong className="text-miaa-marino">activo</strong> mientras tiene su sesión iniciada y la app a la vista. Pasa a inactivo al cerrar sesión, apagar la pantalla o el celular, o quedarse sin señal.{' '}
            Toca a un empleado para ver su ficha: <strong className="text-miaa-marino">dónde está ahorita</strong> y su cuenta.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={recargar}
            disabled={cargando}
            className="inline-flex items-center gap-2 h-10 px-3 rounded-xl text-sm font-semibold text-miaa-azul hover:bg-white disabled:opacity-50"
          >
            <RefreshCw size={16} className={cargando ? 'animate-spin' : ''} aria-hidden="true" /> Actualizar
          </button>
          <Link to="/admin/empleados/nuevo" className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-miaa-marino text-white text-sm font-bold hover:bg-blue-800">
            <UserPlus size={16} aria-hidden="true" /> Nuevo empleado
          </Link>
        </div>
      </div>

      {datos && (
        <dl className="grid grid-cols-3 gap-3 max-w-xl">
          {[
            { etiqueta: 'Empleados', valor: empleados.length, clase: 'text-miaa-marino' },
            { etiqueta: 'Activos', valor: activos, clase: 'text-[#0b6b58]' },
            { etiqueta: 'Inactivos', valor: empleados.filter((e) => e.habilitado && !e.activo).length, clase: 'text-slate-700' },
          ].map(({ etiqueta, valor, clase }) => (
            <div key={etiqueta} className="rounded-2xl bg-white border border-slate-200 px-4 py-3">
              <dt className="text-xs font-semibold text-slate-500">{etiqueta}</dt>
              <dd className={`tabular-nums text-2xl font-extrabold ${clase}`}>{valor}</dd>
            </div>
          ))}
        </dl>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm" role="alert">
          {error}{' '}
          <button type="button" onClick={recargar} className="font-bold underline">Intentar de nuevo</button>
        </div>
      )}

      {cargando && !datos ? (
        <div className="h-64 rounded-2xl bg-white/70 animate-pulse" aria-busy="true" aria-label="Cargando empleados" />
      ) : datos && empleados.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-10 text-center">
          <p className="font-bold text-miaa-marino">No hay empleados registrados.</p>
        </div>
      ) : datos && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-sm">
              <label htmlFor="buscar-empleado" className="sr-only">Buscar empleado por nombre</label>
              <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="buscar-empleado"
                type="search"
                value={busqueda}
                onChange={(ev) => setBusqueda(ev.target.value)}
                placeholder="Buscar por nombre"
                autoComplete="off"
                className={`${claseInput} pl-10`}
              />
            </div>
            <div className="w-full sm:w-52">
              <label htmlFor="filtro-estado" className="sr-only">Filtrar por estado</label>
              <select id="filtro-estado" value={filtro} onChange={(ev) => setFiltro(ev.target.value as FiltroEstado)} className={claseInput}>
                <option value="todos">Todos los estados</option>
                <option value="activo">Activos</option>
                <option value="inactivo">Inactivos</option>
                <option value="baja">Dados de baja</option>
              </select>
            </div>
            <p className="text-sm text-slate-500 sm:ml-auto" aria-live="polite">
              <span className="tabular-nums">{visibles.length}</span> de <span className="tabular-nums">{empleados.length}</span>
            </p>
          </div>

          {visibles.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-10 text-center">
              <p className="font-bold text-miaa-marino">Ningún empleado coincide con la búsqueda.</p>
              <button type="button" onClick={limpiarFiltros} className="mt-2 text-sm font-semibold text-miaa-azul underline">Quitar filtros</button>
            </div>
          ) : (
          <>
          {/* Tabla (pantallas medianas en adelante) */}
          <div className="hidden md:block rounded-2xl bg-white border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Empleado</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Estado</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Última conexión</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Última actividad</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Último acceso</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Último reporte</th>
                  <th scope="col" className="px-5 py-3 font-semibold text-right">Reportes</th>
                  <th scope="col" className="px-3 py-3"><span className="sr-only">Ubicación</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibles.map((e) => (
                  // Toda la fila es clicable con el mouse; el nombre es un enlace real (teclado y lectores de pantalla)
                  <tr key={e.id} onClick={() => navigate(`/admin/empleados/${e.id}`)} className="cursor-pointer hover:bg-blue-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div>
                        <Link to={`/admin/empleados/${e.id}`} className="font-bold text-miaa-marino hover:underline">{e.nombre}</Link>
                        <EtiquetaRol rol={e.rol} />
                      </div>
                      <span className="text-xs text-slate-500">{e.username}</span>
                    </td>
                    <td className="px-5 py-3.5"><EstadoEmpleado activo={e.activo} habilitado={e.habilitado} /></td>
                    <td className="px-5 py-3.5 text-slate-700"><Cuando iso={e.ultimaConexion} /></td>
                    <td className="px-5 py-3.5 text-slate-700">{textoInactividad(e)}</td>
                    <td className="px-5 py-3.5 text-slate-700"><Cuando iso={e.ultimoAcceso} /></td>
                    <td className="px-5 py-3.5 text-slate-700"><Cuando iso={e.ultimoReporte} /></td>
                    <td className="px-5 py-3.5 text-right tabular-nums font-semibold text-miaa-marino">{e.totalReportes}</td>
                    <td className="px-3 py-3.5 text-miaa-azul"><MapPin size={18} aria-hidden="true" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tarjetas (celular) */}
          <ul className="md:hidden space-y-3">
            {visibles.map((e) => (
              <li key={e.id}>
                <Link to={`/admin/empleados/${e.id}`} className="block rounded-2xl bg-white border border-slate-200 p-4 hover:border-miaa-azul transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-miaa-marino">{e.nombre}<EtiquetaRol rol={e.rol} /></p>
                    <p className="text-xs text-slate-500">{e.username}</p>
                  </div>
                  <EstadoEmpleado activo={e.activo} habilitado={e.habilitado} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <dt className="text-slate-500">Última conexión</dt>
                  <dd className="text-slate-800"><Cuando iso={e.ultimaConexion} /></dd>
                  <dt className="text-slate-500">Actividad</dt>
                  <dd className="text-slate-800">{textoInactividad(e)}</dd>
                  <dt className="text-slate-500">Último acceso</dt>
                  <dd className="text-slate-800"><Cuando iso={e.ultimoAcceso} /></dd>
                  <dt className="text-slate-500">Último reporte</dt>
                  <dd className="text-slate-800"><Cuando iso={e.ultimoReporte} /></dd>
                  <dt className="text-slate-500">Reportes</dt>
                  <dd className="tabular-nums font-semibold text-miaa-marino">{e.totalReportes}</dd>
                </dl>
                <p className="mt-3 flex items-center justify-between text-sm font-semibold text-miaa-azul">
                  <span className="inline-flex items-center gap-1.5"><MapPin size={16} aria-hidden="true" /> Ver ubicación</span>
                  <ChevronRight size={18} aria-hidden="true" />
                </p>
                </Link>
              </li>
            ))}
          </ul>
          </>
          )}
        </>
      )}
    </div>
  );
}
