import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { reportesApi, leerError } from '../../services/reportesApi';
import { usuariosApi } from '../../services/usuariosApi';
import type { Empleado, FiltrosReportes, PaginaReportes, ReporteResumen } from '../../types/reporte';
import { claseInput } from '../../utils/estilos';
import { ListaReportes } from '../reportes/ListaReportes';

const SIN_FILTROS: FiltrosReportes = { empleadoId: '', desde: '', hasta: '' };
const claseEtiqueta = 'block mb-1 text-xs font-semibold text-slate-600';

/**
 * El administrador ve los reportes de TODOS los empleados, del más nuevo al más viejo.
 * Se filtran por empleado y por rango de días en el backend (así el total y "Ver más" cuadran).
 * Los datos se corrigen desde el detalle.
 * Llegan de 50 en 50 ("Ver más"): con meses de reportes, traerlos todos de golpe sería muy lento.
 */
export function ReportesAdmin() {
  const [reportes, setReportes] = useState<ReporteResumen[]>([]);
  const [ultima, setUltima] = useState<PaginaReportes | null>(null);
  const [pagina, setPagina] = useState(0);
  const [filtros, setFiltros] = useState<FiltrosReportes>(SIN_FILTROS);
  const [notificadores, setNotificadores] = useState<Empleado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  // Para el selector de empleado. Si falla, el filtro por fecha sigue sirviendo.
  useEffect(() => {
    usuariosApi.empleados()
      .then((d) => setNotificadores(d.empleados.filter((e) => e.rol === 'NOTIFICADOR')))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let ignorar = false;
    reportesApi
      .todos(pagina, filtros)
      .then((data) => {
        if (ignorar) return;
        setUltima(data);
        setReportes((antes) => (pagina === 0 ? data.reportes : [...antes, ...data.reportes]));
      })
      .catch((err) => { if (!ignorar) setError(leerError(err).mensaje); })
      .finally(() => { if (!ignorar) setCargando(false); });
    return () => { ignorar = true; };
  }, [pagina, filtros, recarga]);

  const recargar = () => {
    setCargando(true);
    setError(null);
    setPagina(0);
    setRecarga((n) => n + 1);
  };

  /** Cambiar un filtro vuelve a la primera página. */
  const filtrar = (cambio: Partial<FiltrosReportes>) => {
    setCargando(true);
    setError(null);
    setPagina(0);
    setFiltros((f) => ({ ...f, ...cambio }));
  };

  const verMas = () => {
    setCargando(true);
    setPagina((p) => p + 1);
  };

  const hayFiltros = filtros.empleadoId !== '' || filtros.desde !== '' || filtros.hasta !== '';
  const total = ultima?.total ?? 0;
  // Cuántos empleados distintos tienen reportes (con los filtros puestos)
  const empleadosConReportes = ultima?.empleados ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-miaa-marino">Reportes</h1>
          <p className="mt-1 text-slate-600">
            <span className="tabular-nums font-semibold text-miaa-marino">{total}</span>{' '}
            {total === 1 ? 'reporte' : 'reportes'} de{' '}
            <span className="tabular-nums font-semibold text-miaa-marino">{empleadosConReportes}</span>{' '}
            {empleadosConReportes === 1 ? 'empleado' : 'empleados'}, del más reciente al más antiguo.
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

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end" role="search" aria-label="Filtrar reportes">
        <div>
          <label htmlFor="filtro-empleado" className={claseEtiqueta}>Empleado</label>
          <select
            id="filtro-empleado"
            value={filtros.empleadoId}
            onChange={(ev) => filtrar({ empleadoId: ev.target.value })}
            className={claseInput}
          >
            <option value="">Todos los empleados</option>
            {notificadores.map((e) => (
              <option key={e.id} value={String(e.id)}>{e.nombre}{!e.habilitado && ' (dado de baja)'}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filtro-desde" className={claseEtiqueta}>Desde</label>
          <input
            id="filtro-desde"
            type="date"
            value={filtros.desde}
            max={filtros.hasta || undefined}
            onChange={(ev) => filtrar({ desde: ev.target.value })}
            className={claseInput}
          />
        </div>
        <div>
          <label htmlFor="filtro-hasta" className={claseEtiqueta}>Hasta</label>
          <input
            id="filtro-hasta"
            type="date"
            value={filtros.hasta}
            min={filtros.desde || undefined}
            onChange={(ev) => filtrar({ hasta: ev.target.value })}
            className={claseInput}
          />
        </div>
        {hayFiltros && (
          <button
            type="button"
            onClick={() => filtrar(SIN_FILTROS)}
            className="h-12 px-4 rounded-xl text-sm font-semibold text-miaa-azul hover:bg-white"
          >
            Quitar filtros
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm" role="alert">
          {error}{' '}
          <button type="button" onClick={recargar} className="font-bold underline">Intentar de nuevo</button>
        </div>
      )}

      {cargando && reportes.length === 0 ? (
        <ul className="space-y-3" aria-busy="true" aria-label="Cargando reportes">
          {[0, 1, 2, 3].map((i) => <li key={i} className="h-28 rounded-2xl bg-white/70 animate-pulse" />)}
        </ul>
      ) : reportes.length === 0 && !error ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-10 text-center">
          {hayFiltros ? (
            <>
              <p className="font-bold text-miaa-marino">Ningún reporte coincide con los filtros.</p>
              <button type="button" onClick={() => filtrar(SIN_FILTROS)} className="mt-2 text-sm font-semibold text-miaa-azul underline">
                Quitar filtros
              </button>
            </>
          ) : (
            <>
              <p className="font-bold text-miaa-marino">Todavía no hay reportes.</p>
              <p className="mt-1 text-sm text-slate-600">Aquí aparecerán los que suban los notificadores desde campo.</p>
            </>
          )}
        </div>
      ) : (
        <>
          <ListaReportes reportes={reportes} enlace={(id) => `/admin/reportes/${id}`} mostrarAutor />
          {ultima?.hayMas && (
            <div className="text-center">
              <button
                type="button"
                onClick={verMas}
                disabled={cargando}
                className="inline-flex items-center gap-2 h-11 px-5 rounded-xl font-semibold text-miaa-azul bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
              >
                {cargando ? 'Cargando…' : `Ver más (${reportes.length} de ${total})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
