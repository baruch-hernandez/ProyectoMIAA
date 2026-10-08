import { useEffect, useEffectEvent, useReducer, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Camera, CircleCheck, CircleHelp, Droplet, Droplets, Gauge, LoaderCircle, LocateFixed,
  MapPin, Receipt, RotateCcw, TriangleAlert, Waves, Wind, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { quejasApi, leerError } from '../../services/quejasApi';
import type { CategoriaQueja, Coordenadas, PrioridadQueja, QuejaRequest } from '../../types/queja';
import { CATEGORIAS, MUNICIPIOS, PRIORIDADES } from '../../utils/catalogos';
import { comprimirFotoCamara } from '../../utils/cameraHelper';
import { direccionDesdeCoordenadas } from '../../services/geocodificacion';
import type { CampoGps, DireccionGps } from '../../utils/direccionGps';
import { aplicarDireccion, camposLlenables, esCampoGps } from '../../utils/direccionGps';
import { dentroDeAguascalientes } from '../../utils/limiteAgs';
import { MapaUbicacion } from './MapaUbicacion';

const MAX_FOTOS = 3;

/** Arriba de esto (en metros) avisamos que el punto puede no ser la casa exacta. */
const PRECISION_BAJA_M = 60;

/** En qué va el autollenado por GPS (se muestra en el paso 1). */
type EstadoGps =
  | { fase: 'inactivo' }
  | { fase: 'ubicando' }
  | { fase: 'buscando'; precision?: number }
  | { fase: 'listo'; precision?: number }
  | { fase: 'sin-direccion'; precision?: number }
  /** gps: el GPS dio un punto fuera · mapa: tocaron/arrastraron fuera · direccion: OSM dice otro estado */
  | { fase: 'fuera'; motivo: 'gps' | 'mapa' | 'direccion'; precision?: number }
  | { fase: 'error'; mensaje: string };

const hayGeolocalizacion = typeof navigator !== 'undefined' && 'geolocation' in navigator;

const ICONO_CATEGORIA: Record<CategoriaQueja, LucideIcon> = {
  FUGA_AGUA: Droplets,
  FALTA_AGUA: Droplet,
  BAJA_PRESION: Wind,
  CALIDAD_AGUA: TriangleAlert,
  DRENAJE: Waves,
  MEDIDOR: Gauge,
  COBRO: Receipt,
  OTRO: CircleHelp,
};

// Campos de texto del formulario (ubicación y fotos van en su propio estado)
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
  'w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-base text-slate-900 placeholder:text-slate-400 focus:border-miaa-cielo focus:outline-none focus:ring-4 focus:ring-miaa-cielo/20 aria-[invalid=true]:border-red-500 data-[gps=true]:bg-[#f2fbff] data-[gps=true]:border-miaa-cielo';

/** Bloque numerado del formulario. Los números sí aplican: es un proceso en orden. */
function Paso({ numero, titulo, ayuda, children }: { numero: number; titulo: string; ayuda?: string; children: ReactNode }) {
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
function Campo({ id, etiqueta, opcional, deGps, error, children, className = '' }: {
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

// ---------- Estado de los campos de texto ----------
// Un reducer porque tres cosas cambian JUNTAS: los valores, qué campos editó la
// persona y cuáles llenó el GPS. Así nunca quedan desincronizados.
interface EstadoForm {
  campos: CamposTexto;
  /** Campos del domicilio que la persona escribió a mano: el GPS ya no los pisa. */
  editados: ReadonlySet<CampoGps>;
  /** Campos que llenó el GPS y siguen sin tocar (se pintan con la etiqueta "GPS"). */
  deGps: ReadonlySet<CampoGps>;
}

type AccionForm =
  | { tipo: 'escribir'; campo: keyof CamposTexto; valor: string }
  | { tipo: 'gps'; direccion: DireccionGps; forzar?: boolean };

function reducirForm(estado: EstadoForm, accion: AccionForm): EstadoForm {
  switch (accion.tipo) {
    case 'escribir': {
      const campos = { ...estado.campos, [accion.campo]: accion.valor };
      if (!esCampoGps(accion.campo)) return { ...estado, campos };
      const deGps = new Set(estado.deGps);
      deGps.delete(accion.campo);
      return { campos, editados: new Set(estado.editados).add(accion.campo), deGps };
    }
    case 'gps': {
      // forzar = "Volver a llenar": se olvida lo escrito a mano en el domicilio
      const editados = accion.forzar ? new Set<CampoGps>() : estado.editados;
      return {
        campos: aplicarDireccion(estado.campos, accion.direccion, editados, accion.forzar),
        editados,
        deGps: camposLlenables(accion.direccion, editados, accion.forzar),
      };
    }
  }
}

/** Una línea que dice en qué va el GPS y qué debe revisar el lecturista. */
function AvisoGps({ estado }: { estado: EstadoGps }) {
  const precision = 'precision' in estado ? estado.precision : undefined;
  const baja = precision !== undefined && precision > PRECISION_BAJA_M;

  const linea = (() => {
    switch (estado.fase) {
      case 'inactivo':
        return null;
      case 'ubicando':
        return <p className="flex items-center gap-1.5 text-slate-600"><LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> Obteniendo tu ubicación…</p>;
      case 'buscando':
        return <p className="flex items-center gap-1.5 text-slate-600"><LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> Buscando la dirección de ese punto…</p>;
      case 'listo':
        return (
          <p className="flex items-start gap-1.5 text-[#0b6b58] font-medium">
            <CircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            Llenamos el domicilio con la ubicación. Revisa sobre todo el número exterior.
          </p>
        );
      case 'sin-direccion':
        return <p className="text-[#7a5600] font-medium">No hay una dirección registrada en ese punto. Llénala a mano.</p>;
      case 'fuera':
        return (
          <p className="flex items-start gap-1.5 rounded-lg bg-[#fff4cc] px-3 py-2 text-[#7a5600] font-medium">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {estado.motivo === 'gps'
              ? 'Tu ubicación aparece fuera de Aguascalientes (puede ser un error del GPS). Toca el mapa para marcar el domicilio.'
              : 'Ese punto está fuera del estado de Aguascalientes. Elige uno dentro de la zona marcada.'}
          </p>
        );
      case 'error':
        return <p className="text-[#7a5600] font-medium">{estado.mensaje}</p>;
    }
  })();

  return (
    <>
      {linea}
      {baja && (
        <p className="flex items-start gap-1.5 rounded-lg bg-[#fff4cc] px-3 py-2 text-[#7a5600]">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Precisión baja (<span className="cifras">±{precision} m</span>): puede ser otra casa de la cuadra.
            Arrastra el marcador al domicilio correcto.
          </span>
        </p>
      )}
    </>
  );
}

export function NuevaQueja() {
  const navigate = useNavigate();
  const [{ campos: form, editados, deGps }, despachar] = useReducer(reducirForm, {
    campos: VACIO,
    editados: new Set<CampoGps>(),
    deGps: new Set<CampoGps>(),
  });
  const [ubicacion, setUbicacion] = useState<Coordenadas | null>(null);
  const [fotos, setFotos] = useState<string[]>([]);

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [procesandoFoto, setProcesandoFoto] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const colorNormal = 'gray';
  const colorHover = '#09426F';
  const estiloBoton = {
    backgroundColor: isHovered ? colorHover : colorNormal,
    color: 'white',
    padding: '10px 20px',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
  };

  // ---------- Autollenado por GPS ----------
  // Si el navegador tiene GPS arrancamos en "ubicando": el efecto de abajo lo pide al abrir.
  const [gps, setGps] = useState<EstadoGps>(hayGeolocalizacion ? { fase: 'ubicando' } : { fase: 'inactivo' });
  /** Última dirección que dio el GPS (para el botón "Volver a llenar"). */
  const [sugerencia, setSugerencia] = useState<DireccionGps | null>(null);
  const temporizador = useRef<number | undefined>(undefined);
  const peticion = useRef<AbortController | null>(null);

  const cancelarBusqueda = () => {
    window.clearTimeout(temporizador.current);
    peticion.current?.abort();
  };

  /** Busca la dirección del punto. Espera 600 ms por si siguen moviendo el marcador. */
  const programarBusqueda = (punto: Coordenadas, precision?: number) => {
    cancelarBusqueda();
    temporizador.current = window.setTimeout(async () => {
      const control = new AbortController();
      peticion.current = control;
      try {
        const r = await direccionDesdeCoordenadas(punto, control.signal);
        if (r.tipo === 'sin-direccion') return setGps({ fase: 'sin-direccion', precision });
        if (r.tipo === 'fuera-de-ags') return setGps({ fase: 'fuera', motivo: 'direccion', precision });

        despachar({ tipo: 'gps', direccion: r.direccion }); // el reducer respeta lo editado
        setSugerencia(r.direccion);
        setGps({ fase: 'listo', precision });
      } catch (err) {
        if (control.signal.aborted) return; // la cancelamos nosotros: llegó un punto más nuevo
        console.warn('Geocodificación falló:', err);
        setGps({ fase: 'error', mensaje: 'No se pudo obtener la dirección. Llénala a mano.' });
      }
    }, 600);
  };

  /**
   * Pide la posición al dispositivo. No cambia estado al llamarse, solo en sus callbacks.
   * @param maximumAge ms que aceptamos una posición ya guardada (0 = siempre una lectura nueva)
   */
  const pedirPosicion = (maximumAge: number) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const punto = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const precision = Math.round(pos.coords.accuracy);
        // Lejos del estado (o GPS equivocado): no movemos nada, que lo marquen en el mapa
        if (!dentroDeAguascalientes(punto)) {
          setGps({ fase: 'fuera', motivo: 'gps', precision });
          return;
        }
        setUbicacion(punto);
        setGps({ fase: 'buscando', precision });
        programarBusqueda(punto, precision);
      },
      (err) => {
        setGps({
          fase: 'error',
          mensaje:
            err.code === err.PERMISSION_DENIED
              ? 'No diste permiso de ubicación. Toca el mapa para marcar el punto o llena la dirección a mano.'
              : 'No se encontró tu ubicación. Toca el mapa para marcar el punto o llena la dirección a mano.',
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge },
    );
  };

  // Al abrir el formulario: pedir la ubicación una vez. useEffectEvent (React 19.2)
  // deja usar la versión más reciente de pedirPosicion sin meterla en las dependencias.
  const alAbrir = useEffectEvent(() => {
    // Al abrir aceptamos una posición de hasta 30 s: sale más rápido
    if (hayGeolocalizacion) pedirPosicion(30_000);
  });
  const alSalir = useEffectEvent(() => cancelarBusqueda());
  useEffect(() => {
    alAbrir();
    return () => alSalir(); // si salen del formulario, no dejar peticiones colgando
  }, []);

  /** Botón "Usar mi ubicación". */
  const usarMiUbicacion = () => {
    if (!hayGeolocalizacion) {
      setGps({ fase: 'error', mensaje: 'Este dispositivo no permite obtener la ubicación. Toca el mapa para marcar el punto.' });
      return;
    }
    cancelarBusqueda();
    setGps({ fase: 'ubicando' });
    pedirPosicion(0); // lo pidieron a propósito: lectura nueva, no la guardada
  };

  /** Clic en el mapa o marcador arrastrado: el punto es exacto (lo eligió una persona). */
  const moverPunto = (punto: Coordenadas) => {
    setUbicacion(punto);
    setGps({ fase: 'buscando' });
    programarBusqueda(punto);
  };

  /** Tocaron o soltaron el marcador fuera del estado: el punto anterior se queda. */
  const puntoFuera = () => {
    cancelarBusqueda();
    setGps({ fase: 'fuera', motivo: 'mapa' });
  };

  const quitarPunto = () => {
    cancelarBusqueda();
    setUbicacion(null);
    setGps({ fase: 'inactivo' });
  };

  /** "Volver a llenar con el GPS": descarta lo escrito a mano en los campos del domicilio. */
  const volverALlenar = () => {
    if (sugerencia) despachar({ tipo: 'gps', direccion: sugerencia, forzar: true });
  };

  const cambiar = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    // Si es un campo del domicilio, el reducer lo marca como "editado a mano"
    despachar({ tipo: 'escribir', campo: e.target.name as keyof CamposTexto, valor: e.target.value });
  };

  /** Props comunes de cada input: valor, cambio, error accesible y marca de "lo llenó el GPS". */
  const props = (nombre: keyof CamposTexto) => ({
    id: nombre,
    name: nombre,
    value: form[nombre],
    onChange: cambiar,
    'aria-invalid': Boolean(errores[nombre]),
    'aria-describedby': errores[nombre] ? `${nombre}-error` : undefined,
    'data-gps': esCampoGps(nombre) && deGps.has(nombre) ? true : undefined,
  });

  const agregarFoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir la misma foto
    if (!archivo) return;

    setProcesandoFoto(true);
    try {
      const base64 = await comprimirFotoCamara(archivo); // ≤ 200 KB (utils/cameraHelper.ts)
      setFotos((prev) => [...prev, base64].slice(0, MAX_FOTOS));
    } catch {
      setAviso('Esa imagen no se pudo usar. Intenta con otra foto.');
    } finally {
      setProcesandoFoto(false);
    }
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    // Última revisión (el backend también la hace; esto solo evita un viaje inútil)
    if (ubicacion && !dentroDeAguascalientes(ubicacion)) {
      setErrorGeneral('El punto del mapa está fuera de Aguascalientes. Márcalo dentro del estado.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
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
      navigate(`/mis-quejas/${creada.id}`, { replace: true, state: { recienCreada: true } });
    } catch (err) {
      const { mensaje, errores: porCampo } = leerError(err);
      setErrorGeneral(mensaje);
      setErrores(porCampo);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setEnviando(false);
    }
  };
  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/mis-quejas" className="inline-flex items-center gap-1.5 h-10 text-sm font-semibold text-miaa-azul hover:text-miaa-marino">
        <ArrowLeft size={18} aria-hidden="true" /> Mis quejas
      </Link>
      <h1 className="mt-1 text-3xl font-extrabold text-miaa-marino">Registrar queja</h1>
      <p className="mt-1 text-slate-600">Todos los campos son obligatorios, salvo los marcados como opcionales.</p>

      {errorGeneral && (
        <div className="mt-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800" role="alert">
          <p className="font-bold">{errorGeneral}</p>
          {Object.keys(errores).length > 0 && <p className="text-sm">Revisa los campos marcados en rojo.</p>}
        </div>
      )}

      <form onSubmit={enviar} className="mt-6 space-y-4">
        {/* ---------- 1. Ubicación (primero: de aquí sale la dirección) ---------- */}
        <Paso numero={1} titulo="¿Dónde está el problema?" ayuda="Usamos tu ubicación para llenar el domicilio. Si no es la casa exacta, toca el mapa o arrastra el marcador. Solo se aceptan puntos dentro del estado (la zona sin sombra).">
          <button
            type="button"
            onClick={usarMiUbicacion}
            disabled={gps.fase === 'ubicando'}
            className="mb-3 inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-miaa-bruma/60 text-miaa-marino font-semibold hover:bg-miaa-bruma disabled:opacity-60"
          >
            {gps.fase === 'ubicando'
              ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
              : <LocateFixed size={18} aria-hidden="true" />}
            {gps.fase === 'ubicando' ? 'Buscando tu ubicación…' : 'Usar mi ubicación'}
          </button>

          <MapaUbicacion valor={ubicacion} onChange={moverPunto} onFuera={puntoFuera} />

          <div className="mt-2 space-y-1 text-sm" role="status" aria-live="polite">
            <AvisoGps estado={gps} />
            {ubicacion ? (
              <p className="text-slate-600">
                Punto en <span className="cifras font-semibold">{ubicacion.lat.toFixed(5)}, {ubicacion.lng.toFixed(5)}</span>.{' '}
                <button type="button" onClick={quitarPunto} className="font-semibold text-red-700 underline">
                  Quitar
                </button>
              </p>
            ) : (
              gps.fase !== 'ubicando' && <p className="text-slate-500">Sin punto marcado (opcional).</p>
            )}
            {(errores.latitud || errores.longitud) && <p className="text-red-700">{errores.latitud ?? errores.longitud}</p>}
          </div>
        </Paso>

        {/* ---------- 2. Domicilio (lo llena el GPS, pero todo se puede editar) ---------- */}
        <Paso numero={2} titulo="Domicilio" ayuda="Revisa y corrige lo que haga falta. Lo que escribas a mano ya no lo cambia el GPS.">
          <div className="grid grid-cols-12 gap-4">
            <Campo id="calle" deGps={deGps.has('calle')} etiqueta="Calle" error={errores.calle} className="col-span-12 sm:col-span-6">
              <input {...props('calle')} required maxLength={150} autoComplete="address-line1" className={claseInput} />
            </Campo>
            <Campo id="numeroExterior" deGps={deGps.has('numeroExterior')} etiqueta="Núm. exterior" error={errores.numeroExterior} className="col-span-6 sm:col-span-3">
              <input {...props('numeroExterior')} required maxLength={20} placeholder="Ver fachada" className={claseInput} />
            </Campo>
            <Campo id="numeroInterior" etiqueta="Núm. interior" opcional error={errores.numeroInterior} className="col-span-6 sm:col-span-3">
              <input {...props('numeroInterior')} maxLength={20} className={claseInput} />
            </Campo>

            <Campo id="colonia" deGps={deGps.has('colonia')} etiqueta="Colonia" error={errores.colonia} className="col-span-12 sm:col-span-5">
              <input {...props('colonia')} required maxLength={100} className={claseInput} />
            </Campo>
            <Campo id="codigoPostal" deGps={deGps.has('codigoPostal')} etiqueta="C.P." error={errores.codigoPostal} className="col-span-4 sm:col-span-3">
              <input
                {...props('codigoPostal')}
                required
                inputMode="numeric"
                pattern="20\d{3}"
                title="C.P. de Aguascalientes: del 20000 al 20999"
                maxLength={5}
                placeholder="20000"
                className={`${claseInput} cifras`}
              />
            </Campo>
            <Campo id="municipio" deGps={deGps.has('municipio')} etiqueta="Municipio" error={errores.municipio} className="col-span-8 sm:col-span-4">
              <select {...props('municipio')} className={claseInput}>
                {MUNICIPIOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Campo>

            <Campo id="referencias" etiqueta="Referencias" opcional error={errores.referencias} className="col-span-12 sm:col-span-7">
              <input {...props('referencias')} maxLength={255} placeholder="Entre calles, color de fachada…" className={claseInput} />
            </Campo>
            <Campo id="numeroContrato" etiqueta="Núm. de contrato" opcional error={errores.numeroContrato} className="col-span-12 sm:col-span-5">
              <input {...props('numeroContrato')} maxLength={30} inputMode="numeric" className={`${claseInput} cifras`} />
            </Campo>
          </div>

          {sugerencia && editados.size > 0 && (
            <button
              type="button"
              onClick={volverALlenar}
              className="mt-4 inline-flex items-center gap-1.5 h-10 text-sm font-semibold text-miaa-azul hover:text-miaa-marino"
            >
              <RotateCcw size={15} aria-hidden="true" /> Volver a llenar con la ubicación
            </button>
          )}
        </Paso>

        {/* ---------- 3. Qué pasa ---------- */}
        <Paso numero={3} titulo="¿Qué está pasando?">
          <fieldset>
            <legend className="text-sm font-semibold text-miaa-marino mb-2">Tipo de problema</legend>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(CATEGORIAS) as CategoriaQueja[]).map((c) => {
                const Icono = ICONO_CATEGORIA[c];
                const elegida = form.categoria === c;
                return (
                  <label
                    key={c}
                    className={`relative flex flex-col items-start gap-2 min-h-20 p-3 rounded-xl border-2 cursor-pointer transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-miaa-cielo ${
                      elegida ? 'border-miaa-marino bg-miaa-bruma/40 text-miaa-marino' : 'border-slate-200 bg-white text-slate-700 hover:border-miaa-azul'
                    }`}
                  >
                    <input type="radio" name="categoria" value={c} checked={elegida} onChange={cambiar} className="sr-only" />
                    <Icono size={22} className={elegida ? 'text-miaa-marino' : 'text-miaa-azul'} aria-hidden="true" />
                    <span className="text-sm font-semibold leading-tight">{CATEGORIAS[c]}</span>
                  </label>
                );
              })}
            </div>
            {errores.categoria && <p className="mt-1.5 text-sm text-red-700">{errores.categoria}</p>}
          </fieldset>

          <fieldset className="mt-6">
            <legend className="text-sm font-semibold text-miaa-marino mb-2">Prioridad</legend>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(PRIORIDADES) as PrioridadQueja[]).map((p) => {
                const elegida = form.prioridad === p;
                return (
                  <label
                    key={p}
                    className={`flex flex-col justify-center min-h-16 px-3 py-2 rounded-xl border-2 cursor-pointer transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-miaa-cielo ${
                      elegida
                        ? p === 'ALTA'
                          ? 'border-red-700 bg-red-50 text-red-800'
                          : 'border-miaa-marino bg-miaa-bruma/40 text-miaa-marino'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-miaa-azul'
                    }`}
                  >
                    <input type="radio" name="prioridad" value={p} checked={elegida} onChange={cambiar} className="sr-only" />
                    <span className="font-bold">{PRIORIDADES[p]}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <Campo id="descripcion" etiqueta="Descripción" error={errores.descripcion} className="mt-6">
            <textarea
              {...props('descripcion')}
              required
              minLength={10}
              maxLength={2000}
              rows={4}
              placeholder="Qué viste, desde cuándo pasa y a quién afecta."
              className={`${claseInput} h-auto py-3 leading-relaxed`}
            />
            <p className="mt-1 text-right text-xs text-slate-500 cifras">{form.descripcion.length} de 2000</p>
          </Campo>
        </Paso>

        {/* ---------- 4. Fotos ---------- */}
        <Paso numero={4} titulo="Fotos de evidencia" ayuda={`Opcional, hasta ${MAX_FOTOS}. Se comprimen solas para no gastar datos.`}>
          <div className="flex flex-wrap gap-3">
            {fotos.map((f, i) => (
              <div key={i} className="relative">
                <img src={f} alt={`Foto ${i + 1} de evidencia`} className="size-28 object-cover rounded-xl border border-slate-200" />
                <button
                  type="button"
                  onClick={() => setFotos((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={`Quitar foto ${i + 1}`}
                  className="absolute -top-2 -right-2 size-8 grid place-items-center rounded-full bg-white border border-slate-300 text-slate-700 shadow-sm hover:text-red-700"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            ))}

            {fotos.length < MAX_FOTOS && (
              <label className="size-28 rounded-xl border-2 border-dashed border-miaa-azul/50 bg-blue-50/50 flex flex-col items-center justify-center gap-1.5 text-miaa-azul text-sm font-semibold cursor-pointer hover:bg-blue-50 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-miaa-cielo">
                {procesandoFoto
                  ? <LoaderCircle size={24} className="animate-spin" aria-hidden="true" />
                  : <Camera size={24} aria-hidden="true" />}
                {procesandoFoto ? 'Procesando' : 'Agregar foto'}
                {/* Sin capture="environment": así pueden elegir cámara o galería */}
                <input type="file" accept="image/*" onChange={agregarFoto} className="sr-only" disabled={procesandoFoto} />
              </label>
            )}
          </div>
          {errores.fotos && <p className="mt-1.5 text-sm text-red-700">{errores.fotos}</p>}
        </Paso>

        {aviso && (
          <div className="p-4 rounded-xl bg-[#fff4cc] text-[#7a5600] text-sm font-medium" role="status">{aviso}</div>
        )}

        <div className="sticky bottom-20 md:bottom-4 z-20 flex gap-3 p-3 -mx-3 rounded-2xl bg-white/95 backdrop-blur border border-slate-200 shadow-lg shadow-miaa-marino/10">
          <Link
            to="/mis-quejas"
            className="inline-flex items-center justify-center h-12 px-5 rounded-xl font-semibold text-slate-700 hover:bg-slate-100"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={enviando || procesandoFoto}
            className="flex-1 inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl text-white font-bold hover:bg-blue-800 disabled:opacity-60 transition-colors"
            style={estiloBoton}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {enviando && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
            {enviando ? 'Registrando…' : 'Registrar queja'}
          </button>
        </div>
      </form>
    </div>
  );
}