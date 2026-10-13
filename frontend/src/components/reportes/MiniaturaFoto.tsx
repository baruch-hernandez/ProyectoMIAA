import { useState } from 'react';
import { Clock, LoaderCircle, Trash2 } from 'lucide-react';
import type { OrigenFechaFoto } from '../../types/reporte';
import { textoHoraFoto } from '../../utils/fotos';

interface Props {
  datos: string;
  numero: number;
  fechaCaptura: string;
  origenFecha: OrigenFechaFoto;
  ancho?: number;
  alto?: number;
  onAbrir: () => void;
  /** Si se pasa, aparece "Quitar" (con confirmación en dos pasos, sin ventanas emergentes). */
  onQuitar?: () => void;
  quitando?: boolean;
}

/**
 * Una foto con SU HORA DE CAPTURA a la vista (lo que pidió MIAA: la hora en que se
 * tomó, no la hora en que se subió). Si la hora no vino de la cámara, se aclara.
 */
export function MiniaturaFoto({ datos, numero, fechaCaptura, origenFecha, ancho, alto, onAbrir, onQuitar, quitando }: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const { principal, detalle } = textoHoraFoto(fechaCaptura, origenFecha);

  return (
    <figure className="w-44 shrink-0">
      <button
        type="button"
        onClick={onAbrir}
        aria-label={`Ampliar foto ${numero}`}
        className="block w-44 h-36 rounded-xl overflow-hidden border border-slate-200 bg-slate-100"
      >
        <img src={datos} alt={`Evidencia ${numero}`} className="size-full object-cover hover:opacity-90" />
      </button>

      <figcaption className="mt-1.5 text-xs leading-snug">
        <span className="flex items-start gap-1 font-semibold text-miaa-marino">
          <Clock size={13} className="mt-px shrink-0" aria-hidden="true" /> {principal}
        </span>
        {detalle && <span className="block text-slate-500">{detalle}</span>}
        {ancho && alto && <span className="block cifras text-slate-400">{ancho}×{alto}</span>}
      </figcaption>

      {onQuitar && (
        <div className="mt-1.5">
          {quitando ? (
            <span className="inline-flex items-center gap-1.5 h-9 text-xs font-semibold text-slate-500">
              <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> Quitando…
            </span>
          ) : confirmando ? (
            <span className="inline-flex items-center gap-1 text-xs">
              <span className="font-semibold text-slate-700">¿Quitar?</span>
              <button type="button" onClick={onQuitar} className="h-9 px-2.5 rounded-lg font-bold text-white bg-red-700 hover:bg-red-800">
                Sí
              </button>
              <button type="button" onClick={() => setConfirmando(false)} className="h-9 px-2.5 rounded-lg font-semibold text-slate-700 hover:bg-slate-100">
                No
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              className="inline-flex items-center gap-1.5 h-9 px-2 -ml-2 rounded-lg text-xs font-semibold text-red-700 hover:bg-red-50"
            >
              <Trash2 size={14} aria-hidden="true" /> Quitar foto
            </button>
          )}
        </div>
      )}
    </figure>
  );
}
