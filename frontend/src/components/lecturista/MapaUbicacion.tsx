import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Coordenadas } from '../../types/queja';
import { CENTRO_AGS } from '../../utils/catalogos';
import { dentroDeAguascalientes, PROPS_MAPA_AGS } from '../../utils/limiteAgs';
import { CapaLimiteAgs } from '../mapa/CapaLimiteAgs';

// Corrección de íconos por defecto de Leaflet con Vite (igual que en AdminDashboard)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

interface Props {
  valor: Coordenadas | null;
  /** Si no se pasa, el mapa es de solo lectura (para el detalle). Solo recibe puntos DENTRO del estado. */
  onChange?: (punto: Coordenadas) => void;
  /** Se llama cuando tocan o arrastran el marcador fuera de Aguascalientes (el punto no cambia). */
  onFuera?: (punto: Coordenadas) => void;
  altoClase?: string;
}


/** Escucha clics en el mapa y avisa el punto elegido. */
function ClicEnMapa({ onClick }: { onClick: (p: Coordenadas) => void }) {
  useMapEvents({
    click(e) {
      onClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

/** Si el punto queda fuera de la vista (p. ej. llegó por GPS), mueve el mapa hacia él. */
function SeguirPunto({ punto }: { punto: Coordenadas | null }) {
  const map = useMap();
  useEffect(() => {
    if (punto && !map.getBounds().contains([punto.lat, punto.lng])) {
      map.setView([punto.lat, punto.lng], Math.max(map.getZoom(), 16));
    }
  }, [punto, map]);
  return null;
}

export function MapaUbicacion({ valor, onChange, onFuera, altoClase = 'h-72' }: Props) {
  const centro: [number, number] = valor ? [valor.lat, valor.lng] : CENTRO_AGS;

  /** Toda elección de punto pasa por aquí: dentro del estado → onChange, fuera → onFuera. */
  const elegir = (punto: Coordenadas) => {
    if (dentroDeAguascalientes(punto)) onChange?.(punto);
    else onFuera?.(punto);
  };

  return (
    <div className={`w-full ${altoClase} rounded-xl overflow-hidden border border-slate-200 relative z-0`}>
      <MapContainer
        center={centro}
        zoom={valor ? 16 : 13}
        scrollWheelZoom
        {...PROPS_MAPA_AGS} // no deja arrastrar ni alejar el mapa fuera de la zona
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CapaLimiteAgs />
        {onChange && <ClicEnMapa onClick={elegir} />}
        <SeguirPunto punto={valor} />
        {valor && (
          <Marker
            position={[valor.lat, valor.lng]}
            draggable={Boolean(onChange)}
            eventHandlers={{
              dragend: (e) => {
                const marcador = e.target as L.Marker;
                const { lat, lng } = marcador.getLatLng();
                // Si lo soltaron fuera del estado, el marcador regresa a donde estaba
                if (!dentroDeAguascalientes({ lat, lng })) marcador.setLatLng([valor.lat, valor.lng]);
                elegir({ lat, lng });
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
