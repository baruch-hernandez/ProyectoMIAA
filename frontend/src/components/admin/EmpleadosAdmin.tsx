import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, MapPin, RefreshCw } from 'lucide-react';
import { usuariosApi } from '../../services/usuariosApi';
import { leerError } from '../../services/reportesApi';
import type { Empleado, EmpleadosRespuesta } from '../../types/reporte';
import { fechaRelativa, formatoFecha } from '../../utils/catalogos';

function EstadoEmpleado({ activo }: { activo: boolean }) {
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

/** Punto verde "En línea" si ahorita comparte su ubicación. */
function EnLinea({ enLinea }: { enLinea: boolean }) {
  return enLinea ? (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-bold text-[#0b6b58]">
      <span className="relative flex size-2" aria-hidden="true">
        <span className="absolute inline-flex size-full rounded-full bg-miaa-menta opacity-75 animate-ping" />
        <span className="relative inline-flex size-2 rounded-full bg-[#0fa987]" />
      </span>
      En línea
    </span>
  ) : (
    <span className="text-xs text-slate-400">Desconectado</span>
  );
}

function textoInactividad(e: Empleado): string {
  if (e.diasSinActividad == null) return 'Nunca ha entrado';
  if (e.diasSinActividad === 0) return 'Con actividad hoy';
  return e.diasSinActividad === 1 ? '1 día sin actividad' : `${e.diasSinActividad} días sin actividad`;
}

/**
 * Estado de cada empleado (lecturista): ACTIVO si inició sesión o subió un reporte en los
 * últimos N días. Lo calcula el backend (EmpleadoService); aquí solo se muestra.
 */
export function EmpleadosAdmin() {
  const navigate = useNavigate();
  const [datos, setDatos] = useState<EmpleadosRespuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let ignorar = false;
    usuariosApi
      .empleados()
      .then((d) => { if (!ignorar) setDatos(d); })
      .catch((err) => { if (!ignorar) setError(leerError(err).mensaje); })
      .finally(() => { if (!ignorar) setCargando(false); });
    return () => { ignorar = true; };
  }, [recarga]);

  const recargar = () => {
    setCargando(true);
    setError(null);
    setRecarga((n) => n + 1);
  };

  const empleados = datos?.empleados ?? [];
  const activos = empleados.filter((e) => e.activo).length;
  const dias = datos?.diasInactivo;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-miaa-marino">Empleados</h1>
          <p className="mt-1 text-slate-600 max-w-xl">
            {dias != null
              ? <>Un lecturista está <strong className="text-miaa-marino">activo</strong> si inició sesión o subió un reporte en los últimos <span className="cifras font-semibold">{dias}</span> días.</>
              : 'Revisa quién está activo y quién no.'}{' '}
            Toca a un lecturista para ver <strong className="text-miaa-marino">dónde está ahorita</strong>.
          </p>
        </div>
        <button
          type="button"
          onClick={recargar}
          disabled={cargando}
          className="inline-flex items-center gap-2 h-10 px-3 rounded-xl text-sm font-semibold text-miaa-azul hover:bg-white disabled:opacity-50"
        >
          <RefreshCw size={16} className={cargando ? 'animate-spin' : ''} aria-hidden="true" /> Actualizar
        </button>
      </div>

      {datos && (
        <dl className="grid grid-cols-3 gap-3 max-w-lg">
          {[
            { etiqueta: 'Empleados', valor: empleados.length, clase: 'text-miaa-marino' },
            { etiqueta: 'Activos', valor: activos, clase: 'text-[#0b6b58]' },
            { etiqueta: 'Inactivos', valor: empleados.length - activos, clase: 'text-slate-700' },
          ].map(({ etiqueta, valor, clase }) => (
            <div key={etiqueta} className="rounded-2xl bg-white border border-slate-200 px-4 py-3">
              <dt className="text-xs font-semibold text-slate-500">{etiqueta}</dt>
              <dd className={`cifras text-2xl font-extrabold ${clase}`}>{valor}</dd>
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
          <p className="font-bold text-miaa-marino">No hay lecturistas registrados.</p>
        </div>
      ) : datos && (
        <>
          {/* Tabla (pantallas medianas en adelante) */}
          <div className="hidden md:block rounded-2xl bg-white border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Empleado</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Estado</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Ahora</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Última actividad</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Último acceso</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Último reporte</th>
                  <th scope="col" className="px-5 py-3 font-semibold text-right">Reportes</th>
                  <th scope="col" className="px-3 py-3"><span className="sr-only">Ubicación</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {empleados.map((e) => (
                  // Toda la fila es clicable con el mouse; el nombre es un enlace real (teclado y lectores de pantalla)
                  <tr key={e.id} onClick={() => navigate(`/admin/empleados/${e.id}`)} className="cursor-pointer hover:bg-blue-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link to={`/admin/empleados/${e.id}`} className="block font-bold text-miaa-marino hover:underline">{e.nombre}</Link>
                      <span className="text-xs text-slate-500">{e.username}</span>
                    </td>
                    <td className="px-5 py-3.5"><EstadoEmpleado activo={e.activo} /></td>
                    <td className="px-5 py-3.5"><EnLinea enLinea={e.enLinea} /></td>
                    <td className="px-5 py-3.5 text-slate-700">{textoInactividad(e)}</td>
                    <td className="px-5 py-3.5 text-slate-700"><Cuando iso={e.ultimoAcceso} /></td>
                    <td className="px-5 py-3.5 text-slate-700"><Cuando iso={e.ultimoReporte} /></td>
                    <td className="px-5 py-3.5 text-right cifras font-semibold text-miaa-marino">{e.totalReportes}</td>
                    <td className="px-3 py-3.5 text-miaa-azul"><MapPin size={18} aria-hidden="true" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tarjetas (celular) */}
          <ul className="md:hidden space-y-3">
            {empleados.map((e) => (
              <li key={e.id}>
                <Link to={`/admin/empleados/${e.id}`} className="block rounded-2xl bg-white border border-slate-200 p-4 hover:border-miaa-azul transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-miaa-marino">{e.nombre}</p>
                    <p className="text-xs text-slate-500">{e.username}</p>
                    <p className="mt-1"><EnLinea enLinea={e.enLinea} /></p>
                  </div>
                  <EstadoEmpleado activo={e.activo} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <dt className="text-slate-500">Actividad</dt>
                  <dd className="text-slate-800">{textoInactividad(e)}</dd>
                  <dt className="text-slate-500">Último acceso</dt>
                  <dd className="text-slate-800"><Cuando iso={e.ultimoAcceso} /></dd>
                  <dt className="text-slate-500">Último reporte</dt>
                  <dd className="text-slate-800"><Cuando iso={e.ultimoReporte} /></dd>
                  <dt className="text-slate-500">Reportes</dt>
                  <dd className="cifras font-semibold text-miaa-marino">{e.totalReportes}</dd>
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
    </div>
  );
}
