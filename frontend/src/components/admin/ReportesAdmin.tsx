import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { reportesApi, leerError } from '../../services/reportesApi';
import type { ReporteResumen } from '../../types/reporte';
import { ListaReportes } from '../reportes/ListaReportes';

/**
 * El administrador ve los reportes de TODOS los empleados, del más nuevo al más viejo.
 * Solo consulta: no hay filtros ni exportar (MIAA pidió quitarlos).
 */
export function ReportesAdmin() {
  const [reportes, setReportes] = useState<ReporteResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let ignorar = false;
    reportesApi
      .todos()
      .then((data) => { if (!ignorar) setReportes(data); })
      .catch((err) => { if (!ignorar) setError(leerError(err).mensaje); })
      .finally(() => { if (!ignorar) setCargando(false); });
    return () => { ignorar = true; };
  }, [recarga]);

  const recargar = () => {
    setCargando(true);
    setError(null);
    setRecarga((n) => n + 1);
  };

  // Cuántos empleados distintos han reportado (dato de contexto, no es filtro)
  const empleadosConReportes = useMemo(() => new Set(reportes.map((r) => r.autorId)).size, [reportes]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-miaa-marino">Reportes</h1>
          <p className="mt-1 text-slate-600">
            <span className="cifras font-semibold text-miaa-marino">{reportes.length}</span>{' '}
            {reportes.length === 1 ? 'reporte' : 'reportes'} de{' '}
            <span className="cifras font-semibold text-miaa-marino">{empleadosConReportes}</span>{' '}
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
          <p className="font-bold text-miaa-marino">Todavía no hay reportes.</p>
          <p className="mt-1 text-sm text-slate-600">Aquí aparecerán los que suban los lecturistas desde campo.</p>
        </div>
      ) : (
        <ListaReportes reportes={reportes} enlace={(id) => `/admin/reportes/${id}`} mostrarAutor />
      )}
    </div>
  );
}
