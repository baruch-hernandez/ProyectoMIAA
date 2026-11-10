import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from 'react-leaflet';
import type { Map as MapaLeaflet } from 'leaflet';
import { MapPinOff } from 'lucide-react';
import { usuariosApi } from '../../services/usuariosApi';
import { leerError } from '../../services/reportesApi';
import type { UbicacionEmpleado } from '../../types/reporte';
import { CENTRO_AGS, CONSULTA_MS, haceCuanto } from '../../utils/catalogos';
import { PROPS_MAPA_AGS } from '../../utils/limiteAgs';
import { CapaLimiteAgs } from '../mapa/CapaLimiteAgs';

const VERDE = '#0fa987';
const GRIS = '#64748b';

/**
 * Mapa de Aguascalientes con TODOS los notificadores (solo ADMIN). Igual que la ficha de un
 * empleado: pregunta cada 5 s mientras la pestaña está visible. Verde = en línea;
 * gris = sin conexión (se muestra el último lugar conocido).
 */
export function MapaNotificadores() {
  const [lista, setLista] = useState<UbicacionEmpleado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapa, setMapa] = useState<MapaLeaflet | null>(null);
  const [recibidoEn, setRecibidoEn] = useState(() => Date.now());
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    let cancelado = false;
    let temporizador: number | undefined;
    // setTimeout encadenado (no setInterval): nunca se encimen dos consultas si una tarda
    const consultar = async () => {
      window.clearTimeout(temporizador);
      if (!document.hidden) {
        try {
          const d = await usuariosApi.ubicaciones();
          if (cancelado) return;
          setLista(d);
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
  }, []);

  // Reloj de 1 s solo para el texto "hace X s"
  useEffect(() => {
    const reloj = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(reloj);
  }, []);

  const conPunto = (lista ?? []).filter((e) => e.tieneUbicacion && e.latitud != null && e.longitud != null);
  const enLinea = (lista ?? []).filter((e) => e.enLinea).length;
  // En línea primero; luego los que tienen último punto; al final los que nunca han compartido
  const ordenados = [...(lista ?? [])].sort((a, b) => Number(b.enLinea) - Number(a.enLinea) || Number(b.tieneUbicacion) - Number(a.tieneUbicacion));
  const ultimaSenal = (e: UbicacionEmpleado) =>
    e.segundosDesdeUltima == null ? null : haceCuanto(e.segundosDesdeUltima + Math.floor((ahora - recibidoEn) / 1000));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-miaa-marino">Mapa de notificadores</h1>
          <p className="mt-1 text-sm text-slate-600">Se actualiza solo cada {CONSULTA_MS / 1000} s.</p>
        </div>
        {lista && (
          <p className="text-sm font-semibold text-slate-700" aria-live="polite">
            <span className="tabular-nums text-[#0b6b58]">{enLinea}</span> en línea de <span className="tabular-nums">{lista.length}</span>
          </p>
        )}
      </header>

      {error && (
        <p className="rounded-lg bg-[#fff4cc] px-3 py-2 text-sm font-medium text-[#7a5600]">
          No se pudo actualizar el mapa: {error}{lista && ' Se muestra lo último que llegó.'}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_17rem]">
        <div className="h-[60dvh] min-h-80 rounded-2xl overflow-hidden border border-slate-200 relative z-0">
          <MapContainer center={CENTRO_AGS} zoom={11} scrollWheelZoom {...PROPS_MAPA_AGS} ref={setMapa} className="h-full w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <CapaLimiteAgs />
            {conPunto.map((e) => (
              <CircleMarker
                key={e.empleadoId}
                center={[e.latitud!, e.longitud!]}
                radius={9}
                pathOptions={{ color: 'white', weight: 2, fillColor: e.enLinea ? VERDE : GRIS, fillOpacity: e.enLinea ? 1 : 0.7 }}
              >
                <Tooltip direction="top" offset={[0, -8]} permanent>{e.nombre}</Tooltip>
                <Popup>
                  <strong>{e.nombre}</strong>
                  <br />
                  {e.enLinea ? 'En línea' : 'Sin conexión'} · última señal {ultimaSenal(e)}
                  {e.precisionMetros != null && <><br />Precisión ±{Math.round(e.precisionMetros)} m</>}
                  <br />
                  <Link to={`/admin/empleados/${e.empleadoId}`}>Ver ficha</Link>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        <section aria-label="Notificadores" className="rounded-2xl bg-white border border-slate-200 p-3 lg:max-h-[60dvh] lg:overflow-y-auto">
          {!lista ? (
            <div className="space-y-2" aria-busy="true">
              {[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />)}
            </div>
          ) : lista.length === 0 ? (
            <p className="p-3 text-sm text-slate-600">No hay notificadores activos.</p>
          ) : (
            <ul className="space-y-1">
              {ordenados.map((e) => {
                const punto = e.tieneUbicacion && e.latitud != null && e.longitud != null ? ([e.latitud, e.longitud] as [number, number]) : null;
                return (
                  <li key={e.empleadoId}>
                    <button
                      type="button"
                      disabled={!punto}
                      onClick={() => punto && mapa?.flyTo(punto, 17)}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-transparent"
                    >
                      {punto ? (
                        <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: e.enLinea ? VERDE : GRIS }} aria-hidden="true" />
                      ) : (
                        <MapPinOff size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-miaa-marino">{e.nombre}</span>
                        <span className="block text-xs text-slate-500">
                          {e.enLinea ? 'En línea' : punto ? `Sin conexión · ${ultimaSenal(e)}` : 'Aún no comparte ubicación'}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
