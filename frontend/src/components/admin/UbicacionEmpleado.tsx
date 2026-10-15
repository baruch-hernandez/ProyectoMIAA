import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Circle, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import { ArrowLeft, ExternalLink, LocateFixed, MapPinOff, WifiOff } from 'lucide-react';
import { usuariosApi } from '../../services/usuariosApi';
import { leerError } from '../../services/reportesApi';
import type { UbicacionEmpleado as Ubicacion } from '../../types/reporte';
import { formatoFecha } from '../../utils/catalogos';
import { dentroDeAguascalientes, PROPS_MAPA_AGS } from '../../utils/limiteAgs';
import { CapaLimiteAgs } from '../mapa/CapaLimiteAgs';
import '../mapa/iconosLeaflet';
import { CuentaEmpleadoPanel } from './CuentaEmpleadoPanel';

/** Cada cuánto pregunta el admin (solo mientras esta pantalla esté abierta y visible). */
const CONSULTA_MS = 5_000;

/** "hace 12 s", "hace 3 min", "hace 2 h" */
function haceCuanto(segundos: number): string {
  if (segundos < 60) return `hace ${segundos} s`;
  const min = Math.floor(segundos / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} d`;
}

/** Mueve el mapa hacia el empleado cada vez que cambia de posición (si "Seguir" está activo). */
function Seguir({ lat, lng, activo }: { lat: number; lng: number; activo: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (activo) map.setView([lat, lng], Math.max(map.getZoom(), 16), { animate: true });
  }, [lat, lng, activo, map]);
  return null;
}

/**
 * Ficha de un notificador (solo ADMIN): su cuenta y su ubicación EN VIVO.
 * Pregunta al backend cada 5 s; si la pestaña está oculta, deja de preguntar
 * (no tiene caso gastar peticiones) y al volver pregunta de inmediato.
 */
export function UbicacionEmpleado() {
  const id = Number(useParams().id);
  const [datos, setDatos] = useState<Ubicacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seguir, setSeguir] = useState(true);
  // Cuándo llegó la última respuesta (para que "hace X s" avance entre consultas)
  const [recibidoEn, setRecibidoEn] = useState(() => Date.now());
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    if (Number.isNaN(id)) return;
    let cancelado = false;
    let temporizador: number | undefined;

    // setTimeout encadenado (no setInterval): nunca se encimen dos consultas si una tarda
    const consultar = async () => {
      window.clearTimeout(temporizador);
      if (!document.hidden) {
        try {
          const d = await usuariosApi.ubicacion(id);
          if (cancelado) return;
          setDatos(d);
          setRecibidoEn(Date.now());
          setError(null);
        } catch (err) {
          if (!cancelado) setError(leerError(err).mensaje);
        }
      }
      if (!cancelado) temporizador = window.setTimeout(consultar, CONSULTA_MS);
    };
    const alCambiarVisibilidad = () => { if (!document.hidden) consultar(); };

    consultar();
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    return () => {
      cancelado = true;
      window.clearTimeout(temporizador);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    };
  }, [id]);

  // Reloj de 1 s solo para el texto "hace X s"
  useEffect(() => {
    const reloj = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(reloj);
  }, []);

  const volver = (
    <Link to="/admin/empleados" className="inline-flex items-center gap-1.5 h-10 text-sm font-semibold text-miaa-azul hover:text-miaa-marino">
      <ArrowLeft size={18} aria-hidden="true" /> Empleados
    </Link>
  );

  if (Number.isNaN(id) || (!datos && error)) {
    return (
      <div className="max-w-xl">
        {volver}
        <div className="mt-3 p-5 rounded-2xl bg-white border border-slate-200">
          <p className="font-bold text-miaa-marino">No se pudo cargar la ubicación.</p>
          <p className="mt-1 text-sm text-slate-600">{error ?? 'La dirección no es válida.'}</p>
        </div>
      </div>
    );
  }

  if (!datos) {
    return (
      <div className="space-y-4" aria-busy="true">
        {volver}
        <div className="h-24 rounded-3xl bg-white/70 animate-pulse" />
        <div className="h-[28rem] rounded-2xl bg-white/70 animate-pulse" />
      </div>
    );
  }

  const d = datos;
  const pos = d.tieneUbicacion && d.latitud != null && d.longitud != null ? { lat: d.latitud, lng: d.longitud } : null;
  // Segundos desde la última señal, avanzando cada segundo entre consultas
  const segundos = d.segundosDesdeUltima == null ? null : d.segundosDesdeUltima + Math.floor((ahora - recibidoEn) / 1000);
  const fueraDeAgs = pos != null && !dentroDeAguascalientes(pos);

  return (
    <div className="space-y-5">
      {volver}

      {/* ---------- Encabezado con el estado ---------- */}
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white border border-slate-200 p-5 sm:p-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-miaa-marino">{d.nombre}</h1>
          <p className="text-sm text-slate-500">{d.username}</p>
        </div>

        <div className="text-right" aria-live="polite">
          {d.enLinea ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-[#d3fbf2] px-3 py-1.5 text-sm font-bold text-[#0b6b58]">
              <span className="relative flex size-2.5" aria-hidden="true">
                <span className="absolute inline-flex size-full rounded-full bg-miaa-menta opacity-75 animate-ping" />
                <span className="relative inline-flex size-2.5 rounded-full bg-[#0fa987]" />
              </span>
              En línea
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-200 px-3 py-1.5 text-sm font-bold text-slate-700">
              {pos ? <WifiOff size={15} aria-hidden="true" /> : <MapPinOff size={15} aria-hidden="true" />}
              {pos ? 'Sin conexión' : 'Sin ubicación'}
            </span>
          )}
          {segundos != null && d.fechaRecibida && (
            <p className="mt-1.5 text-sm text-slate-600">
              Última señal <strong className="cifras text-miaa-marino">{haceCuanto(segundos)}</strong>
              <span className="text-slate-400"> · {formatoFecha(d.fechaRecibida)}</span>
            </p>
          )}
        </div>
      </header>

      <CuentaEmpleadoPanel id={id} />

      {!pos ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-10 text-center">
          <p className="font-bold text-miaa-marino">{d.nombre} aún no ha compartido su ubicación.</p>
          <p className="mt-1 text-sm text-slate-600 max-w-md mx-auto">
            Aparecerá aquí en cuanto abra la app en su celular con la ubicación permitida. Esta pantalla se actualiza sola.
          </p>
        </div>
      ) : (
        <section className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 space-y-3">
          {!d.enLinea && (
            <p className="rounded-lg bg-[#fff4cc] px-3 py-2 text-sm font-medium text-[#7a5600]">
              No llega su ubicación desde hace más de {d.segundosParaEnLinea} s (sin red, app cerrada o pantalla apagada).
              El mapa muestra <strong>el último lugar conocido</strong>.
            </p>
          )}
          {fueraDeAgs && (
            <p className="rounded-lg bg-[#fff4cc] px-3 py-2 text-sm font-medium text-[#7a5600]">
              La ubicación está fuera del estado de Aguascalientes; usa "Abrir en Google Maps" para verla.
            </p>
          )}

          <div className="h-[28rem] rounded-xl overflow-hidden border border-slate-200 relative z-0">
            <MapContainer center={[pos.lat, pos.lng]} zoom={16} scrollWheelZoom {...PROPS_MAPA_AGS} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <CapaLimiteAgs />
              {/* Círculo = margen de error del GPS: el empleado está "en algún punto" dentro */}
              {d.precisionMetros != null && (
                <Circle
                  center={[pos.lat, pos.lng]}
                  radius={d.precisionMetros}
                  pathOptions={{ color: d.enLinea ? '#1aa3e0' : '#64748b', weight: 1, fillOpacity: 0.15 }}
                />
              )}
              <Marker position={[pos.lat, pos.lng]} opacity={d.enLinea ? 1 : 0.55} />
              <Seguir lat={pos.lat} lng={pos.lng} activo={seguir} />
            </MapContainer>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-slate-600">
              <span className="cifras">{pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}</span>
              {d.precisionMetros != null && <> · precisión <span className="cifras font-semibold">±{Math.round(d.precisionMetros)} m</span></>}
              {' '}· se actualiza cada {CONSULTA_MS / 1000} s
            </p>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 h-10 px-3 rounded-xl font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer">
                <input type="checkbox" checked={seguir} onChange={(e) => setSeguir(e.target.checked)} className="size-4 accent-miaa-marino" />
                <LocateFixed size={16} aria-hidden="true" /> Seguir en el mapa
              </label>
              <a
                href={`https://www.google.com/maps?q=${pos.lat},${pos.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl font-semibold text-miaa-azul hover:bg-blue-50"
              >
                <ExternalLink size={16} aria-hidden="true" /> Abrir en Google Maps
              </a>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
