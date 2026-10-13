import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, CircleCheck, Eye, LoaderCircle, MapPin, Send, X } from 'lucide-react';
import { reportesApi, leerError } from '../../services/reportesApi';
import type { Foto, ReporteDetalle } from '../../types/reporte';
import { formatoFecha, fechaRelativa } from '../../utils/catalogos';
import { prepararFoto, textoHoraFoto } from '../../utils/fotos';
import { MapaUbicacion } from '../mapa/MapaUbicacion';
import { MiniaturaFoto } from './MiniaturaFoto';
import { VisorFoto } from './VisorFoto';

const MAX_FOTOS = 3;

interface Props {
  /** Enlace de regreso: "Mis reportes" para el lecturista, "Reportes" para el admin. */
  volverA: { to: string; texto: string };
}

/**
 * Detalle de un reporte. Lo usan el lecturista y el administrador:
 *  - Si el backend dice `puedeEditar` (quien lo subió): puede agregar notas y quitar/poner fotos.
 *  - Si no (el admin): solo consulta. Los botones ni se muestran.
 * Ojo: esconder botones es comodidad; quien de verdad lo impide es el backend.
 */
export function DetalleReporte({ volverA }: Props) {
  const id = Number(useParams().id);
  const location = useLocation();
  const recienCreado = Boolean((location.state as { recienCreado?: boolean } | null)?.recienCreado);

  const [reporte, setReporte] = useState<ReporteDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mostrarAviso, setMostrarAviso] = useState(recienCreado);

  const [nota, setNota] = useState('');
  const [errorNota, setErrorNota] = useState<string | null>(null);
  const [enviandoNota, setEnviandoNota] = useState(false);

  const [fotoAbierta, setFotoAbierta] = useState<Foto | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [quitandoFoto, setQuitandoFoto] = useState<number | null>(null);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setReporte(await reportesApi.detalle(id));
      setError(null);
    } catch (err) {
      setError(leerError(err).mensaje);
    }
  }, [id]);

  useEffect(() => {
    if (Number.isNaN(id)) return; // /reportes/abc: ni preguntamos al backend
    let ignorar = false;
    reportesApi
      .detalle(id)
      .then((r) => { if (!ignorar) setReporte(r); })
      .catch((err) => { if (!ignorar) setError(leerError(err).mensaje); });
    return () => { ignorar = true; };
  }, [id]);

  const enviarNota = async (e: FormEvent) => {
    e.preventDefault();
    const texto = nota.trim();
    if (!texto) return;
    setEnviandoNota(true);
    setErrorNota(null);
    try {
      await reportesApi.agregarNota(id, texto);
      setNota('');
      await cargar(); // trae la nota con su fecha y autor reales
    } catch (err) {
      setErrorNota(leerError(err).mensaje);
    } finally {
      setEnviandoNota(false);
    }
  };

  /** Poner una foto nueva (p. ej. después de quitar una borrosa). */
  const agregarFoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo
    if (!archivo) return;
    setSubiendoFoto(true);
    setErrorFoto(null);
    try {
      const foto = await prepararFoto(archivo); // revisa HD y lee la hora de captura
      await reportesApi.agregarFoto(id, foto); // el backend vuelve a revisar todo
      await cargar();
    } catch (err) {
      setErrorFoto(leerError(err).mensaje);
    } finally {
      setSubiendoFoto(false);
    }
  };

  const quitarFoto = async (fotoId: number) => {
    setQuitandoFoto(fotoId);
    setErrorFoto(null);
    try {
      await reportesApi.borrarFoto(id, fotoId);
      // Quitamos solo esa foto de la pantalla (sin recargar todo) y ya.
      setReporte((r) => (r ? { ...r, fotos: r.fotos.filter((f) => f.id !== fotoId) } : r));
    } catch (err) {
      setErrorFoto(leerError(err).mensaje);
    } finally {
      setQuitandoFoto(null);
    }
  };

  const cerrarVisor = useCallback(() => setFotoAbierta(null), []);

  const volver = (
    <Link to={volverA.to} className="inline-flex items-center gap-1.5 h-10 text-sm font-semibold text-miaa-azul hover:text-miaa-marino">
      <ArrowLeft size={18} aria-hidden="true" /> {volverA.texto}
    </Link>
  );

  if (Number.isNaN(id) || (!reporte && error)) {
    return (
      <div className="max-w-xl">
        {volver}
        <div className="mt-3 p-5 rounded-2xl bg-white border border-slate-200">
          <p className="font-bold text-miaa-marino">No encontramos este reporte.</p>
          <p className="mt-1 text-sm text-slate-600">{error ?? 'La dirección no es válida.'} Revisa el folio o regresa a la lista.</p>
        </div>
      </div>
    );
  }

  if (!reporte) {
    return (
      <div aria-busy="true" className="space-y-4">
        {volver}
        <div className="h-36 rounded-3xl bg-white/70 animate-pulse" />
        <div className="h-64 rounded-2xl bg-white/70 animate-pulse" />
      </div>
    );
  }

  const r = reporte;
  const ubicacion = r.latitud != null && r.longitud != null ? { lat: r.latitud, lng: r.longitud } : null;
  const editable = r.puedeEditar;

  return (
    <div className="space-y-5">
      {volver}

      {mostrarAviso && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#d3fbf2] text-[#0b6b58]" role="status">
          <CircleCheck size={22} className="shrink-0" aria-hidden="true" />
          <p className="flex-1">
            <span className="font-bold">Reporte enviado.</span> Su folio es <span className="cifras font-bold">{r.folio}</span>.
          </p>
          <button type="button" onClick={() => setMostrarAviso(false)} aria-label="Cerrar aviso" className="size-8 grid place-items-center rounded-lg hover:bg-white/50">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      )}

      {!editable && (
        <p className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 px-3 py-1.5 text-sm text-slate-600">
          <Eye size={16} aria-hidden="true" /> Solo consulta: este reporte lo subió {r.autor}.
        </p>
      )}

      <header className="rounded-3xl bg-miaa-bruma/50 border-l-8 border-l-miaa-azul p-6 sm:p-8">
        <p className="cifras text-sm font-bold text-miaa-azul">{r.folio}</p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-miaa-marino text-balance">
          {r.calle} #{r.numeroExterior}
          {r.numeroInterior && ` int. ${r.numeroInterior}`}, {r.colonia}
        </h1>
        <p className="mt-2 text-miaa-marino/80">
          Subido por <span className="font-bold text-miaa-marino">{r.autor}</span> {fechaRelativa(r.fechaCreacion)}
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr] items-start">
        <div className="space-y-5">
          {/* ---------- Descripción ---------- */}
          <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6">
            <h2 className="text-lg font-extrabold text-miaa-marino">Descripción</h2>
            <p className="mt-3 text-base text-slate-800 whitespace-pre-wrap leading-relaxed max-w-prose">{r.descripcion}</p>
          </section>

          {/* ---------- Fotos (con su hora de captura) ---------- */}
          <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6" aria-labelledby="titulo-fotos">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="titulo-fotos" className="text-lg font-extrabold text-miaa-marino">
                Fotos <span className="cifras text-slate-400 font-bold">{r.fotos.length}/{MAX_FOTOS}</span>
              </h2>
              {editable && <p className="text-xs text-slate-500">Si una salió borrosa, quítala y pon otra.</p>}
            </div>

            {r.fotos.length === 0 && !editable && <p className="mt-3 text-sm text-slate-600">Este reporte no tiene fotos.</p>}

            <div className="mt-4 flex flex-wrap gap-4">
              {r.fotos.map((f, i) => (
                <MiniaturaFoto
                  key={f.id}
                  datos={f.datos}
                  numero={i + 1}
                  fechaCaptura={f.fechaCaptura}
                  origenFecha={f.origenFecha}
                  ancho={f.ancho}
                  alto={f.alto}
                  onAbrir={() => setFotoAbierta(f)}
                  onQuitar={editable ? () => quitarFoto(f.id) : undefined}
                  quitando={quitandoFoto === f.id}
                />
              ))}

              {editable && r.fotos.length < MAX_FOTOS && (
                <label className="w-44 h-36 rounded-xl border-2 border-dashed border-miaa-azul/50 bg-blue-50/50 flex flex-col items-center justify-center gap-1.5 text-miaa-azul text-sm font-semibold cursor-pointer hover:bg-blue-50 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-miaa-cielo">
                  {subiendoFoto ? <LoaderCircle size={24} className="animate-spin" aria-hidden="true" /> : <Camera size={24} aria-hidden="true" />}
                  {subiendoFoto ? 'Subiendo…' : 'Poner foto'}
                  <input type="file" accept="image/*" onChange={agregarFoto} className="sr-only" disabled={subiendoFoto} />
                </label>
              )}
            </div>
            {errorFoto && <p className="mt-3 text-sm text-red-700" role="alert">{errorFoto}</p>}
          </section>

          {/* ---------- Domicilio ---------- */}
          <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-miaa-marino">
              <MapPin size={20} className="text-miaa-azul" aria-hidden="true" /> Domicilio
            </h2>
            <p className="mt-3 text-base text-slate-800 leading-relaxed">
              {r.calle} #{r.numeroExterior}
              {r.numeroInterior && ` int. ${r.numeroInterior}`}, {r.colonia}
              <br />
              <span className="cifras">C.P. {r.codigoPostal}</span>, {r.municipio}
            </p>
            {(r.referencias || r.numeroContrato) && (
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {r.referencias && (<><dt className="text-slate-500">Referencias</dt><dd className="text-slate-800">{r.referencias}</dd></>)}
                {r.numeroContrato && (<><dt className="text-slate-500">Contrato</dt><dd className="cifras text-slate-800">{r.numeroContrato}</dd></>)}
              </dl>
            )}
            {ubicacion && <div className="mt-4"><MapaUbicacion valor={ubicacion} altoClase="h-56" /></div>}

            <dl className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
              <dt className="text-slate-500">Subido</dt>
              <dd className="text-slate-800">{formatoFecha(r.fechaCreacion)}</dd>
              <dt className="text-slate-500">Último cambio</dt>
              <dd className="text-slate-800">{formatoFecha(r.fechaActualizacion)}</dd>
            </dl>
          </section>
        </div>

        {/* ---------- Notas ---------- */}
        <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 lg:sticky lg:top-20">
          <h2 className="text-lg font-extrabold text-miaa-marino">
            Notas <span className="cifras text-slate-400 font-bold">{r.notas.length}</span>
          </h2>

          {r.notas.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">
              {editable ? 'Sin notas todavía. Agrega lo que observes después de subir el reporte.' : 'Sin notas.'}
            </p>
          ) : (
            <ol className="mt-4 relative border-l-2 border-miaa-bruma ml-1.5 space-y-5">
              {r.notas.map((n) => (
                <li key={n.id} className="pl-5 relative">
                  <span className="absolute -left-[7px] top-1.5 size-3 rounded-full ring-4 ring-white bg-miaa-azul" aria-hidden="true" />
                  <p className="text-sm">
                    <span className="font-bold text-miaa-marino">{n.autor}</span>{' '}
                    <span className="text-slate-500">{fechaRelativa(n.fechaCreacion)}</span>
                  </p>
                  <p className="mt-0.5 text-slate-800 whitespace-pre-wrap">{n.texto}</p>
                </li>
              ))}
            </ol>
          )}

          {editable && (
            <form onSubmit={enviarNota} className="mt-6">
              <label htmlFor="nueva-nota" className="block text-sm font-semibold text-miaa-marino mb-1.5">Agregar nota</label>
              <textarea
                id="nueva-nota"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Escribe lo que observaste…"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-base leading-relaxed focus:border-miaa-cielo focus:outline-none focus:ring-4 focus:ring-miaa-cielo/20"
              />
              {errorNota && <p className="mt-1.5 text-sm text-red-700">{errorNota}</p>}
              <button
                type="submit"
                disabled={enviandoNota || !nota.trim()}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-miaa-marino text-white font-bold hover:bg-blue-800 disabled:opacity-50 transition-colors"
              >
                {enviandoNota ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
                {enviandoNota ? 'Guardando…' : 'Guardar nota'}
              </button>
            </form>
          )}
        </section>
      </div>

      {fotoAbierta && (
        <VisorFoto
          src={fotoAbierta.datos}
          pie={`${textoHoraFoto(fotoAbierta.fechaCaptura, fotoAbierta.origenFecha).principal} · ${fotoAbierta.ancho}×${fotoAbierta.alto}`}
          onCerrar={cerrarVisor}
        />
      )}
    </div>
  );
}
