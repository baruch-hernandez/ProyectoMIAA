import type { ReactNode } from 'react';
import { MapPin } from 'lucide-react';

// Piezas de los formularios de reporte (nuevo y editar).

/** Bloque numerado del formulario. Los números sí aplican: es un proceso en orden. */
export function Paso({ numero, titulo, ayuda, children }: { numero: number; titulo: string; ayuda?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6" aria-labelledby={`paso-${numero}`}>
      <div className="flex items-start gap-3 mb-5">
        <span className="cifras grid place-items-center size-8 shrink-0 rounded-full bg-miaa-marino text-white text-sm font-bold" aria-hidden="true">
          {numero}
        </span>
        <div>
          <h2 id={`paso-${numero}`} className="text-lg font-extrabold text-miaa-marino leading-8">{titulo}</h2>
          {ayuda && <p className="text-sm text-slate-600">{ayuda}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/** Etiqueta + control + error del servidor para ese campo. */
export function Campo({ id, etiqueta, opcional, deGps, error, children, className = '' }: {
  id: string;
  etiqueta: string;
  opcional?: boolean;
  /** true = lo llenó el GPS y el usuario aún no lo ha tocado */
  deGps?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-semibold text-miaa-marino mb-1.5">
        {etiqueta}
        {opcional && <span className="font-normal text-slate-500"> (opcional)</span>}
        {deGps && (
          <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-[#e0f6ff] px-1.5 py-px align-middle text-[11px] font-bold text-[#035e86]">
            <MapPin size={11} aria-hidden="true" /> GPS
          </span>
        )}
      </label>
      {children}
      {error && <p id={`${id}-error`} className="mt-1.5 text-sm text-red-700">{error}</p>}
    </div>
  );
}
