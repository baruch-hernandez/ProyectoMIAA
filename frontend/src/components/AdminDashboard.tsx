import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../services/api';
import { leerError } from '../services/quejasApi';
import { usuariosApi } from '../services/usuariosApi';
import { FiltroRutas } from './admin/FiltroRutas';
import { TablaRutas } from './admin/TablaRutas';
import {
  colorRuta, contarPorEstado, esEstadoRuta, etiquetaRuta, filtrarRutas, FILTROS_INICIALES, hayFiltrosActivos,
} from '../utils/rutas';
import type { FiltroLecturista, FiltrosRutas, LecturistaResumen, RutaItem } from '../utils/rutas';

// Corrección de íconos por defecto de Leaflet en React
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Componente para capturar clics en el mapa y realizar Geocodificación Inversa
const CapturadorDeClics = ({
  modoDibujo,
  onAddPoint,
}: {
  modoDibujo: boolean;
  onAddPoint: (lat: number, lng: number) => void;
}) => {
  useMapEvents({
    click(e) {
      if (modoDibujo) {
        onAddPoint(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
};

export const AdminDashboard: React.FC = () => {
  const usuarioRaw = localStorage.getItem('usuario');
  const usuario = usuarioRaw ? JSON.parse(usuarioRaw) : null;

  const [rutas, setRutas] = useState<RutaItem[]>([]);
  const [codigoSector, setCodigoSector] = useState('');
  const [nombreZona, setNombreZona] = useState('');
  const [modoDibujo, setModoDibujo] = useState(false);
  const [puntosTemporales, setPuntosTemporales] = useState<[number, number][]>([]);
  const [obteniendoUbicacion, setObteniendoUbicacion] = useState(false);
  const [cargandoGuardado, setCargandoGuardado] = useState(false);
  // id de la ruta que se está actualizando/borrando (para desactivar sus botones)
  const [rutaOcupada, setRutaOcupada] = useState<number | null>(null);

  // Lecturistas reales (para filtrar y para asignar rutas)
  const [lecturistas, setLecturistas] = useState<LecturistaResumen[]>([]);
  const [lecturistaAsignado, setLecturistaAsignado] = useState('');

  // ---------- Filtros ----------
  // Viven en la URL (?estado=COMPLETADA&lecturista=2&q=centro): así sobreviven
  // al recargar la página y se puede compartir el link ya filtrado.
  const [params, setParams] = useSearchParams();
  const filtros = useMemo<FiltrosRutas>(() => {
    const estadoUrl = params.get('estado') ?? '';
    return {
      estado: esEstadoRuta(estadoUrl) ? estadoUrl : FILTROS_INICIALES.estado,
      lecturista: (params.get('lecturista') as FiltroLecturista | null) ?? FILTROS_INICIALES.lecturista,
      busqueda: params.get('q') ?? '',
    };
  }, [params]);

  const cambiarFiltros = (cambios: Partial<FiltrosRutas>) => {
    const nuevos = { ...filtros, ...cambios };
    const p = new URLSearchParams();
    if (nuevos.estado !== 'TODAS') p.set('estado', nuevos.estado);
    if (nuevos.lecturista !== 'todos') p.set('lecturista', nuevos.lecturista);
    if (nuevos.busqueda) p.set('q', nuevos.busqueda);
    setParams(p, { replace: true }); // replace: no llenar el historial con cada letra
  };
  const limpiarFiltros = () => setParams(new URLSearchParams(), { replace: true });

  // Se recalcula solo cuando cambian las rutas o los filtros
  const rutasFiltradas = useMemo(() => filtrarRutas(rutas, filtros), [rutas, filtros]);
  const conteo = useMemo(() => contarPorEstado(rutas, filtros), [rutas, filtros]);

  useEffect(() => {
    cargarRutas();
    usuariosApi
      .lecturistas()
      .then((lista) => {
        setLecturistas(lista);
        // Preselecciona al primero para no obligar a elegir si solo hay uno
        if (lista.length > 0) setLecturistaAsignado(String(lista[0].id));
      })
      .catch((err) => console.error('No se pudieron cargar los lecturistas:', err));
  }, []);

  const cargarRutas = async () => {
    try {
      const response = await api.get('/rutas');
      if (response.data) {
        const rutasFormateadas = response.data.map((r: any) => ({
          ...r,
          codigoSector: r.codigoSector || r.codigo_sector,
          puntos: typeof r.puntos === 'string' ? JSON.parse(r.puntos) : (r.puntos || []),
        }));
        setRutas(rutasFormateadas);
      }
    } catch (err) {
      console.error('Error al cargar rutas de la BD:', err);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  // Reverse Geocoding usando Nominatim API
  const obtenerDireccionPorCoordenadas = async (lat: number, lng: number) => {
    setObteniendoUbicacion(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
      );
      const data = await response.json();

      if (data && data.address) {
        const addr = data.address;
        const coloniaDetectada =
          addr.neighbourhood ||
          addr.suburb ||
          addr.residential ||
          addr.quarter ||
          addr.road ||
          'Zona Aguascalientes';

        setNombreZona(coloniaDetectada);

        const aliasSector = coloniaDetectada
          .replace(/[^a-zA-Z0-9]/g, '')
          .substring(0, 6)
          .toUpperCase();
          
        setCodigoSector(`RUTA-${aliasSector || 'SEC'}-${Math.floor(100 + Math.random() * 900)}`);
      }
    } catch (error) {
      console.error('Error obteniendo ubicación:', error);
    } finally {
      setObteniendoUbicacion(false);
    }
  };

  const handleAgregarPunto = (lat: number, lng: number) => {
    if (puntosTemporales.length === 0) {
      obtenerDireccionPorCoordenadas(lat, lng);
    }
    setPuntosTemporales((prev) => [...prev, [lat, lng]]);
  };

  const limpiarPuntosDibujo = () => {
    setPuntosTemporales([]);
    setNombreZona('');
    setCodigoSector('');
  };

  // Guardar en Backend Spring Boot
  const handleGuardarRutaMapa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigoSector || puntosTemporales.length < 2) {
      alert('Por favor activa el dibujo y marca al menos 2 puntos en el mapa.');
      return;
    }
    const encargado = lecturistas.find((l) => String(l.id) === lecturistaAsignado);
    if (!encargado) {
      alert('Elige al lecturista encargado de la ruta.');
      return;
    }

    setCargandoGuardado(true);

    const nuevaRutaPayload = {
      codigoSector: codigoSector,
      colonia: nombreZona || 'Zona Aguascalientes',
      estado: 'PENDIENTE',
      puntos: JSON.stringify(puntosTemporales),
      fechaAsignacion: new Date().toISOString().split('T')[0],
      lecturista: { id: encargado.id }, // antes estaba fijo el id 2
    };

    console.log('Enviando payload a Spring Boot:', nuevaRutaPayload);

    try {
      const response = await api.post('/rutas', nuevaRutaPayload);
      console.log('Respuesta del servidor:', response.data);
      
      alert(`Ruta guardada y asignada a ${encargado.nombre}.`);
      await cargarRutas();
      
      setCodigoSector('');
      setNombreZona('');
      setPuntosTemporales([]);
      setModoDibujo(false);
    } catch (err: any) {
      console.error('Error detallado al guardar:', err.response || err);
      const mensajeError = err.response?.data?.message || err.response?.data || err.message;
      alert('Error al guardar en el servidor: ' + JSON.stringify(mensajeError));
    } finally {
      setCargandoGuardado(false);
    }
  };

  // ANTES: la tabla se actualizaba en el `finally`, es decir, AUNQUE el servidor fallara.
  // Parecía que funcionaba, pero al recargar la página todo regresaba.
  // AHORA: solo cambiamos la tabla cuando el servidor confirma; si falla, avisamos
  // el motivo real y recargamos desde la BD para que la tabla diga la verdad.

  const handleCambiarEstado = async (id: number, nuevoEstado: string) => {
    setRutaOcupada(id);
    try {
      await api.put(`/rutas/${id}`, { estado: nuevoEstado });
      setRutas((prev) => prev.map((r) => (r.id === id ? { ...r, estado: nuevoEstado } : r)));
    } catch (err) {
      alert('No se pudo cambiar el estado: ' + leerError(err).mensaje);
      await cargarRutas();
    } finally {
      setRutaOcupada(null);
    }
  };

  const handleEliminarRuta = async (ruta: RutaItem) => {
    const seguro = window.confirm(
      `¿Eliminar la ruta ${ruta.codigoSector} (${ruta.colonia})?\nEsta acción no se puede deshacer.`,
    );
    if (!seguro) return;

    setRutaOcupada(ruta.id);
    try {
      await api.delete(`/rutas/${ruta.id}`);
      setRutas((prev) => prev.filter((r) => r.id !== ruta.id));
    } catch (err) {
      // Ej.: "No se puede eliminar: la ruta tiene 3 lecturas registradas..."
      alert(leerError(err).mensaje);
      await cargarRutas();
    } finally {
      setRutaOcupada(null);
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans">
      {/* Sidebar Lateral */}
      <aside className="w-64 bg-miaa-marino text-white flex flex-col justify-between shadow-xl">
        <div>
          <div className="p-6 border-b border-white/10 flex items-center space-x-3">
            <div className="w-9 h-9 bg-miaa-ambar text-miaa-marino rounded-lg flex items-center justify-center font-black text-xl">
              M
            </div>
            <div>
              <h2 className="font-bold text-lg leading-none">MIAA</h2>
              <span className="text-xs text-miaa-bruma">Aguascalientes</span>
            </div>
          </div>

          <nav className="p-4 space-y-1">
            <a href="#" className="flex items-center px-4 py-3 bg-white/15 text-white rounded-lg font-semibold text-sm">
              🗺️ Monitoreo & Mapa 
            </a>
            <a href="#" className="flex items-center px-4 py-3 text-miaa-bruma hover:bg-white/10 rounded-lg text-sm transition">
              👥 Lecturistas
            </a>
            <a href="#" className="flex items-center px-4 py-3 text-miaa-bruma hover:bg-white/10 rounded-lg text-sm transition">
              📊 Historico de Lecturas 
            </a>
          </nav>
        </div>

        <div className="p-4 border-t border-white/10">
          <div className="text-xs text-miaa-bruma mb-2">Conectado como:</div>
          <div className="text-sm font-semibold truncate mb-3">{usuario?.nombre || 'Administrador MIAA'}</div>
          <button
            onClick={handleLogout}
            className="w-full bg-white/10 hover:bg-red-600 text-white text-xs py-2 rounded-md font-semibold transition"
          >
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Contenido Principal */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Panel de Control Operativo</h1>
            <p className="text-xs text-slate-500">Trazado e identificación inteligente de zonas MIAA</p>
          </div>
          <span className="bg-emerald-100 text-emerald-800 text-xs px-3 py-1 rounded-full font-semibold border border-emerald-200">
            ● Base de Datos Conectada
          </span>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* Métricas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rutas Activas</span>
                <p className="text-2xl font-bold text-slate-800 mt-1">{rutas.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-xl">📍</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Lecturistas en Campo</span>
                <p className="text-2xl font-bold text-slate-800 mt-1">{lecturistas.length}</p>
              </div>
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-xl">👷‍♂️</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Lecturas Completadas</span>
                <p className="text-2xl font-bold text-slate-800 mt-1">
                  {rutas.length > 0
                    ? `${Math.round(
                        (rutas.filter((r) => r.estado === 'COMPLETADA').length / rutas.length) * 100
                      )}%`
                    : '0%'}
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center text-xl">⚡</div>
            </div>
          </div>

          {/* Formulario e Interacción de Mapa */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-1">Diseñador de Rutas</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Haz clic en el mapa para delimitar. Los datos se autocompletarán y guardarán en BD.
                </p>

                <div className="mb-4">
                  <button
                    type="button"
                    onClick={() => setModoDibujo(!modoDibujo)}
                    className={`w-full py-2.5 px-4 rounded-lg font-bold text-xs uppercase tracking-wider transition ${
                      modoDibujo
                        ? 'bg-amber-500 text-white animate-pulse shadow-md'
                        : 'bg-slate-800 hover:bg-slate-900 text-white'
                    }`}
                  >
                    {modoDibujo ? '🎯 Clic en el mapa para marcar' : '✏️ Activar Dibujo en Mapa'}
                  </button>
                  
                  {puntosTemporales.length > 0 && (
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs font-semibold text-blue-600">
                        {puntosTemporales.length} punto(s) marcado(s)
                      </span>
                      <button
                        type="button"
                        onClick={limpiarPuntosDibujo}
                        className="text-xs text-red-500 hover:underline font-semibold"
                      >
                        Limpiar trazado
                      </button>
                    </div>
                  )}
                </div>

                <form onSubmit={handleGuardarRutaMapa} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Nombre de la Zona / Colonia {obteniendoUbicacion && <span className="text-blue-500 animate-pulse">(Detectando...)</span>}
                    </label>
                    <input
                      type="text"
                      placeholder="Autocompletado al hacer clic..."
                      value={nombreZona}
                      onChange={(e) => setNombreZona(e.target.value)}
                      className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Código del Sector</label>
                    <input
                      type="text"
                      placeholder="Autogenerado al hacer clic..."
                      value={codigoSector}
                      onChange={(e) => setCodigoSector(e.target.value)}
                      className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="lecturista-asignado" className="block text-xs font-semibold text-slate-600 mb-1">Lecturista encargado</label>
                    <select
                      id="lecturista-asignado"
                      value={lecturistaAsignado}
                      onChange={(e) => setLecturistaAsignado(e.target.value)}
                      required
                      className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {lecturistas.length === 0 && <option value="">No hay lecturistas registrados</option>}
                      {lecturistas.map((l) => (
                        <option key={l.id} value={String(l.id)}>{l.nombre} ({l.username})</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={cargandoGuardado}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-2.5 rounded-lg transition duration-200 shadow-md disabled:bg-slate-400"
                  >
                    {cargandoGuardado ? 'Guardando en Servidor...' : 'Guardar y Asignar Ruta'}
                  </button>
                </form>
              </div>
            </div>

            {/* Mapa Interactivo Leaflet */}
            <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
              <h3 className="text-base font-bold text-slate-800 mb-3">Mapa Interactivo - Municipio de Aguascalientes</h3>
              
              <div className="w-full h-96 rounded-lg overflow-hidden border border-slate-200 relative">
                <MapContainer
                  center={[21.8824, -102.2826]}
                  zoom={13}
                  scrollWheelZoom={true}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  <CapturadorDeClics modoDibujo={modoDibujo} onAddPoint={handleAgregarPunto} />

                  {puntosTemporales.length > 0 && (
                    <>
                      <Polyline positions={puntosTemporales} pathOptions={{ color: '#3b82f6', weight: 4, dashArray: '6, 6' }} />
                      {puntosTemporales.map((pt, i) => (
                        <Marker key={i} position={pt} />
                      ))}
                    </>
                  )}

                  {/* Solo las rutas que pasan el filtro */}
                  {rutasFiltradas.map((r) => {
                    const colorLinea = colorRuta(r.estado).linea;
                    const primerPunto: [number, number] = r.puntos && r.puntos.length > 0 ? r.puntos[0] : [21.8824, -102.2826];

                    return (
                      <React.Fragment key={r.id}>
                        {r.puntos && r.puntos.length > 0 && (
                          <Polyline
                            positions={r.puntos}
                            pathOptions={{
                              color: colorLinea,
                              weight: 5,
                              opacity: 0.8,
                            }}
                          />
                        )}

                        <Marker position={primerPunto}>
                          <Popup>
                            <div className="text-sm font-sans p-1">
                              <strong className="text-blue-900 block font-bold">{r.codigoSector}</strong>
                              <span className="text-slate-600 block text-xs">Zona: {r.colonia}</span>
                              <span className="text-slate-600 block text-xs mb-2">
                                Lecturista: {r.lecturista?.nombre ?? 'sin asignar'}
                              </span>
                              <span
                                className="text-xs px-2 py-1 rounded font-bold"
                                style={{ backgroundColor: `${colorLinea}25`, color: colorLinea }}
                              >
                                ● {etiquetaRuta(r.estado)}
                              </span>
                            </div>
                          </Popup>
                        </Marker>
                      </React.Fragment>
                    );
                  })}
                </MapContainer>
              </div>
            </div>
          </div>

          {/* Gestión de rutas: filtros + tabla (los filtros también afectan al mapa de arriba) */}
          <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4" aria-labelledby="titulo-rutas">
            <h3 id="titulo-rutas" className="text-base font-bold text-slate-800">Rutas registradas</h3>

            <FiltroRutas
              filtros={filtros}
              onCambiar={cambiarFiltros}
              onLimpiar={limpiarFiltros}
              conteo={conteo}
              lecturistas={lecturistas}
              totalVisibles={rutasFiltradas.length}
              totalRutas={rutas.length}
            />

            <TablaRutas
              rutas={rutasFiltradas}
              rutaOcupada={rutaOcupada}
              hayFiltros={hayFiltrosActivos(filtros)}
              onCambiarEstado={handleCambiarEstado}
              onEliminar={handleEliminarRuta}
              onLimpiarFiltros={limpiarFiltros}
            />
          </section>
        </div>
      </main>
    </div>
  );
};