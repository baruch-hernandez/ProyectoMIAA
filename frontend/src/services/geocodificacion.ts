// Geocodificación inversa: coordenadas → dirección.
// Usa Nominatim (OpenStreetMap): gratis y sin llave, pero con reglas de uso
// (máx. 1 petición por segundo, nada de uso masivo). Para producción en MIAA
// conviene cambiar VITE_GEOCODER_URL por un servidor propio o pasar por el backend.
import type { Coordenadas } from '../types/queja';
import type { DireccionGps, DireccionNominatim } from '../utils/direccionGps';
import { estaEnAguascalientes, interpretarDireccion } from '../utils/direccionGps';

const URL_GEOCODER = import.meta.env.VITE_GEOCODER_URL || 'https://nominatim.openstreetmap.org';

export type ResultadoGeocodificacion =
  | { tipo: 'ok'; direccion: DireccionGps }
  | { tipo: 'sin-direccion' } // el punto cae en un lugar sin calles (un baldío, el campo…)
  | { tipo: 'fuera-de-ags' };

// Caché en memoria: si arrastran el marcador y lo regresan al mismo lugar, no se vuelve a pedir.
const cache = new Map<string, ResultadoGeocodificacion>();

export async function direccionDesdeCoordenadas(
  { lat, lng }: Coordenadas,
  signal?: AbortSignal,
): Promise<ResultadoGeocodificacion> {
  const llave = `${lat.toFixed(5)},${lng.toFixed(5)}`; // ~1 m de precisión
  const guardado = cache.get(llave);
  if (guardado) return guardado;

  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: lat.toFixed(6),
    lon: lng.toFixed(6),
    zoom: '18', // nivel "edificio": trae calle y número si existen
    addressdetails: '1',
    'accept-language': 'es',
  });

  // OJO: fetch y NO el `api` de axios. El `api` le pega el token JWT a cada
  // petición, y no queremos mandarle nuestro token a un servidor externo.
  const respuesta = await fetch(`${URL_GEOCODER}/reverse?${params}`, { signal });
  if (!respuesta.ok) throw new Error(`El geocodificador respondió ${respuesta.status}`);

  const datos = (await respuesta.json()) as { error?: string; address?: DireccionNominatim };

  let resultado: ResultadoGeocodificacion;
  if (datos.error || !datos.address) resultado = { tipo: 'sin-direccion' };
  else if (!estaEnAguascalientes(datos.address)) resultado = { tipo: 'fuera-de-ags' };
  else resultado = { tipo: 'ok', direccion: interpretarDireccion(datos.address) };

  cache.set(llave, resultado);
  return resultado;
}
