import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ImageOff, MapPin, Pencil } from 'lucide-react';
import api from '../../services/api';
import type { ReporteResumen } from '../../types/reporte';
import { fechaHoraAgs, fechaRelativa } from '../../utils/catalogos';

interface Props {
  reportes: ReporteResumen[];
  /** Los que llegaron en vivo mientras la página estaba abierta: se marcan como "Nuevo". */
  nuevos: ReadonlySet<number>;
  onAbrirEvidencia: (id: number) => void;
}

/**
 * La bandeja del admin. Miniatura, incidencia, quién la levantó, coordenadas
 * (con enlace al mapa) y hora de captura en hora de Aguascalientes. En pantallas chicas se desplaza
 * de lado.
 */
export function TablaReportes({ reportes, nuevos, onAbrirEvidencia }: Props) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[46rem] text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="px-4 py-3 w-24">Foto</th>
            <th scope="col" className="px-4 py-3">Incidencia</th>
            <th scope="col" className="px-4 py-3">Notificador</th>
            <th scope="col" className="px-4 py-3">Coordenadas</th>
            <th scope="col" className="px-4 py-3">Captura</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {reportes.map((r) => (
            <tr key={r.id} className={nuevos.has(r.id) ? 'bg-amber-50' : 'hover:bg-blue-50/40'}>
              <td className="px-4 py-3">
                {r.miniatura ? (
                  <Miniatura ruta={r.miniatura} folio={r.folio} onAbrir={() => onAbrirEvidencia(r.id)} />
                ) : (
                  <span className="grid size-16 place-items-center rounded-lg bg-slate-100 text-slate-400" title="Sin fotos">
                    <ImageOff size={18} aria-label="Sin fotos" />
                  </span>
                )}
              </td>
              <td className="px-4 py-3 max-w-sm">
                <Link to={`/admin/reportes/${r.id}`} className="font-bold text-miaa-marino hover:underline">
                  {r.folio}
                </Link>
                {nuevos.has(r.id) && (
                  <span className="ml-2 rounded-md bg-miaa-ambar px-1.5 py-0.5 text-[0.7rem] font-bold text-miaa-marino">Nuevo</span>
                )}
                {r.editado && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-miaa-azul">
                    <Pencil size={11} aria-hidden="true" /> Editado
                  </span>
                )}
                <p className="mt-0.5 text-slate-700 line-clamp-2">{r.descripcion}</p>
                <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{r.domicilio}</p>
              </td>
              <td className="px-4 py-3 font-semibold text-slate-700">{r.autor}</td>
              <td className="px-4 py-3">
                {r.latitud != null && r.longitud != null ? (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${r.latitud}&mlon=${r.longitud}#map=18/${r.latitud}/${r.longitud}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-start gap-1 font-mono text-xs text-miaa-azul hover:underline"
                    title="Ver en el mapa"
                  >
                    <MapPin size={13} className="mt-px shrink-0" aria-hidden="true" />
                    <span>{r.latitud.toFixed(6)},<br />{r.longitud.toFixed(6)}</span>
                  </a>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {r.fechaCaptura ? (
                  <time dateTime={r.fechaCaptura} className="tabular-nums text-slate-800">{fechaHoraAgs(r.fechaCaptura)}</time>
                ) : (
                  <span className="text-slate-400">Sin hora de captura</span>
                )}
                <p className="text-xs text-slate-500">Recibido {fechaRelativa(r.fechaCreacion)}</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * La miniatura pide token, así que no basta con <img src>: se descarga con la API (y la gota de
 * carga no aparece) solo cuando la fila se acerca a la pantalla (carga diferida).
 */
function Miniatura({ ruta, folio, onAbrir }: { ruta: string; folio: string; onAbrir: () => void }) {
  const boton = useRef<HTMLButtonElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    const el = boton.current;
    if (!el) return;
    let vivo = true;
    let url: string | undefined;
    const vigia = new IntersectionObserver(([entrada]) => {
      if (!entrada.isIntersecting) return;
      vigia.disconnect();
      api.get<Blob>(ruta, { responseType: 'blob', segundoPlano: true })
        .then((r) => {
          if (!vivo) return;
          url = URL.createObjectURL(r.data);
          setSrc(url);
        })
        .catch(() => { if (vivo) setFallo(true); });
    }, { rootMargin: '300px' });
    vigia.observe(el);
    return () => {
      vivo = false;
      vigia.disconnect();
      if (url) URL.revokeObjectURL(url);
    };
  }, [ruta]);

  return (
    <button
      ref={boton}
      type="button"
      onClick={onAbrir}
      aria-label={`Ver la evidencia de ${folio}`}
      className="grid size-16 place-items-center overflow-hidden rounded-lg bg-slate-100 ring-miaa-azul hover:ring-2"
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : fallo ? (
        <ImageOff size={18} className="text-slate-400" aria-hidden="true" />
      ) : (
        <span className="size-full animate-pulse bg-slate-200" />
      )}
    </button>
  );
}
