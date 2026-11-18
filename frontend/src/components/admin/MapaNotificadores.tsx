import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from 'react-leaflet';
import type { CircleMarker as MarcadorLeaflet, Map as MapaLeaflet } from 'leaflet';
import { MapPinOff, Search } from 'lucide-react';
import { usuariosApi } from '../../services/usuariosApi';
import { leerError } from '../../services/reportesApi';
import type { UbicacionEmpleado } from '../../types/reporte';
import { CENTRO_AGS, CONSULTA_MS, horaDeConexion, normalizar } from '../../utils/catalogos';
import { claseInput } from '../../utils/estilos';
import { PROPS_MAPA_AGS } from '../../utils/limiteAgs';
import { nombreRol } from '../../utils/roles';
import { CapaLimiteAgs } from '../mapa/CapaLimiteAgs';

const VERDE = '#0fa987';
const GRIS = '#64748b';

type Filtro = 'todos' | 'ACTIVO' | 'INACTIVO';

const activo = (e: UbicacionEmpleado) => e.estadoConexion === 'ACTIVO';
const ultimaConexion = (e: UbicacionEmpleado) =>
  e.ultimaConexion ? `Última conexión: ${horaDeConexion(e.ultimaConexion)}` : 'Nunca se ha conectado';
const puntoDe = (e: UbicacionEmpleado): [number, number] | null =>
  e.tieneUbicacion && e.latitud != null && e.longitud != null ? [e.latitud, e.longitud] : null;

/**
 * Sprint 5 (Historia 5): mapa de Aguascalientes con TODOS los notificadores (solo ADMIN).
 * Verde = ACTIVO (sesión iniciada y latido reciente); gris = INACTIVO (se muestra el último lugar
 * conocido). Pregunta cada CONSULTA_MS mientras la pestaña está visible (sin encimar consultas).
 */
