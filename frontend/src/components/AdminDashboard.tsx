import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../services/api';

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

interface RutaItem {
  id: number;
  codigoSector: string;
  colonia: string;
  estado: string;
  puntos: [number, number][];
  lecturista?: {
    id: number;
    nombre?: string;
  };
}

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

  useEffect(() => {
    cargarRutas();
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

  const obtenerColorEstado = (estado?: string) => {
    switch (estado) {
      case 'COMPLETADA':
        return '#22c55e'; // Verde
      case 'EN_PROCESO':
        return '#eab308'; // Amarillo
      case 'PENDIENTE':
      default:
        return '#ef4444'; // Rojo
    }
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

    setCargandoGuardado(true);

    const nuevaRutaPayload = {
      codigoSector: codigoSector,
      colonia: nombreZona || 'Zona Aguascalientes',
      estado: 'PENDIENTE',
      puntos: JSON.stringify(puntosTemporales),
      fechaAsignacion: new Date().toISOString().split('T')[0],
      lecturista: {
        id: 2
      }
    };

    console.log('Enviando payload a Spring Boot:', nuevaRutaPayload);

    try {
      const response = await api.post('/rutas', nuevaRutaPayload);
      console.log('Respuesta del servidor:', response.data);
      
      alert('¡Ruta guardada y asignada exitosamente a Juan Pérez!');
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

  const handleCambiarEstado = async (id: number, nuevoEstado: string) => {
    try {
      await api.put(`/rutas/${id}`, { estado: nuevoEstado });
    } catch (err) {
      console.error('Error actualizando estado en BD:', err);
    } finally {
      setRutas((prev) =>
        prev.map((r) => (r.id === id ? { ...r, estado: nuevoEstado } : r))
      );
    }
  };

  const handleEliminarRuta = async (id: number) => {
    try {
      await api.delete(`/rutas/${id}`);
    } catch (err) {
      console.error('Error eliminando ruta de BD:', err);
    } finally {
      setRutas((prev) => prev.filter((r) => r.id !== id));
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans">
      {/* Sidebar Lateral */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col justify-between shadow-xl">
        <div>
          <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center font-black text-xl">
              M
            </div>
            <div>
              <h2 className="font-bold text-lg leading-none">MIAA</h2>
              <span className="text-xs text-slate-400">Aguascalientes</span>
            </div>
          </div>

          <nav className="p-4 space-y-1">
            <a href="#" className="flex items-center px-4 py-3 bg-blue-600 text-white rounded-lg font-medium text-sm">
              🗺️ Monitoreo & Mapa 
            </a>
            <a href="#" className="flex items-center px-4 py-3 text-slate-400 hover:bg-slate-800 rounded-lg text-sm transition">
              👥 Lecturistas
            </a>
            <a href="#" className="flex items-center px-4 py-3 text-slate-400 hover:bg-slate-800 rounded-lg text-sm transition">
              📊 Historico de Lecturas 
            </a>
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800">
          <div className="text-xs text-slate-400 mb-2">Conectado como:</div>
          <div className="text-sm font-semibold truncate mb-3">{usuario?.nombre || 'Administrador MIAA'}</div>
          <button
            onClick={handleLogout}
            className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs py-2 rounded-md font-semibold transition"
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
                <p className="text-2xl font-bold text-slate-800 mt-1">1</p>
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
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Lecturista Asignado</label>
                    <input
                      type="text"
                      value="Juan Pérez (lecturista1)"
                      disabled
                      className="w-full text-sm px-3 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-lg"
                    />
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

                  {rutas.map((r) => {
                    const colorRuta = obtenerColorEstado(r.estado);
                    const primerPunto = r.puntos && r.puntos.length > 0 ? r.puntos[0] : [21.8824, -102.2826];

                    return (
                      <React.Fragment key={r.id}>
                        {r.puntos && r.puntos.length > 0 && (
                          <Polyline
                            positions={r.puntos}
                            pathOptions={{
                              color: colorRuta,
                              weight: 5,
                              opacity: 0.8,
                            }}
                          />
                        )}

                        <Marker position={primerPunto}>
                          <Popup>
                            <div className="text-sm font-sans p-1">
                              <strong className="text-blue-900 block font-bold">{r.codigoSector}</strong>
                              <span className="text-slate-600 block text-xs mb-2">Zona: {r.colonia}</span>
                              <span
                                className="text-xs px-2 py-1 rounded font-bold uppercase"
                                style={{
                                  backgroundColor: `${colorRuta}25`,
                                  color: colorRuta,
                                }}
                              >
                                ● {r.estado}
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

          {/* Tabla de Gestión */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-base font-bold text-slate-800 mb-4">Gestión de Rutas Registradas en Servidor</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 uppercase text-xs border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Código Sector</th>
                    <th className="px-4 py-3">Zona / Colonia</th>
                    <th className="px-4 py-3">Puntos Trazados</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rutas.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-4 text-slate-400">
                        No hay rutas guardadas en la base de datos.
                      </td>
                    </tr>
                  ) : (
                    rutas.map((r) => {
                      const colorRuta = obtenerColorEstado(r.estado);
                      return (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold text-slate-800">{r.codigoSector}</td>
                          <td className="px-4 py-3">{r.colonia}</td>
                          <td className="px-4 py-3 text-xs font-mono">{r.puntos ? r.puntos.length : 0} vértices</td>
                          <td className="px-4 py-3">
                            <span
                              className="text-xs px-2.5 py-1 rounded-full font-bold uppercase"
                              style={{
                                backgroundColor: `${colorRuta}20`,
                                color: colorRuta,
                              }}
                            >
                              ● {r.estado}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center space-x-2">
                            <button
                              onClick={() => handleCambiarEstado(r.id, 'COMPLETADA')}
                              className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-3 py-1 rounded text-xs font-semibold transition"
                            >
                              ✓ Completar
                            </button>

                            <button
                              onClick={() => handleCambiarEstado(r.id, 'EN_PROCESO')}
                              className="bg-amber-50 text-amber-600 hover:bg-amber-100 px-3 py-1 rounded text-xs font-semibold transition"
                            >
                              ⏳ En Proceso
                            </button>

                            <button
                              onClick={() => handleEliminarRuta(r.id)}
                              className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1 rounded text-xs font-semibold transition"
                            >
                              🗑️ Eliminar
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};