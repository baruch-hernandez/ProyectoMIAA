import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../services/api';

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
}

interface FotoComprimida {
  base64: string;
  sizeKB: number;
}

export const LecturaCaptura: React.FC = () => {
  const usuarioRaw = localStorage.getItem('usuario');
  const usuario = usuarioRaw ? JSON.parse(usuarioRaw) : null;

  const [rutas, setRutas] = useState<RutaItem[]>([]);
  const [cargando, setCargando] = useState(true);

  // Estados del Formulario de Lectura
  const [rutaSeleccionada, setRutaSeleccionada] = useState<string>('');
  const [medidor, setMedidor] = useState<string>('');
  const [lecturaValor, setLecturaValor] = useState<string>('');
  const [anomalia, setAnomalia] = useState<string>('Ninguna');
  const [observaciones, setObservaciones] = useState<string>('');
  const [fotos, setFotos] = useState<FotoComprimida[]>([]);
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number } | null>(null);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [offlineCount, setOfflineCount] = useState<number>(0);

  useEffect(() => {
    cargarRutas();
    obtenerUbicacionGPS();
    actualizarConteoOffline();

    const handleOnline = () => sincronizarPendientesOffline();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const obtenerUbicacionGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoordenadas({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn('No se pudo acceder al GPS:', err),
        { enableHighAccuracy: true }
      );
    }
  };

  const actualizarConteoOffline = () => {
    const pendientes = JSON.parse(localStorage.getItem('lecturas_offline') || '[]');
    setOfflineCount(pendientes.length);
  };

  const cargarRutas = async () => {
    try {
      const idLecturista = usuario?.id || 2;
      let response;
      try {
        response = await api.get(`/rutas/lecturista/${idLecturista}`);
      } catch (e) {
        response = await api.get('/rutas');
      }

      if (response && response.data) {
        const rutasFormateadas = response.data
          .filter((r: any) => !r.lecturista || r.lecturista.id === idLecturista)
          .map((r: any) => ({
            ...r,
            codigoSector: r.codigoSector || r.codigo_sector,
            puntos: typeof r.puntos === 'string' ? JSON.parse(r.puntos) : (r.puntos || []),
          }));
        setRutas(rutasFormateadas);
        if (rutasFormateadas.length > 0) {
          setRutaSeleccionada(rutasFormateadas[0].codigoSector);
        }
      }
    } catch (error) {
      console.error('Error al cargar rutas:', error);
    } finally {
      setCargando(false);
    }
  };

  // Compresión estricta de fotos a <= 200 KB
  const procesarFotoCamara = (file: File): Promise<FotoComprimida> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1024;
          const scale = MAX_WIDTH / img.width;

          canvas.width = (img.width > MAX_WIDTH) ? MAX_WIDTH : img.width;
          canvas.height = (img.width > MAX_WIDTH) ? img.height * scale : img.height;

          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

          let quality = 0.7;
          let base64 = canvas.toDataURL('image/jpeg', quality);

          while (base64.length * (3 / 4) > 200 * 1024 && quality > 0.1) {
            quality -= 0.1;
            base64 = canvas.toDataURL('image/jpeg', quality);
          }

          const sizeKB = Math.round((base64.length * (3 / 4)) / 1024);
          resolve({ base64, sizeKB });
        };
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleTomarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      try {
        const fotoComprimida = await procesarFotoCamara(e.target.files[0]);
        setFotos((prev) => [...prev, fotoComprimida]);
      } catch (err) {
        alert('Error al procesar la imagen de la cámara.');
      }
    }
  };

  const sincronizarPendientesOffline = async () => {
    const pendientes = JSON.parse(localStorage.getItem('lecturas_offline') || '[]');
    if (pendientes.length === 0) return;

    const noEnviados = [];
    for (const item of pendientes) {
      try {
        await api.post('/lecturas', item);
      } catch {
        noEnviados.push(item);
      }
    }

    localStorage.setItem('lecturas_offline', JSON.stringify(noEnviados));
    actualizarConteoOffline();

    if (noEnviados.length === 0) {
      alert('✅ Lecturas guardadas localmente sincronizadas con éxito.');
    }
  };

  const handleSubmitLectura = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);

    const payload = {
      usuarioId: usuario?.id || 2,
      codigoSector: rutaSeleccionada,
      numeroMedidor: medidor,
      lectura: Number(lecturaValor),
      anomalia,
      observaciones,
      latitud: coordenadas?.lat || null,
      longitud: coordenadas?.lng || null,
      fotos: fotos.map((f) => f.base64),
      fechaCapturaLocal: new Date().toISOString()
    };

    try {
      if (navigator.onLine) {
        await api.post('/lecturas', payload);
        alert('✅ Lectura guardada e ingresada correctamente.');
      } else {
        guardarLocalmente(payload);
      }
    } catch {
      guardarLocalmente(payload);
    } finally {
      setGuardando(false);
      setMedidor('');
      setLecturaValor('');
      setObservaciones('');
      setFotos([]);
    }
  };

  const guardarLocalmente = (data: any) => {
    const pendientes = JSON.parse(localStorage.getItem('lecturas_offline') || '[]');
    pendientes.push(data);
    localStorage.setItem('lecturas_offline', JSON.stringify(pendientes));
    actualizarConteoOffline();
    alert('📲 Sin red: Lectura almacenada localmente. Se sincronizará al recuperar la conexión.');
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-blue-600 text-white rounded-lg flex items-center justify-center font-black text-xl">
            M
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800 leading-none">MIAA - Captura de Lecturas</h1>
            <span className="text-xs text-slate-500">Operador: {usuario?.nombre || 'Juan Pérez'}</span>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {offlineCount > 0 && (
            <button
              onClick={sincronizarPendientesOffline}
              className="bg-amber-500 hover:bg-amber-600 text-white text-xs px-3 py-2 rounded-lg font-bold"
            >
              🔄 Sincronizar ({offlineCount})
            </button>
          )}
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white text-xs px-4 py-2 rounded-lg font-bold transition"
          >
            Salir
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 max-w-6xl w-full mx-auto space-y-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Rutas y Captura de Trabajo</h2>
            <p className="text-xs text-slate-500">Recorridos cartográficos y formulario de campo en Aguascalientes</p>
          </div>
          <span className="bg-blue-100 text-blue-800 font-bold text-xs px-3 py-1 rounded-full border border-blue-200">
            {rutas.length} Ruta(s)
          </span>
        </div>

        {cargando ? (
          <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-sm">
            Cargando información del servidor...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Formulario de Captura */}
            <div className="lg:col-span-1 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-700 border-b pb-2">Registrar Lectura / Incidencia</h3>
              <form onSubmit={handleSubmitLectura} className="space-y-3">
                
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Sector / Ruta</label>
                  <select
                    value={rutaSeleccionada}
                    onChange={(e) => setRutaSeleccionada(e.target.value)}
                    className="w-full text-xs p-2 border rounded-lg bg-slate-50 border-slate-300"
                  >
                    {rutas.map((r) => (
                      <option key={r.id} value={r.codigoSector}>
                        {r.codigoSector} - {r.colonia}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Nº de Medidor</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. MED-09823"
                    value={medidor}
                    onChange={(e) => setMedidor(e.target.value)}
                    className="w-full text-xs p-2 border rounded-lg border-slate-300"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Lectura ($m^3$)</label>
                    <input
                      type="number"
                      required
                      placeholder="0000"
                      value={lecturaValor}
                      onChange={(e) => setLecturaValor(e.target.value)}
                      className="w-full text-xs p-2 border rounded-lg border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Anomalía</label>
                    <select
                      value={anomalia}
                      onChange={(e) => setAnomalia(e.target.value)}
                      className="w-full text-xs p-2 border rounded-lg border-slate-300 bg-slate-50"
                    >
                      <option value="Ninguna">Ninguna</option>
                      <option value="Fuga en Medidor">Fuga en Medidor</option>
                      <option value="Medidor Obstruido">Medidor Obstruido</option>
                      <option value="Toma Clandestina">Toma Clandestina</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Observaciones</label>
                  <textarea
                    rows={2}
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    className="w-full text-xs p-2 border rounded-lg border-slate-300"
                    placeholder="Detalles adicionales..."
                  />
                </div>

                {/* Entrada Forzosa de Cámara con Restricción a Dispositivo */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Fotos de Evidencia</label>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    id="camera-input"
                    className="hidden"
                    onChange={handleTomarFoto}
                  />
                  <label
                    htmlFor="camera-input"
                    className="w-full cursor-pointer bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-2"
                  >
                    📷 Tomar Foto (Cámara)
                  </label>

                  {fotos.length > 0 && (
                    <div className="flex gap-2 mt-2 overflow-x-auto py-1">
                      {fotos.map((f, i) => (
                        <div key={i} className="relative flex-shrink-0">
                          <img src={f.base64} className="w-14 h-14 object-cover rounded-md border" alt="preview" />
                          <span className="text-[9px] bg-black/70 text-white px-1 absolute bottom-0 right-0 rounded">
                            {f.sizeKB} KB
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {coordenadas && (
                  <div className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-200">
                    📍 GPS: {coordenadas.lat.toFixed(5)}, {coordenadas.lng.toFixed(5)}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={guardando}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 rounded-lg transition"
                >
                  {guardando ? 'Guardando...' : 'Guardar Lectura'}
                </button>
              </form>
            </div>

            {/* Mapa y Sectores */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <h3 className="text-sm font-bold text-slate-700">Mapa Operativo</h3>
                <div className="w-full h-80 rounded-lg overflow-hidden border border-slate-200 relative">
                  <MapContainer
                    center={[21.8824, -102.2826]}
                    zoom={13}
                    scrollWheelZoom={true}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; OpenStreetMap'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {rutas.map((r) => {
                      const primerPunto = r.puntos && r.puntos.length > 0 ? r.puntos[0] : [21.8824, -102.2826];
                      return (
                        <React.Fragment key={r.id}>
                          {r.puntos && r.puntos.length > 0 && (
                            <Polyline positions={r.puntos} pathOptions={{ color: '#2563eb', weight: 6 }} />
                          )}
                          <Marker position={primerPunto}>
                            <Popup>
                              <strong className="block text-blue-900">{r.codigoSector}</strong>
                              <span>Colonia: {r.colonia}</span>
                            </Popup>
                          </Marker>
                        </React.Fragment>
                      );
                    })}
                  </MapContainer>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-700 mb-3">Sectores Asignados</h3>
                <div className="divide-y divide-slate-100">
                  {rutas.map((r) => (
                    <div key={r.id} className="py-3 flex justify-between items-center">
                      <div>
                        <span className="font-bold text-slate-800 text-sm block">{r.codigoSector}</span>
                        <span className="text-xs text-slate-500">Colonia / Zona: {r.colonia}</span>
                      </div>
                      <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full uppercase">
                        ● {r.estado}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
};