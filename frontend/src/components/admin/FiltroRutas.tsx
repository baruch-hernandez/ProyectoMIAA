import { Search, X } from 'lucide-react';
import type { EstadoRuta, FiltroLecturista, FiltrosRutas, LecturistaResumen } from '../../utils/rutas';
import { COLOR_ESTADO_RUTA, ESTADOS_RUTA, ETIQUETA_PLURAL_RUTA, hayFiltrosActivos } from '../../utils/rutas';

interface Props {
  filtros: FiltrosRutas;
  onCambiar: (cambios: Partial<FiltrosRutas>) => void;
  onLimpiar: () => void;
  conteo: Record<EstadoRuta | 'TODAS', number>;
  lecturistas: LecturistaResumen[];
  totalVisibles: number;
  totalRutas: number;
}

/**
 * Barra de filtros de rutas:
 *  - pestañas por estado (con cuántas hay de cada una),
 *  - lecturista encargado,
 *  - búsqueda por código, colonia o nombre.
 * Filtra la tabla Y el mapa al mismo tiempo (el estado de los filtros vive en AdminDashboard).
 */
export function FiltroRutas({ filtros, onCambiar, onLimpiar, conteo, lecturistas, totalVisibles, totalRutas }: Props) {
  const pestanas: (EstadoRuta | 'TODAS')[] = ['TODAS', ...ESTADOS_RUTA];

  return (
    <div className="space-y-3">
      {/* Pestañas por estado */}
      <div className="-mx-1 px-1 overflow-x-auto" role="group" aria-label="Filtrar por estado">
        <div className="flex gap-2 w-max">
          {pestanas.map((e) => {
            const activa = filtros.estado === e;
            return (
              <button
                key={e}
                type="button"
                onClick={() => onCambiar({ estado: e })}
                aria-pressed={activa}
                className={`inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-semibold border transition-colors ${
                  activa
                    ? 'bg-miaa-marino border-miaa-marino text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-miaa-azul'
                }`}
              >
                {e !== 'TODAS' && (
                  <span className={`size-2 rounded-full ${COLOR_ESTADO_RUTA[e].punto}`} aria-hidden="true" />
                )}
                {e === 'TODAS' ? 'Todas' : ETIQUETA_PLURAL_RUTA[e]}
                <span className={`cifras text-xs font-bold ${activa ? 'text-miaa-bruma' : 'text-slate-400'}`}>
                  {conteo[e]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lecturista + búsqueda */}
      <div className="flex flex-col sm:flex-row gap-2">
        <label className="sm:w-64">
          <span className="sr-only">Lecturista encargado</span>
          <select
            value={filtros.lecturista}
            onChange={(e) => onCambiar({ lecturista: e.target.value as FiltroLecturista })}
            className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:border-miaa-cielo focus:outline-none focus:ring-4 focus:ring-miaa-cielo/20"
          >
            <option value="todos">Todos los lecturistas</option>
            <option value="sin-asignar">Sin lecturista asignado</option>
            {lecturistas.map((l) => (
              <option key={l.id} value={String(l.id)}>{l.nombre}</option>
            ))}
          </select>
        </label>

        <label className="relative flex-1">
          <span className="sr-only">Buscar ruta</span>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={filtros.busqueda}
            onChange={(e) => onCambiar({ busqueda: e.target.value })}
            placeholder="Buscar por código, colonia o lecturista"
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:border-miaa-cielo focus:outline-none focus:ring-4 focus:ring-miaa-cielo/20"
          />
        </label>
      </div>

      {/* Resumen del filtro */}
      <div className="flex items-center justify-between gap-2 text-sm text-slate-600 min-h-6" aria-live="polite">
        <span>
          Mostrando <span className="cifras font-bold text-miaa-marino">{totalVisibles}</span> de{' '}
          <span className="cifras">{totalRutas}</span> rutas
        </span>
        {hayFiltrosActivos(filtros) && (
          <button type="button" onClick={onLimpiar} className="inline-flex items-center gap-1 font-semibold text-miaa-azul hover:text-miaa-marino">
            <X size={14} aria-hidden="true" /> Quitar filtros
          </button>
        )}
      </div>
    </div>
  );
}
