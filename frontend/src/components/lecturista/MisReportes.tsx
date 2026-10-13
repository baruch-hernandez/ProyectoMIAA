import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { reportesApi, leerError } from '../../services/reportesApi';
import type { ReporteResumen } from '../../types/reporte';
import { obtenerUsuario } from '../../utils/sesion';
import { ListaReportes } from '../reportes/ListaReportes';

/** Los reportes que subió el lecturista, del más nuevo al más viejo. Sin filtros. */
export function MisReportes() {
  const usuario = obtenerUsuario();
  const [reportes, setReportes] = useState<ReporteResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let ignorar = false; // si el componente se desmonta, no pintamos una respuesta vieja
    reportesApi
      .mios()
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

  const nombreCorto = usuario?.nombre?.split(' ')[0];

  return (
    <div className="space-y-6">
      {/* Bloque principal: retoma el bloque ámbar de "Pagar en línea" del sitio de MIAA */}
      <section className="rounded-3xl bg-miaa-ambar text-miaa-marino p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-5 justify-between">
        <div className="max-w-md">
          <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight">
            {nombreCorto ? `${nombreCorto}, ¿algo que reportar?` : '¿Algo que reportar?'}
          </h1>
          <p className="mt-2 font-medium text-miaa-marino/80">
            Describe lo que viste en el domicilio, marca el punto en el mapa y toma fotos.
          </p>
        </div>
        <Link
          to="/reportes/nuevo"
          className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-miaa-marino text-white font-bold shrink-0 hover:bg-blue-800 transition-colors"
        >
          <Plus size={20} aria-hidden="true" /> Nuevo reporte
        </Link>
      </section>

      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-miaa-marino">Mis reportes</h2>
          <p className="text-sm text-slate-600">
            {reportes.length === 1 ? '1 reporte enviado' : `${reportes.length} reportes enviados`}
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
          {[0, 1, 2].map((i) => <li key={i} className="h-28 rounded-2xl bg-white/70 animate-pulse" />)}
        </ul>
      ) : reportes.length === 0 && !error ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-10 text-center">
          <p className="font-bold text-miaa-marino">Aún no envías reportes.</p>
          <p className="mt-1 text-sm text-slate-600">Cuando veas algo en un domicilio, repórtalo aquí.</p>
        </div>
      ) : (
        <ListaReportes reportes={reportes} enlace={(id) => `/reportes/${id}`} />
      )}
    </div>
  );
}
