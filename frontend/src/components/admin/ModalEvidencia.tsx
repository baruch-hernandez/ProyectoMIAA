import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { leerError, reportesApi } from '../../services/reportesApi';
import type { ReporteDetalle } from '../../types/reporte';
import { fechaHoraAgs } from '../../utils/catalogos';
import { textoHoraFoto } from '../../utils/fotos';

interface Props {
  reporteId: number;
  onCerrar: () => void;
}

/**
 * La evidencia de un reporte en grande, con sus datos técnicos: precisión del
 * GPS, hora de captura original (UTC) y en hora de Aguascalientes, y la dirección del reporte.
 * Se cierra con la X, tocando fuera o con Escape.
 */
export function ModalEvidencia({ reporteId, onCerrar }: Props) {
  const [reporte, setReporte] = useState<ReporteDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    let vivo = true;
    reportesApi.detalle(reporteId)
      .then((r) => { if (vivo) setReporte(r); })
      .catch((err) => { if (vivo) setError(leerError(err).mensaje); });
    return () => { vivo = false; };
  }, [reporteId]);

  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [onCerrar]);

  const foto = reporte?.fotos[indice];
  const direccion = reporte && [
    `${reporte.calle} #${reporte.numeroExterior}${reporte.numeroInterior ? ` Int. ${reporte.numeroInterior}` : ''}`,
    reporte.colonia, `C.P. ${reporte.codigoPostal}`, reporte.municipio,
  ].join(', ');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-miaa-marino/90 p-4"
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-label="Evidencia del reporte"
    >
      <div
        className="relative flex max-h-full w-full max-w-5xl flex-col gap-4 overflow-auto rounded-2xl bg-white p-4 lg:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          autoFocus
          className="absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-full bg-white text-miaa-marino shadow"
        >
          <X size={20} aria-hidden="true" />
        </button>

        {error && <p className="p-6 text-red-800" role="alert">{error}</p>}
        {!reporte && !error && <div className="h-[60dvh] w-full animate-pulse rounded-xl bg-slate-100" aria-busy="true" />}

        {reporte && (
          <>
            <div className="min-w-0 flex-1">
              {foto ? (
                <img src={foto.datos} alt={`Evidencia ${indice + 1} de ${reporte.folio}`} className="mx-auto max-h-[75dvh] rounded-xl" />
              ) : (
                <p className="p-6 text-slate-600">Este reporte ya no tiene fotos.</p>
              )}
              {reporte.fotos.length > 1 && (
                <div className="mt-3 flex justify-center gap-2">
                  {reporte.fotos.map((f, i) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setIndice(i)}
                      aria-label={`Foto ${i + 1}`}
                      aria-pressed={i === indice}
                      className={`size-14 overflow-hidden rounded-lg ring-2 ${i === indice ? 'ring-miaa-azul' : 'ring-transparent'}`}
                    >
                      <img src={f.datos} alt="" className="size-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <dl className="w-full shrink-0 space-y-3 text-sm lg:w-72">
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Reporte</dt>
                <dd className="font-bold text-miaa-marino">{reporte.folio} · {reporte.autor}</dd>
              </div>
              {foto && (
                <>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-500">Hora de captura</dt>
                    <dd className="text-slate-800">{fechaHoraAgs(foto.fechaCaptura)} <span className="text-slate-500">(Aguascalientes)</span></dd>
                    <dd className="font-mono text-xs text-slate-500">{foto.fechaCaptura}</dd>
                    {textoHoraFoto(foto.fechaCaptura, foto.origenFecha).detalle && (
                      <dd className="text-xs text-slate-500">{textoHoraFoto(foto.fechaCaptura, foto.origenFecha).detalle}</dd>
                    )}
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-500">Precisión GPS</dt>
                    <dd className="text-slate-800">
                      {foto.precisionGps != null ? `±${foto.precisionGps.toFixed(1)} m` : 'Sin GPS (foto de la web o la galería)'}
                    </dd>
                    {foto.latitud != null && foto.longitud != null && (
                      <dd className="font-mono text-xs text-slate-500">{foto.latitud.toFixed(6)}, {foto.longitud.toFixed(6)}</dd>
                    )}
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-500">Resolución</dt>
                    <dd className="text-slate-800 tabular-nums">{foto.ancho}×{foto.alto}</dd>
                  </div>
                </>
              )}
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-500">Dirección</dt>
                <dd className="text-slate-800">{direccion}</dd>
                {reporte.latitud != null && reporte.longitud != null && (
                  <dd className="font-mono text-xs text-slate-500">{reporte.latitud.toFixed(6)}, {reporte.longitud.toFixed(6)}</dd>
                )}
              </div>
              <Link to={`/admin/reportes/${reporte.id}`} className="inline-block font-semibold text-miaa-azul underline">
                Ver el reporte completo
              </Link>
            </dl>
          </>
        )}
      </div>
    </div>
  );
}
