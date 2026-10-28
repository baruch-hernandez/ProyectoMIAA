import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, LoaderCircle } from 'lucide-react';
import { reportesApi, leerError } from '../../services/reportesApi';
import type { Coordenadas, ReporteDetalle, ReporteEdicion } from '../../types/reporte';
import { formatoFecha, MUNICIPIOS } from '../../utils/catalogos';
import { claseInput } from '../../utils/estilos';
import { dentroDeAguascalientes } from '../../utils/limiteAgs';
import { MapaUbicacion } from '../mapa/MapaUbicacion';
import { Campo, Paso } from '../reportes/Formulario';

type Campos = Omit<ReporteEdicion, 'latitud' | 'longitud'>;

function aCampos(r: ReporteDetalle): Campos {
  return {
    calle: r.calle,
    numeroExterior: r.numeroExterior,
    numeroInterior: r.numeroInterior ?? '',
    colonia: r.colonia,
    codigoPostal: r.codigoPostal,
    municipio: r.municipio,
    referencias: r.referencias ?? '',
    numeroContrato: r.numeroContrato ?? '',
    descripcion: r.descripcion,
  };
}

/**
 * Corregir domicilio, ubicación o descripción de un reporte propio, en las primeras
 * horas después de enviarlo. Las fotos se cambian desde el detalle (en el mismo plazo).
 */
