import { useEffect } from 'react';
import { Circle, LayerGroup, LayersControl, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { Coordenadas } from '../../types/reporte';
import { CENTRO_AGS } from '../../utils/catalogos';
import { dentroDeAguascalientes, PROPS_MAPA_AGS } from '../../utils/limiteAgs';
import { CapaLimiteAgs } from './CapaLimiteAgs';
import './iconosLeaflet';

interface Props {
  valor: Coordenadas | null;
  /** Si no se pasa, el mapa es de solo lectura (para el detalle). Solo recibe puntos DENTRO del estado. */
  onChange?: (punto: Coordenadas) => void;
  /** Se llama cuando tocan o arrastran el marcador fuera de Aguascalientes (el punto no cambia). */
  onFuera?: (punto: Coordenadas) => void;
  altoClase?: string;
  /** Radio de error del GPS en metros: se dibuja un círculo (el domicilio debería estar dentro). */
  precision?: number;
}

/** Zoom máximo: 19 deja ver casa por casa. */
const ZOOM_MAXIMO = 19;


/** Escucha clics en el mapa y avisa el punto elegido. */
function ClicEnMapa({ onClick }: { onClick: (p: Coordenadas) => void }) {
  useMapEvents({
    click(e) {
      onClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

/**
 * Si el punto queda fuera de la vista (p. ej. llegó por GPS), mueve el mapa hacia él.
 * Si viene del GPS con buena precisión, acerca a nivel de casas para que sea fácil corregirlo.
 */
function SeguirPunto({ punto, precision }: { punto: Coordenadas | null; precision?: number }) {
  const map = useMap();
  useEffect(() => {
    if (!punto) return;
    const zoomIdeal = precision !== undefined && precision <= 30 ? 18 : 17;
    if (!map.getBounds().contains([punto.lat, punto.lng])) {
      map.setView([punto.lat, punto.lng], Math.max(map.getZoom(), zoomIdeal));
    } else if (precision !== undefined && map.getZoom() < zoomIdeal) {
      map.setView([punto.lat, punto.lng], zoomIdeal);
    }
  }, [punto, precision, map]);
  return null;
}

export function MapaUbicacion({ valor, onChange, onFuera, altoClase = 'h-72', precision }: Props) {
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
        zoom={valor ? 17 : 13}
        maxZoom={ZOOM_MAXIMO}
        scrollWheelZoom
        {...PROPS_MAPA_AGS} // no deja arrastrar ni alejar el mapa fuera de la zona
        style={{ height: '100%', width: '100%' }}
      >
        {/* Botón arriba a la derecha para cambiar entre mapa de calles y satélite.
            En satélite se ven los techos: lo más útil para poner el marcador en la casa exacta. */}
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Mapa">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxNativeZoom={19}
              maxZoom={ZOOM_MAXIMO}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satélite">
            <LayerGroup>
              <TileLayer
                attribution="Imágenes &copy; Esri, Maxar, Earthstar Geographics"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxNativeZoom={19}
                maxZoom={ZOOM_MAXIMO}
              />
              {/* Nombres de calles encima de la foto */}
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
                maxNativeZoom={19}
                maxZoom={ZOOM_MAXIMO}
              />
            </LayerGroup>
          </LayersControl.BaseLayer>
        </LayersControl>
        <CapaLimiteAgs />
        {onChange && <ClicEnMapa onClick={elegir} />}
        <SeguirPunto punto={valor} precision={precision} />
        {valor && precision !== undefined && (
          <Circle
            center={[valor.lat, valor.lng]}
            radius={precision}
            interactive={false}
            pathOptions={{ color: '#1d6fb8', weight: 1, fillColor: '#22bcff', fillOpacity: 0.15 }}
          />
        )}
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
