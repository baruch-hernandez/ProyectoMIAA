// Convierte la respuesta del geocodificador (OpenStreetMap / Nominatim) en los
// campos del formulario de quejas, y decide QUÉ campos se pueden llenar solos.
// Sin React ni fetch: solo lógica, para poder probarla y reusarla (p. ej. en Flutter
// la idea es la misma).
import type { QuejaRequest } from '../types/queja';
import { MUNICIPIOS } from './catalogos';

/** Campos del domicilio que el GPS puede llenar. Referencias y contrato, nunca. */
export const CAMPOS_GPS = ['calle', 'numeroExterior', 'colonia', 'codigoPostal', 'municipio'] as const;
export type CampoGps = (typeof CAMPOS_GPS)[number];

export type DireccionGps = Partial<Record<CampoGps, string>>;

/** Objeto `address` de Nominatim. Las llaves cambian según el lugar; todas son opcionales. */
export type DireccionNominatim = Record<string, string | undefined>;

export function esCampoGps(nombre: string): nombre is CampoGps {
  return (CAMPOS_GPS as readonly string[]).includes(nombre);
}

/** "Jesús María" y "jesus maria" se consideran iguales. */
function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** El primer valor no vacío de la lista de llaves, en ese orden de preferencia. */
function primero(a: DireccionNominatim, llaves: string[]): string | undefined {
  for (const llave of llaves) {
    const valor = a[llave]?.trim();
    if (valor) return valor;
  }
  return undefined;
}

/**
 * En OpenStreetMap el municipio puede venir como `county`, `municipality`, `city`,
 * `town`… y a veces con prefijo ("Municipio de Calvillo"). Solo se acepta si es
 * uno de los 11 de MUNICIPIOS, para que el <select> nunca reciba un valor raro.
 */
export function municipioDesde(a: DireccionNominatim): string | undefined {
  const candidatos = ['municipality', 'county', 'city', 'town', 'village'];
  for (const llave of candidatos) {
    const valor = a[llave];
    if (!valor) continue;
    const limpio = normalizar(valor).replace(/^(municipio|mpio\.?)\s+(de\s+)?/, '');
    const encontrado = MUNICIPIOS.find((m) => normalizar(m) === limpio);
    if (encontrado) return encontrado;
  }
  return undefined;
}

export function estaEnAguascalientes(a: DireccionNominatim): boolean {
  return a['ISO3166-2-lvl4'] === 'MX-AGU' || normalizar(a.state ?? '') === 'aguascalientes';
}

/** Respuesta de Nominatim → campos del formulario. Lo que no venga, se queda vacío. */
export function interpretarDireccion(a: DireccionNominatim): DireccionGps {
  const cp = a.postcode?.replace(/\s/g, '');
  return {
    calle: primero(a, ['road', 'pedestrian', 'footway', 'path'])?.slice(0, 150),
    // En México muchas casas no tienen número en OSM: casi siempre hay que capturarlo
    numeroExterior: a.house_number?.trim().slice(0, 20) || undefined,
    // En Aguascalientes las colonias/fraccionamientos suelen venir como neighbourhood o suburb
    colonia: primero(a, ['neighbourhood', 'suburb', 'quarter', 'residential', 'city_district', 'hamlet'])?.slice(0, 100),
    codigoPostal: cp && /^20\d{3}$/.test(cp) ? cp : undefined, // mismo patrón que el input
    municipio: municipioDesde(a),
  };
}

/**
 * Qué campos se van a llenar: los que trae la sugerencia y que el usuario NO ha
 * editado a mano. Con `forzar` (botón "Volver a llenar") se ignoran las ediciones.
 */
export function camposLlenables(s: DireccionGps, editados: ReadonlySet<CampoGps>, forzar = false): Set<CampoGps> {
  return new Set(CAMPOS_GPS.filter((c) => Boolean(s[c]) && (forzar || !editados.has(c))));
}

type FormDireccion = Pick<QuejaRequest, CampoGps>;

/**
 * Aplica la sugerencia sobre el formulario SIN pisar lo que el usuario escribió.
 * Los campos que el usuario no tocó quedan "en manos del GPS": si el nuevo punto
 * no trae, p. ej., número, se vacía (para no dejar el número de la casa anterior).
 * El municipio nunca se vacía (siempre debe tener uno de la lista).
 */
export function aplicarDireccion<T extends FormDireccion>(
  form: T,
  s: DireccionGps,
  editados: ReadonlySet<CampoGps>,
  forzar = false,
): T {
  const nuevo: T = { ...form };
  const destino = nuevo as FormDireccion;
  for (const campo of CAMPOS_GPS) {
    if (!forzar && editados.has(campo)) continue;
    const valor = s[campo];
    if (valor) destino[campo] = valor;
    else if (campo !== 'municipio') destino[campo] = '';
  }
  return nuevo;
}