export function EditarReporte() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const [reporte, setReporte] = useState<ReporteDetalle | null>(null);
  const [form, setForm] = useState<Campos | null>(null);
  const [ubicacion, setUbicacion] = useState<Coordenadas | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [avisoMapa, setAvisoMapa] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (Number.isNaN(id)) return;
    let ignorar = false;
    reportesApi
      .detalle(id)
      .then((r) => {
        if (ignorar) return;
        setReporte(r);
        setForm(aCampos(r));
        setUbicacion(r.latitud != null && r.longitud != null ? { lat: r.latitud, lng: r.longitud } : null);
      })
      .catch((err) => { if (!ignorar) setErrorCarga(leerError(err).mensaje); });
    return () => { ignorar = true; };
  }, [id]);

  const volver = (
    <Link to={`/reportes/${id}`} className="inline-flex items-center gap-1.5 h-10 text-sm font-semibold text-miaa-azul hover:text-miaa-marino">
      <ArrowLeft size={18} aria-hidden="true" /> Volver al reporte
    </Link>
  );

  if (errorCarga || (reporte && !reporte.puedeModificar)) {
    return (
      <div className="max-w-xl">
        {volver}
        <div className="mt-3 p-5 rounded-2xl bg-white border border-slate-200">
          <p className="font-bold text-miaa-marino">Este reporte ya no se puede corregir.</p>
          <p className="mt-1 text-sm text-slate-600">
            {errorCarga ?? 'Ya pasó el tiempo para corregirlo. Puedes agregarle una nota con la corrección.'}
          </p>
        </div>
      </div>
    );
  }

  if (!reporte || !form) {
    return (
      <div className="space-y-4" aria-busy="true">
        {volver}
        <div className="h-96 rounded-2xl bg-white/70 animate-pulse" />
      </div>
    );
  }

  const cambiar = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };
  const props = (nombre: keyof Campos) => ({
    id: nombre,
    name: nombre,
    value: form[nombre],
    onChange: cambiar,
    'aria-invalid': Boolean(errores[nombre]),
    'aria-describedby': errores[nombre] ? `${nombre}-error` : undefined,
  });

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (ubicacion && !dentroDeAguascalientes(ubicacion)) {
      setErrorGeneral('El punto del mapa está fuera de Aguascalientes.');
      return;
    }
    setGuardando(true);
    setErrorGeneral(null);
    setErrores({});
    try {
      await reportesApi.editar(id, { ...form, latitud: ubicacion?.lat ?? null, longitud: ubicacion?.lng ?? null });
      navigate(`/reportes/${id}`, { replace: true, state: { editado: true } });
    } catch (err) {
      const { mensaje, errores: porCampo } = leerError(err);
      setErrorGeneral(mensaje);
      setErrores(porCampo);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {volver}
      <h1 className="mt-1 text-3xl font-extrabold text-miaa-marino">Corregir reporte</h1>
      <p className="mt-1 text-slate-600">
        <span className="cifras font-semibold">{reporte.folio}</span> · El administrador verá que fue editado.
        {reporte.modificableHasta && <> Puedes corregirlo hasta el {formatoFecha(reporte.modificableHasta)}</>}
      </p>

      {errorGeneral && (
        <div className="mt-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800" role="alert">
          <p className="font-bold">{errorGeneral}</p>
          {Object.keys(errores).length > 0 && <p className="text-sm">Revisa los campos marcados en rojo.</p>}
        </div>
      )}

      <form onSubmit={guardar} className="mt-6 space-y-4">
        <Paso numero={1} titulo="Ubicación" ayuda="Toca el mapa o arrastra el marcador si el punto no es el correcto.">
          <MapaUbicacion
            valor={ubicacion}
            onChange={(p) => { setUbicacion(p); setAvisoMapa(null); }}
            onFuera={() => setAvisoMapa('Ese punto está fuera del estado de Aguascalientes.')}
          />
          {avisoMapa && <p className="mt-2 text-sm font-medium text-[#7a5600]">{avisoMapa}</p>}
        </Paso>

        <Paso numero={2} titulo="Domicilio">
          <div className="grid grid-cols-12 gap-4">
            <Campo id="calle" etiqueta="Calle" error={errores.calle} className="col-span-12 sm:col-span-6">
              <input {...props('calle')} required maxLength={150} className={claseInput} />
            </Campo>
            <Campo id="numeroExterior" etiqueta="Núm. exterior" error={errores.numeroExterior} className="col-span-6 sm:col-span-3">
              <input {...props('numeroExterior')} required maxLength={20} className={claseInput} />
            </Campo>
            <Campo id="numeroInterior" etiqueta="Núm. interior" opcional error={errores.numeroInterior} className="col-span-6 sm:col-span-3">
              <input {...props('numeroInterior')} maxLength={20} className={claseInput} />
            </Campo>
            <Campo id="colonia" etiqueta="Colonia" error={errores.colonia} className="col-span-12 sm:col-span-5">
              <input {...props('colonia')} required maxLength={100} className={claseInput} />
            </Campo>
            <Campo id="codigoPostal" etiqueta="C.P." error={errores.codigoPostal} className="col-span-4 sm:col-span-3">
              <input {...props('codigoPostal')} required inputMode="numeric" pattern="20\d{3}" maxLength={5} className={`${claseInput} cifras`} />
            </Campo>
            <Campo id="municipio" etiqueta="Municipio" error={errores.municipio} className="col-span-8 sm:col-span-4">
              <select {...props('municipio')} className={claseInput}>
                {MUNICIPIOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Campo>
            <Campo id="referencias" etiqueta="Referencias" opcional error={errores.referencias} className="col-span-12 sm:col-span-7">
              <input {...props('referencias')} maxLength={255} className={claseInput} />
            </Campo>
            <Campo id="numeroContrato" etiqueta="Núm. de contrato" opcional error={errores.numeroContrato} className="col-span-12 sm:col-span-5">
              <input {...props('numeroContrato')} maxLength={30} inputMode="numeric" className={`${claseInput} cifras`} />
            </Campo>
          </div>
        </Paso>

        <Paso numero={3} titulo="Descripción">
          <Campo id="descripcion" etiqueta="Descripción del reporte" error={errores.descripcion}>
            <textarea {...props('descripcion')} required minLength={10} maxLength={2000} rows={4} className={`${claseInput} h-auto py-3 leading-relaxed`} />
          </Campo>
        </Paso>

        <div className="sticky bottom-20 md:bottom-4 z-20 flex gap-3 p-3 -mx-3 rounded-2xl bg-white/95 backdrop-blur border border-slate-200 shadow-lg shadow-miaa-marino/10">
          <Link to={`/reportes/${id}`} className="inline-flex items-center justify-center h-12 px-5 rounded-xl font-semibold text-slate-700 hover:bg-slate-100">
            Cancelar
          </Link>
          <button type="submit" disabled={guardando} className="flex-1 inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-miaa-marino text-white font-bold hover:bg-blue-800 disabled:opacity-60 transition-colors">
            {guardando && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
