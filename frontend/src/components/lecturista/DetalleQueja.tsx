import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Send, X } from 'lucide-react';
import { quejasApi, leerError } from '../../services/quejasApi';
import type { QuejaDetalle } from '../../types/queja';
import { CATEGORIAS, formatoFecha } from '../../utils/catalogos';
import { EstadoBadge, PrioridadBadge } from './Etiquetas';
import { MapaUbicacion } from './MapaUbicacion';

export function DetalleQueja() {
  const id = Number(useParams().id);

  const [queja, setQueja] = useState<QuejaDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [errorNota, setErrorNota] = useState<string | null>(null);
  const [enviandoNota, setEnviandoNota] = useState(false);
  const [fotoAbierta, setFotoAbierta] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setQueja(await quejasApi.detalle(id));
      setError(null);
    } catch (err) {
      setError(leerError(err).mensaje);
    }
  }, [id]);

  useEffect(() => {
    // Si la URL no trae un número (p. ej. /mis-quejas/abc), ni preguntamos al backend
    if (Number.isNaN(id)) return;
    let ignorar = false;
    quejasApi
      .detalle(id)
      .then((q) => { if (!ignorar) setQueja(q); })
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
      await quejasApi.agregarNota(id, texto);
      setNota('');
      await cargar(); // recargamos para traer la nota con su fecha y autor reales
    } catch (err) {
      setErrorNota(leerError(err).mensaje);
    } finally {
      setEnviandoNota(false);
    }
  };

  if (Number.isNaN(id)) {
    return <p className="text-red-600">La dirección no es válida.</p>;
  }

  if (!queja) {
    return error ? (
      <div className="space-y-3">
        <Link to="/mis-quejas" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
          <ArrowLeft size={16} aria-hidden="true" /> Volver
        </Link>
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg" role="alert">{error}</div>
      </div>
    ) : (
      <p className="text-slate-500">Cargando…</p>
    );
  }

  const ubicacion = queja.latitud != null && queja.longitud != null
    ? { lat: queja.latitud, lng: queja.longitud }
    : null;

  return (
    <section className="space-y-4">
      <Link to="/mis-quejas" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
        <ArrowLeft size={16} aria-hidden="true" /> Mis quejas
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold text-slate-800">{CATEGORIAS[queja.categoria]}</h2>
        <EstadoBadge estado={queja.estado} />
        <PrioridadBadge prioridad={queja.prioridad} />
      </div>
      <p className="font-mono text-xs text-slate-500">{queja.folio}</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ---------- Columna izquierda: datos ---------- */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-700">Domicilio</h3>
            <p className="text-sm text-slate-700">
              {queja.calle} #{queja.numeroExterior}
              {queja.numeroInterior && ` Int. ${queja.numeroInterior}`}, {queja.colonia}
              <br />
              C.P. {queja.codigoPostal}, {queja.municipio}
            </p>
            {queja.referencias && <p className="text-xs text-slate-500">Referencias: {queja.referencias}</p>}
            {queja.numeroContrato && <p className="text-xs text-slate-500">Contrato MIAA: {queja.numeroContrato}</p>}
            {ubicacion && <MapaUbicacion valor={ubicacion} altoClase="h-56" />}
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-700">Descripción</h3>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{queja.descripcion}</p>

            {queja.fotos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {queja.fotos.map((f, i) => (
                  <button key={i} type="button" onClick={() => setFotoAbierta(f)} aria-label={`Ver foto ${i + 1}`}>
                    <img src={f} alt={`Evidencia ${i + 1}`} className="w-24 h-24 object-cover rounded-lg border border-slate-200 hover:opacity-90" />
                  </button>
                ))}
              </div>
            )}

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs pt-2 border-t border-slate-100">
              <dt className="text-slate-500">Registró</dt>
              <dd className="text-slate-700">{queja.creadoPor}</dd>
              <dt className="text-slate-500">Atiende</dt>
              <dd className="text-slate-700">{queja.asignadoA ?? 'Aún sin asignar'}</dd>
              <dt className="text-slate-500">Creada</dt>
              <dd className="text-slate-700">{formatoFecha(queja.fechaCreacion)}</dd>
              <dt className="text-slate-500">Última actualización</dt>
              <dd className="text-slate-700">{formatoFecha(queja.fechaActualizacion)}</dd>
            </dl>
          </div>
        </div>

        {/* ---------- Columna derecha: notas ---------- */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-700 mb-3">
            <MessageSquare size={16} aria-hidden="true" /> Notas ({queja.notas.length})
          </h3>

          <ul className="flex-1 space-y-3 max-h-96 overflow-y-auto pr-1">
            {queja.notas.length === 0 && (
              <li className="text-sm text-slate-400">Sin notas todavía. Agrega lo que observes del domicilio.</li>
            )}
            {queja.notas.map((n) => (
              <li key={n.id} className="border-l-2 border-blue-200 pl-3">
                <div className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{n.autor}</span> · {formatoFecha(n.fechaCreacion)}
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{n.texto}</p>
              </li>
            ))}
          </ul>

          <form onSubmit={enviarNota} className="mt-4 space-y-2">
            <label htmlFor="nueva-nota" className="sr-only">Nueva nota</label>
            <textarea
              id="nueva-nota"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder="Escribe una nota…"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            {errorNota && <p className="text-xs text-red-600">{errorNota}</p>}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={enviandoNota || !nota.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:bg-blue-300"
              >
                <Send size={14} aria-hidden="true" /> {enviandoNota ? 'Enviando…' : 'Agregar nota'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Visor de foto a pantalla completa */}
      {fotoAbierta && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setFotoAbierta(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Foto de evidencia"
        >
          <button
            type="button"
            onClick={() => setFotoAbierta(null)}
            aria-label="Cerrar"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center"
          >
            <X size={20} aria-hidden="true" />
          </button>
          <img src={fotoAbierta} alt="Evidencia ampliada" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </section>
  );
}
