import { useEffect } from 'react';
import { MapContainer, Marker, Polygon, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Coordenadas } from '../../types/queja';
import { CENTRO_AGS } from '../../utils/catalogos';
import { CAJA_AGS, CONTORNO_AGS, dentroDeAguascalientes } from '../../utils/limiteAgs';

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

// ---------- Límite del estado ----------
const MARGEN = 0.12; // ~13 km: deja ver un poco alrededor del borde
/** Hasta dónde se puede arrastrar el mapa: el estado + el margen. */
const LIMITES_MAPA = L.latLngBounds(
  [CAJA_AGS[0][0] - MARGEN, CAJA_AGS[0][1] - MARGEN],
  [CAJA_AGS[1][0] + MARGEN, CAJA_AGS[1][1] + MARGEN],
);
/**
 * "Máscara": un rectángulo grande con el estado como HUECO.
 * Así todo lo que está fuera se ve sombreado y el estado queda limpio.
 */
const RECTANGULO_EXTERIOR: [number, number][] = [
  [CAJA_AGS[0][0] - 2, CAJA_AGS[0][1] - 2],
  [CAJA_AGS[0][0] - 2, CAJA_AGS[1][1] + 2],
  [CAJA_AGS[1][0] + 2, CAJA_AGS[1][1] + 2],
  [CAJA_AGS[1][0] + 2, CAJA_AGS[0][1] - 2],
];
const MASCARA: [number, number][][] = [RECTANGULO_EXTERIOR, CONTORNO_AGS];

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
        maxBounds={LIMITES_MAPA} // no deja arrastrar el mapa fuera de la zona
        maxBoundsViscosity={1} // 1 = el borde es "duro", no rebota
        minZoom={9} // con menos zoom ya se vería medio país
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* interactive={false}: los clics atraviesan la máscara y llegan al mapa */}
        <Polygon
          positions={MASCARA}
          interactive={false}
          pathOptions={{ stroke: false, fillColor: '#074376', fillOpacity: 0.22 }}
        />
        <Polygon
          positions={CONTORNO_AGS}
          interactive={false}
          pathOptions={{ color: '#074376', weight: 2, dashArray: '6 6', fill: false }}
        />
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