export function MapaNotificadores() {
  const [lista, setLista] = useState<UbicacionEmpleado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapa, setMapa] = useState<MapaLeaflet | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const marcadores = useRef(new Map<number, MarcadorLeaflet>());

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

  const termino = normalizar(busqueda.trim());
  const visibles = (lista ?? []).filter((e) =>
    (filtro === 'todos' || e.estadoConexion === filtro) && normalizar(`${e.nombre} ${e.username}`).includes(termino));
  const activos = (lista ?? []).filter(activo).length;
  // Activos primero; luego los que tienen último punto; al final los que nunca han compartido
  const ordenados = [...visibles].sort((a, b) =>
    Number(activo(b)) - Number(activo(a)) || Number(b.tieneUbicacion) - Number(a.tieneUbicacion));

  /** Clic en la lista: vuela al marcador y abre su detalle. */
  const seleccionar = (e: UbicacionEmpleado) => {
    const punto = puntoDe(e);
    const marcador = marcadores.current.get(e.empleadoId);
    if (!punto || !mapa || !marcador) return;
    mapa.once('moveend', () => marcador.openPopup());
    mapa.flyTo(punto, 17);
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-miaa-marino">Mapa de cuadrillas</h1>
          <p className="mt-1 text-sm text-slate-600">Se actualiza solo cada {CONSULTA_MS / 1000} s. Horas de Aguascalientes.</p>
        </div>
        {lista && (
          <p className="text-sm font-semibold text-slate-700" aria-live="polite">
            <span className="tabular-nums text-[#0b6b58]">{activos}</span> activos de <span className="tabular-nums">{lista.length}</span>
          </p>
        )}
      </header>

      {error && (
        <p className="rounded-lg bg-[#fff4cc] px-3 py-2 text-sm font-medium text-[#7a5600]">
          No se pudo actualizar el mapa: {error}{lista && ' Se muestra lo último que llegó.'}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="h-[60dvh] min-h-80 rounded-2xl overflow-hidden border border-slate-200 relative z-0">
          <MapContainer center={CENTRO_AGS} zoom={11} scrollWheelZoom {...PROPS_MAPA_AGS} ref={setMapa} className="h-full w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <CapaLimiteAgs />
            {visibles.map((e) => {
              const punto = puntoDe(e);
              if (!punto) return null;
              return (
                <CircleMarker
                  key={e.empleadoId}
                  ref={(m) => { if (m) marcadores.current.set(e.empleadoId, m); else marcadores.current.delete(e.empleadoId); }}
                  center={punto}
                  radius={9}
                  pathOptions={{ color: 'white', weight: 2, fillColor: activo(e) ? VERDE : GRIS, fillOpacity: activo(e) ? 1 : 0.7 }}
                >
                  <Tooltip direction="top" offset={[0, -8]} permanent>{e.nombre}</Tooltip>
                  <Popup>
                    <div className="space-y-1 text-sm">
                      <p className="font-bold text-miaa-marino">{e.nombre}</p>
                      <p className="text-slate-600">{nombreRol(e.rol)}</p>
                      <p>
                        <span
                          className="inline-block rounded-full px-2 py-0.5 text-xs font-bold text-white"
                          style={{ backgroundColor: activo(e) ? VERDE : GRIS }}
                        >
                          {activo(e) ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </p>
                      <p className="font-semibold">{ultimaConexion(e)}</p>
                      <p>{e.direccionGeocodificada ?? 'Dirección: buscando…'}</p>
                      <p className="tabular-nums text-slate-600">
                        {punto[0].toFixed(6)}, {punto[1].toFixed(6)}
                        {e.precisionMetros != null && ` (±${Math.round(e.precisionMetros)} m)`}
                      </p>
                      <Link to={`/admin/empleados/${e.empleadoId}`}>Ver ficha</Link>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>

        <section aria-label="Notificadores" className="rounded-2xl bg-white border border-slate-200 p-3 space-y-3 lg:max-h-[60dvh] lg:overflow-y-auto">
          <div className="relative">
            <label htmlFor="buscar-cuadrilla" className="sr-only">Buscar empleado</label>
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="buscar-cuadrilla"
              type="search"
              value={busqueda}
              onChange={(ev) => setBusqueda(ev.target.value)}
              placeholder="Buscar por nombre"
              autoComplete="off"
              className={`${claseInput} pl-10`}
            />
          </div>
          <div>
            <label htmlFor="filtro-cuadrilla" className="sr-only">Filtrar por estado</label>
            <select id="filtro-cuadrilla" value={filtro} onChange={(ev) => setFiltro(ev.target.value as Filtro)} className={claseInput}>
              <option value="todos">Todos</option>
              <option value="ACTIVO">Activos</option>
              <option value="INACTIVO">Inactivos</option>
            </select>
          </div>

          {!lista ? (
            <div className="space-y-2" aria-busy="true">
              {[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />)}
            </div>
          ) : ordenados.length === 0 ? (
            <p className="p-3 text-sm text-slate-600">
              {lista.length === 0 ? 'No hay notificadores registrados.' : 'Ningún notificador coincide con la búsqueda.'}
            </p>
          ) : (
            <ul className="space-y-1">
              {ordenados.map((e) => {
                const punto = puntoDe(e);
                return (
                  <li key={e.empleadoId}>
                    <button
                      type="button"
                      disabled={!punto}
                      onClick={() => seleccionar(e)}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-transparent"
                    >
                      {punto ? (
                        <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: activo(e) ? VERDE : GRIS }} aria-hidden="true" />
                      ) : (
                        <MapPinOff size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-miaa-marino">{e.nombre}</span>
                        <span className="block text-xs text-slate-500">
                          {activo(e) ? 'Activo' : 'Inactivo'}{!punto && ' · aún no comparte ubicación'}
                        </span>
                        <span className="block text-xs text-slate-500">{ultimaConexion(e)}</span>
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
