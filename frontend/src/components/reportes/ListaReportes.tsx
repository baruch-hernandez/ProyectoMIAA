import { Link } from 'react-router-dom';
import { Camera, ChevronRight, MapPin, MessageSquareText, Pencil, UserRound } from 'lucide-react';
import type { ReporteResumen } from '../../types/reporte';
import { fechaRelativa } from '../../utils/catalogos';

interface Props {
  reportes: ReporteResumen[];
  /** A dónde lleva cada reporte, p. ej. (id) => `/reportes/${id}` */
  enlace: (id: number) => string;
  /** El admin ve de quién es cada reporte; el notificador no lo necesita (todos son suyos). */
  mostrarAutor?: boolean;
}

/** Lista de reportes, del más nuevo al más viejo. Sin filtros: así lo pidió MIAA. */
export function ListaReportes({ reportes, enlace, mostrarAutor = false }: Props) {
  return (
    <ul className="space-y-3">
      {reportes.map((r) => (
        <li key={r.id}>
          <Link
            to={enlace(r.id)}
            className="group flex items-center gap-3 rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 hover:border-miaa-azul hover:bg-blue-50/40 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-start gap-1.5 font-bold text-miaa-marino">
                <MapPin size={17} className="mt-0.5 shrink-0 text-miaa-azul" aria-hidden="true" />
                <span className="line-clamp-2">{r.domicilio}</span>
              </p>
              <p className="mt-1.5 text-slate-700 line-clamp-2">{r.descripcion}</p>

              <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="cifras font-semibold text-slate-600">{r.folio}</span>
                {mostrarAutor && (
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                    <UserRound size={13} aria-hidden="true" /> {r.autor}
                  </span>
                )}
                <span>{fechaRelativa(r.fechaCreacion)}</span>
                {r.editado && (
                  <span className="inline-flex items-center gap-1 font-semibold text-miaa-azul">
                    <Pencil size={12} aria-hidden="true" /> Editado
                  </span>
                )}
                <span className="inline-flex items-center gap-1" aria-label={`${r.totalFotos} fotos`}>
                  <Camera size={13} aria-hidden="true" /> <span className="cifras">{r.totalFotos}</span>
                </span>
                <span className="inline-flex items-center gap-1" aria-label={`${r.totalNotas} notas`}>
                  <MessageSquareText size={13} aria-hidden="true" /> <span className="cifras">{r.totalNotas}</span>
                </span>
              </p>
            </div>
            <ChevronRight size={20} className="shrink-0 text-slate-300 group-hover:text-miaa-azul" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
