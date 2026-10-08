import { CircleCheck, LoaderCircle, PlayCircle, RotateCcw, Trash2, UserRound } from 'lucide-react';
import type { RutaItem } from '../../utils/rutas';
import { colorRuta, etiquetaRuta } from '../../utils/rutas';

interface Props {
  rutas: RutaItem[];
  /** id de la ruta que se está guardando/borrando (sus botones se desactivan) */
  rutaOcupada: number | null;
  hayFiltros: boolean;
  onCambiarEstado: (id: number, estado: string) => void;
  onEliminar: (ruta: RutaItem) => void;
  onLimpiarFiltros: () => void;
}

const claseAccion =
  'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-wait';

export function TablaRutas({ rutas, rutaOcupada, hayFiltros, onCambiarEstado, onEliminar, onLimpiarFiltros }: Props) {
  if (rutas.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
        <p className="font-bold text-miaa-marino">
          {hayFiltros ? 'Ninguna ruta coincide con los filtros.' : 'Aún no hay rutas registradas.'}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {hayFiltros ? (
            <button type="button" onClick={onLimpiarFiltros} className="font-semibold text-miaa-azul underline">
              Quitar filtros
            </button>
          ) : (
            'Activa el dibujo en el mapa para trazar la primera.'
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-6 px-6">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="text-slate-500 text-xs border-b border-slate-200">
          <tr>
            <th scope="col" className="py-3 pr-4 font-semibold">Ruta</th>
            <th scope="col" className="py-3 pr-4 font-semibold">Zona o colonia</th>
            <th scope="col" className="py-3 pr-4 font-semibold">Lecturista</th>
            <th scope="col" className="py-3 pr-4 font-semibold">Estado</th>
            <th scope="col" className="py-3 font-semibold text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rutas.map((r) => {
            const color = colorRuta(r.estado);
            const ocupada = rutaOcupada === r.id;
            return (
              <tr key={r.id} className="align-middle">
                <td className="py-3 pr-4">
                  <span className="block font-bold text-miaa-marino whitespace-nowrap">{r.codigoSector}</span>
                  <span className="cifras text-xs text-slate-500">
                    {r.puntos?.length ?? 0} {r.puntos?.length === 1 ? 'punto' : 'puntos'}
                  </span>
                </td>
                <td className="py-3 pr-4 text-slate-700">{r.colonia}</td>
                <td className="py-3 pr-4">
                  {r.lecturista ? (
                    <span className="inline-flex items-center gap-2 text-slate-800">
                      <span className="grid place-items-center size-7 rounded-full bg-miaa-bruma/60 text-miaa-marino" aria-hidden="true">
                        <UserRound size={15} />
                      </span>
                      <span className="whitespace-nowrap">{r.lecturista.nombre ?? `Usuario ${r.lecturista.id}`}</span>
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">Sin asignar</span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-bold px-2.5 py-1 rounded-full ${color.insignia}`}>
                    <span className={`size-1.5 rounded-full ${color.punto}`} aria-hidden="true" />
                    {etiquetaRuta(r.estado)}
                  </span>
                </td>
                <td className="py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    {ocupada && <LoaderCircle size={16} className="animate-spin text-slate-400" aria-label="Guardando" />}

                    {/* Solo las acciones que tienen sentido para el estado actual */}
                    {r.estado === 'PENDIENTE' && (
                      <button type="button" disabled={ocupada} onClick={() => onCambiarEstado(r.id, 'EN_PROCESO')}
                        className={`${claseAccion} bg-[#e0f6ff] text-[#035e86] hover:bg-[#c8eeff]`}>
                        <PlayCircle size={15} aria-hidden="true" /> Iniciar
                      </button>
                    )}
                    {r.estado !== 'COMPLETADA' && (
                      <button type="button" disabled={ocupada} onClick={() => onCambiarEstado(r.id, 'COMPLETADA')}
                        className={`${claseAccion} bg-[#d3fbf2] text-[#0b6b58] hover:bg-[#b5f5e6]`}>
                        <CircleCheck size={15} aria-hidden="true" /> Completar
                      </button>
                    )}
                    {r.estado === 'COMPLETADA' && (
                      <button type="button" disabled={ocupada} onClick={() => onCambiarEstado(r.id, 'PENDIENTE')}
                        className={`${claseAccion} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
                        <RotateCcw size={15} aria-hidden="true" /> Reabrir
                      </button>
                    )}
                    <button type="button" disabled={ocupada} onClick={() => onEliminar(r)}
                      aria-label={`Eliminar ruta ${r.codigoSector}`}
                      className={`${claseAccion} text-red-700 hover:bg-red-50`}>
                      <Trash2 size={15} aria-hidden="true" /> Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
