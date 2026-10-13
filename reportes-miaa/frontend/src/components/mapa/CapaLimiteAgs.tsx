import { Polygon } from 'react-leaflet';
import { CONTORNO_AGS, MASCARA_AGS } from '../../utils/limiteAgs';

/**
 * Pinta el límite del estado dentro de un <MapContainer>: sombrea lo de fuera y
 * dibuja el borde punteado. interactive={false}: los clics atraviesan las capas
 * y llegan al mapa (si no, la máscara se "comería" los clics).
 */
export function CapaLimiteAgs() {
  return (
    <>
      <Polygon
        positions={MASCARA_AGS}
        interactive={false}
        pathOptions={{ stroke: false, fillColor: '#074376', fillOpacity: 0.22 }}
      />
      <Polygon
        positions={CONTORNO_AGS}
        interactive={false}
        pathOptions={{ color: '#074376', weight: 2, dashArray: '6 6', fill: false }}
      />
    </>
  );
}
