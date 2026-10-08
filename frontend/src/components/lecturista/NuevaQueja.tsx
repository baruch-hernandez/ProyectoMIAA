import { useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, LocateFixed, Trash2 } from 'lucide-react';
import { quejasApi, leerError } from '../../services/quejasApi';
import type { CategoriaQueja, Coordenadas, PrioridadQueja, QuejaRequest } from '../../types/queja';
import { CATEGORIAS, MUNICIPIOS, PRIORIDADES } from '../../utils/catalogos';
import { comprimirFotoCamara } from '../../utils/cameraHelper';
import { MapaUbicacion } from './MapaUbicacion';

const MAX_FOTOS = 3;

// Campos de texto del formulario (lo demás —ubicación y fotos— va en su propio estado)
type CamposTexto = Omit<QuejaRequest, 'latitud' | 'longitud' | 'fotos'>;

const VACIO: CamposTexto = {
  calle: '',
  numeroExterior: '',
  numeroInterior: '',
  colonia: '',
  codigoPostal: '',
  municipio: 'Aguascalientes',
  referencias: '',
  numeroContrato: '',
  categoria: 'FUGA_AGUA',
  descripcion: '',
  prioridad: 'MEDIA',
};

const claseInput =
  'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white';

/** Etiqueta + input + error del servidor para ese campo. */
function Campo({ id, etiqueta, error, children, className = '' }: {
  id: string;
  etiqueta: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-600 mb-1">{etiqueta}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function NuevaQueja() {
  const navigate = useNavigate();
  const [form, setForm] = useState<CamposTexto>(VACIO);
  const [ubicacion, setUbicacion] = useState<Coordenadas | null>(null);
  const [fotos, setFotos] = useState<string[]>([]);

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [procesandoFoto, setProcesandoFoto] = useState(false);

  // Un solo handler para todos los campos: usa el atributo "name" del input
  const cambiar = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const usarMiUbicacion = () => {
    if (!navigator.geolocation) {
      setAviso('Este dispositivo no permite obtener la ubicación.');
      return;
    }
    setBuscandoGps(true);
    setAviso(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUbicacion({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setBuscandoGps(false);
      },
      (err) => {
        setBuscandoGps(false);
        setAviso(
          err.code === err.PERMISSION_DENIED
            ? 'Permiso de ubicación denegado. Marca el punto tocando el mapa.'
            : 'No se pudo obtener la ubicación. Marca el punto tocando el mapa.',
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const agregarFoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir la misma foto
    if (!archivo) return;

    setProcesandoFoto(true);
    try {
      const base64 = await comprimirFotoCamara(archivo); // ≤ 200 KB (utils/cameraHelper.ts)
      setFotos((prev) => [...prev, base64].slice(0, MAX_FOTOS));
    } catch {
      setAviso('No se pudo procesar la imagen. Intenta con otra foto.');
    } finally {
      setProcesandoFoto(false);
    }
  };

  const quitarFoto = (indice: number) => setFotos((prev) => prev.filter((_, i) => i !== indice));

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErrores({});
    setErrorGeneral(null);
    setEnviando(true);

    try {
      // Las llaves deben coincidir con QuejaRequestDTO.java
      const creada = await quejasApi.crear({
        ...form,
        latitud: ubicacion?.lat ?? null,
        longitud: ubicacion?.lng ?? null,
        fotos,
      });
      navigate(`/mis-quejas/${creada.id}`, { replace: true });
    } catch (err) {
      const { mensaje, errores: porCampo } = leerError(err);
      setErrorGeneral(mensaje);
      setErrores(porCampo); // se pintan debajo de cada campo
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Registrar queja</h2>
        <p className="text-sm text-slate-500">Los campos con * son obligatorios.</p>
      </div>

      {errorGeneral && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg" role="alert">
          {errorGeneral}
        </div>
      )}

      <form onSubmit={enviar} className="space-y-4">
        {/* ---------- Domicilio ---------- */}
        <fieldset className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <legend className="float-left w-full text-sm font-bold text-slate-700">Domicilio</legend>

          <div className="clear-left grid grid-cols-1 sm:grid-cols-6 gap-3">
            <Campo id="calle" etiqueta="Calle *" error={errores.calle} className="sm:col-span-4">
              <input id="calle" name="calle" value={form.calle} onChange={cambiar} required maxLength={150} className={claseInput} />
            </Campo>
            <Campo id="numeroExterior" etiqueta="No. exterior *" error={errores.numeroExterior} className="sm:col-span-1">
              <input id="numeroExterior" name="numeroExterior" value={form.numeroExterior} onChange={cambiar} required maxLength={20} className={claseInput} />
            </Campo>
            <Campo id="numeroInterior" etiqueta="No. interior" error={errores.numeroInterior} className="sm:col-span-1">
              <input id="numeroInterior" name="numeroInterior" value={form.numeroInterior} onChange={cambiar} maxLength={20} className={claseInput} />
            </Campo>

            <Campo id="colonia" etiqueta="Colonia *" error={errores.colonia} className="sm:col-span-3">
              <input id="colonia" name="colonia" value={form.colonia} onChange={cambiar} required maxLength={100} className={claseInput} />
            </Campo>
            <Campo id="codigoPostal" etiqueta="C.P. *" error={errores.codigoPostal} className="sm:col-span-1">
              <input
                id="codigoPostal"
                name="codigoPostal"
                value={form.codigoPostal}
                onChange={cambiar}
                required
                inputMode="numeric"
                pattern="20\d{3}"
                title="C.P. de Aguascalientes: 20000 a 20999"
                maxLength={5}
                placeholder="20000"
                className={claseInput}
              />
            </Campo>
            <Campo id="municipio" etiqueta="Municipio *" error={errores.municipio} className="sm:col-span-2">
              <select id="municipio" name="municipio" value={form.municipio} onChange={cambiar} className={claseInput}>
                {MUNICIPIOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Campo>

            <Campo id="referencias" etiqueta="Referencias" error={errores.referencias} className="sm:col-span-4">
              <input id="referencias" name="referencias" value={form.referencias} onChange={cambiar} maxLength={255}
                placeholder="Entre calles, color de fachada…" className={claseInput} />
            </Campo>
            <Campo id="numeroContrato" etiqueta="No. de contrato MIAA" error={errores.numeroContrato} className="sm:col-span-2">
              <input id="numeroContrato" name="numeroContrato" value={form.numeroContrato} onChange={cambiar} maxLength={30}
                placeholder="Opcional" className={claseInput} />
            </Campo>
          </div>

          {/* Ubicación en el mapa */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-600">
                Ubicación en el mapa <span className="font-normal text-slate-400">(toca el mapa o arrastra el marcador)</span>
              </span>
              <button
                type="button"
                onClick={usarMiUbicacion}
                disabled={buscandoGps}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold disabled:bg-slate-400"
              >
                <LocateFixed size={14} aria-hidden="true" /> {buscandoGps ? 'Buscando…' : 'Usar mi ubicación'}
              </button>
            </div>
            <MapaUbicacion valor={ubicacion} onChange={setUbicacion} />
            {ubicacion && (
              <p className="text-xs text-slate-500">
                📍 {ubicacion.lat.toFixed(5)}, {ubicacion.lng.toFixed(5)}{' '}
                <button type="button" onClick={() => setUbicacion(null)} className="text-red-600 hover:underline">
                  quitar
                </button>
              </p>
            )}
            {(errores.latitud || errores.longitud) && (
              <p className="text-xs text-red-600">{errores.latitud ?? errores.longitud}</p>
            )}
          </div>
        </fieldset>

        {/* ---------- La queja ---------- */}
        <fieldset className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <legend className="float-left w-full text-sm font-bold text-slate-700">Queja</legend>

          <div className="clear-left grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo id="categoria" etiqueta="Categoría *" error={errores.categoria}>
              <select id="categoria" name="categoria" value={form.categoria} onChange={cambiar} className={claseInput}>
                {(Object.keys(CATEGORIAS) as CategoriaQueja[]).map((c) => (
                  <option key={c} value={c}>{CATEGORIAS[c]}</option>
                ))}
              </select>
            </Campo>

            <Campo id="prioridad" etiqueta="Prioridad *" error={errores.prioridad}>
              <select id="prioridad" name="prioridad" value={form.prioridad} onChange={cambiar} className={claseInput}>
                {(Object.keys(PRIORIDADES) as PrioridadQueja[]).map((p) => (
                  <option key={p} value={p}>{PRIORIDADES[p]}</option>
                ))}
              </select>
            </Campo>
          </div>

          <Campo id="descripcion" etiqueta="Descripción *" error={errores.descripcion}>
            <textarea
              id="descripcion"
              name="descripcion"
              value={form.descripcion}
              onChange={cambiar}
              required
              minLength={10}
              maxLength={2000}
              rows={4}
              placeholder="¿Qué pasa, desde cuándo, a quién afecta?"
              className={claseInput}
            />
            <p className="mt-1 text-right text-xs text-slate-400">{form.descripcion.length}/2000</p>
          </Campo>

          {/* Fotos */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-slate-600">
              Fotos de evidencia ({fotos.length}/{MAX_FOTOS})
            </span>
            <div className="flex flex-wrap gap-3">
              {fotos.map((f, i) => (
                <div key={i} className="relative">
                  <img src={f} alt={`Foto ${i + 1}`} className="w-24 h-24 object-cover rounded-lg border border-slate-200" />
                  <button
                    type="button"
                    onClick={() => quitarFoto(i)}
                    aria-label={`Quitar foto ${i + 1}`}
                    className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center shadow"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              ))}

              {fotos.length < MAX_FOTOS && (
                <label className="w-24 h-24 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 text-slate-500 text-xs cursor-pointer hover:bg-slate-50">
                  <Camera size={20} aria-hidden="true" />
                  {procesandoFoto ? 'Procesando…' : 'Agregar'}
                  {/* Sin capture="environment": así pueden elegir cámara O galería */}
                  <input type="file" accept="image/*" onChange={agregarFoto} className="sr-only" disabled={procesandoFoto} />
                </label>
              )}
            </div>
            {errores.fotos && <p className="text-xs text-red-600">{errores.fotos}</p>}
          </div>
        </fieldset>

        {aviso && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg">{aviso}</div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate('/mis-quejas')}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando || procesandoFoto}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm disabled:bg-blue-300"
          >
            {enviando ? 'Guardando…' : 'Registrar queja'}
          </button>
        </div>
      </form>
    </section>
  );
}
