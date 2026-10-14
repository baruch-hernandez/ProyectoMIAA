import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CloudOff, LoaderCircle, Plus, RefreshCw, Send, Trash2, X } from 'lucide-react';
import { reportesApi, leerError } from '../../services/reportesApi';
import type { ReporteResumen } from '../../types/reporte';
import { obtenerUsuario } from '../../utils/sesion';
import { fechaRelativa } from '../../utils/catalogos';
import { useColaReportes } from '../../hooks/useColaReportes';
import type { ReportePendiente } from '../../utils/colaReportes';
import { ListaReportes } from '../reportes/ListaReportes';

/** Un reporte guardado en el celular, esperando señal. */
function Pendiente({ p, onDescartar }: { p: ReportePendiente; onDescartar: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const d = p.datos;
  return (
    <li className="rounded-xl bg-white border border-[#f3d98b] p-3 sm:p-4">
      <p className="font-bold text-miaa-marino">{d.calle} #{d.numeroExterior}, {d.colonia}</p>
      <p className="text-sm text-slate-600 line-clamp-1">{d.descripcion}</p>
      <p className="mt-1 text-xs text-slate-500">
        Guardado {fechaRelativa(p.guardadoEn)} · {d.fotos.length} {d.fotos.length === 1 ? 'foto' : 'fotos'}
      </p>
      {p.error && (
        <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-sm text-red-800">
          El servidor no lo aceptó: {p.error}
        </p>
      )}
      <div className="mt-2">
        {confirmando ? (
          <span className="inline-flex items-center gap-1 text-sm">
            <span className="font-semibold text-slate-700">¿Descartarlo? Se pierde.</span>
            <button type="button" onClick={onDescartar} className="h-9 px-2.5 rounded-lg font-bold text-white bg-red-700 hover:bg-red-800">Sí</button>
            <button type="button" onClick={() => setConfirmando(false)} className="h-9 px-2.5 rounded-lg font-semibold text-slate-700 hover:bg-slate-100">No</button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmando(true)} className="inline-flex items-center gap-1.5 h-9 px-2 -ml-2 rounded-lg text-sm font-semibold text-red-700 hover:bg-red-50">
            <Trash2 size={14} aria-hidden="true" /> Descartar
          </button>
        )}
      </div>
    </li>
  );
}

/** Los reportes que subió el lecturista, del más nuevo al más viejo. Sin filtros. */
export function MisReportes() {
  const usuario = obtenerUsuario();
  const [reportes, setReportes] = useState<ReporteResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const { pendientes, enviando, enviarAhora, descartar } = useColaReportes();
  const location = useLocation();
  const estado = location.state as { guardadoSinConexion?: boolean; borrado?: string } | null;
  const [aviso, setAviso] = useState<string | null>(
    estado?.guardadoSinConexion
      ? 'Sin señal: tu reporte se guardó en el celular y se enviará solo cuando vuelva la conexión.'
      : estado?.borrado
        ? `Se borró el reporte ${estado.borrado}.`
        : null,
  );
  // Cuando cambia el número de pendientes (p. ej. se enviaron solos), recargamos la lista
  const numPendientes = pendientes.length;

  useEffect(() => {
    let ignorar = false; // si el componente se desmonta, no pintamos una respuesta vieja
    reportesApi
      .mios()
      .then((data) => { if (!ignorar) setReportes(data); })
      .catch((err) => { if (!ignorar) setError(leerError(err).mensaje); })
      .finally(() => { if (!ignorar) setCargando(false); });
    return () => { ignorar = true; };
  }, [recarga, numPendientes]);

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

      {aviso && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#d3fbf2] text-[#0b6b58]" role="status">
          <p className="flex-1 font-medium">{aviso}</p>
          <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso" className="size-8 grid place-items-center rounded-lg hover:bg-white/50">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      )}

      {pendientes.length > 0 && (
        <section className="rounded-2xl bg-[#fff8e1] border border-[#f3d98b] p-4 sm:p-5" aria-labelledby="titulo-pendientes">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="titulo-pendientes" className="flex items-center gap-2 text-lg font-extrabold text-[#7a5600]">
                <CloudOff size={20} aria-hidden="true" /> Pendientes de enviar <span className="cifras">{pendientes.length}</span>
              </h2>
              <p className="text-sm text-[#7a5600]">Guardados en este celular. Se envían solos cuando hay señal.</p>
            </div>
            <button
              type="button"
              onClick={() => enviarAhora()}
              disabled={enviando}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-miaa-marino text-white text-sm font-bold hover:bg-blue-800 disabled:opacity-60"
            >
              {enviando ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
              {enviando ? 'Enviando…' : 'Enviar ahora'}
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {pendientes.map((p) => <Pendiente key={p.clienteId} p={p} onDescartar={() => descartar(p.clienteId)} />)}
          </ul>
        </section>
      )}

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
