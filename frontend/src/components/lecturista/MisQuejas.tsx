import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Plus, RefreshCw } from 'lucide-react';
import { quejasApi, leerError } from '../../services/quejasApi';
import type { EstadoQueja, QuejaResumen } from '../../types/queja';
import { CATEGORIAS, ESTADOS, formatoFecha } from '../../utils/catalogos';
import { EstadoBadge, PrioridadBadge } from './Etiquetas';

const FILTROS: (EstadoQueja | '')[] = ['', 'PENDIENTE', 'ASIGNADA', 'EN_PROCESO', 'RESUELTA', 'CANCELADA'];

export function MisQuejas() {
  const [filtro, setFiltro] = useState<EstadoQueja | ''>('');
  const [quejas, setQuejas] = useState<QuejaResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0); // cambiarlo vuelve a disparar la consulta

  useEffect(() => {
    // "ignorar" evita pintar una respuesta vieja si el usuario cambia de filtro rápido
    let ignorar = false;
    quejasApi
      .misQuejas(filtro || undefined)
      .then((data) => { if (!ignorar) setQuejas(data); })
      .catch((err) => { if (!ignorar) setError(leerError(err).mensaje); })
      .finally(() => { if (!ignorar) setCargando(false); });
    return () => { ignorar = true; };
  }, [filtro, recarga]);

  // El "cargando" se marca desde el evento (no dentro del efecto)
  const cambiarFiltro = (nuevo: EstadoQueja | '') => {
    if (nuevo === filtro) return;
    setCargando(true);
    setError(null);
    setFiltro(nuevo);
  };

  const recargar = () => {
    setCargando(true);
    setError(null);
    setRecarga((n) => n + 1);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Mis quejas</h2>
          <p className="text-sm text-slate-500">Quejas que has registrado y su seguimiento.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={recargar}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={16} aria-hidden="true" /> Actualizar
          </button>
          <Link
            to="/mis-quejas/nueva"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm"
          >
            <Plus size={16} aria-hidden="true" /> Registrar queja
          </Link>
        </div>
      </div>

      {/* Filtro por estado */}
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar por estado">
        {FILTROS.map((f) => (
          <button
            key={f || 'todas'}
            type="button"
            onClick={() => cambiarFiltro(f)}
            aria-pressed={filtro === f}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
              filtro === f
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {f ? ESTADOS[f] : 'Todas'}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg" role="alert">
          {error}
        </div>
      )}

      {cargando ? (
        <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-sm">
          Cargando quejas…
        </div>
      ) : quejas.length === 0 && !error ? (
        <div className="bg-white p-10 rounded-xl border border-dashed border-slate-300 text-center">
          <p className="text-slate-600 font-medium">
            {filtro ? `No tienes quejas en estado "${ESTADOS[filtro]}".` : 'Todavía no has registrado quejas.'}
          </p>
          {!filtro && (
            <Link to="/mis-quejas/nueva" className="inline-block mt-3 text-sm font-semibold text-blue-600 hover:underline">
              Registrar la primera
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {quejas.map((q) => (
            <li key={q.id}>
              <Link
                to={`/mis-quejas/${q.id}`}
                className="block bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow transition"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-slate-500">{q.folio}</span>
                  <div className="flex gap-2">
                    <PrioridadBadge prioridad={q.prioridad} />
                    <EstadoBadge estado={q.estado} />
                  </div>
                </div>
                <h3 className="mt-2 font-bold text-slate-800">{CATEGORIAS[q.categoria]}</h3>
                <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-600">
                  <MapPin size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
                  {q.domicilio}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Registrada el {formatoFecha(q.fechaCreacion)} ·{' '}
                  {q.asignadoA ? `Atiende: ${q.asignadoA}` : 'Sin asignar'}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
