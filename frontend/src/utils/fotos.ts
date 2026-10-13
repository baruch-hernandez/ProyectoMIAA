// Fotos de evidencia: buena resolución + la hora en que se TOMARON.
//
// Lo que pidió MIAA:
//  1. "Las fotos deben tener buena resolución; si no, borrarlas" → mínimo HD (1280×720).
//     Las de baja resolución se rechazan aquí y también en el backend (ValidadorFotos.java).
//  2. "Priorizar la hora de captura de la foto sobre la hora de carga al servidor"
//     → se lee del EXIF de la cámara (DateTimeOriginal). Si no hay, la fecha del archivo.
//
// OJO con el orden: el EXIF se lee del archivo ORIGINAL. Al redibujar la foto en un
// <canvas> para comprimirla, el EXIF se pierde.
import type { FotoNueva, OrigenFechaFoto } from '../types/reporte';

/** HD: lado largo ≥ 1280 y lado corto ≥ 720 (vale igual para foto vertical u horizontal). */
export const LADO_LARGO_MIN = 1280;
export const LADO_CORTO_MIN = 720;
/** Más de esto no aporta para evidencia y gasta datos del celular: se reduce a Full HD. */
export const LADO_LARGO_MAX = 1920;
/** Peso objetivo por foto (el backend acepta hasta ~1.8 MB). */
export const MAX_BYTES = 1_200_000;
/** Tolerancia para relojes de celular un poco adelantados (igual que el backend). */
const TOLERANCIA_FUTURO_MS = 10 * 60 * 1000;
const FECHA_MINIMA = Date.UTC(2000, 0, 1);

export interface FotoPreparada extends FotoNueva {
  ancho: number;
  alto: number;
}

/** Error "esperado" (foto chica, archivo que no es imagen): su mensaje se muestra tal cual. */
export class FotoRechazada extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'FotoRechazada';
  }
}

// ---------------------------------------------------------------- resolución

export function cumpleHD(ancho: number, alto: number): boolean {
  return Math.max(ancho, alto) >= LADO_LARGO_MIN && Math.min(ancho, alto) >= LADO_CORTO_MIN;
}

/**
 * Cuánto reducir: que el lado largo quede en 1920 como máximo, pero SIN que el lado
 * corto baje de 720 (una panorámica de 4000×900 no se puede reducir a 1920×432).
 * Nunca agranda (máximo 1).
 */
export function calcularEscala(ancho: number, alto: number): number {
  const largo = Math.max(ancho, alto);
  const corto = Math.min(ancho, alto);
  return Math.min(1, Math.max(LADO_LARGO_MAX / largo, LADO_CORTO_MIN / corto));
}

// ---------------------------------------------------------------- hora de captura

/**
 * Lee la fecha de captura del EXIF de un JPEG (sin librerías).
 *
 * Un JPEG es una lista de "segmentos". El EXIF vive en el segmento APP1 (0xFFE1),
 * que dentro trae una mini-estructura TIFF con "directorios" (IFD) de etiquetas:
 *   IFD0 ──(etiqueta 0x8769)──► IFD Exif ──► 0x9003 DateTimeOriginal "2026:10:09 14:02:15"
 *                                         └► 0x9011 OffsetTimeOriginal "-06:00" (si existe)
 * Regresa null si no hay EXIF o viene dañado (nunca lanza error).
 */
export function leerFechaExif(buffer: ArrayBuffer): Date | null {
  try {
    const v = new DataView(buffer);
    if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null; // no es JPEG

    let pos = 2;
    while (pos + 4 <= v.byteLength) {
      const marcador = v.getUint16(pos);
      if ((marcador & 0xff00) !== 0xff00) return null; // estructura rota
      if (marcador === 0xffda || marcador === 0xffd9) return null; // ya empieza la imagen: no hubo EXIF
      const largo = v.getUint16(pos + 2);
      if (marcador === 0xffe1 && texto(v, pos + 4, 6) === 'Exif\0\0') {
        return leerTiff(v, pos + 10);
      }
      pos += 2 + largo;
    }
    return null;
  } catch {
    return null; // RangeError por datos truncados, etc.
  }
}

function texto(v: DataView, inicio: number, largo: number): string {
  let s = '';
  for (let i = 0; i < largo; i++) s += String.fromCharCode(v.getUint8(inicio + i));
  return s;
}

function leerTiff(v: DataView, tiff: number): Date | null {
  const orden = v.getUint16(tiff);
  if (orden !== 0x4949 && orden !== 0x4d4d) return null; // "II" (Intel) o "MM" (Motorola)
  const le = orden === 0x4949; // little-endian
  const u16 = (p: number) => v.getUint16(p, le);
  const u32 = (p: number) => v.getUint32(p, le);
  if (u16(tiff + 2) !== 42) return null;

  /** Etiquetas de un IFD → posición absoluta de su valor y cuántos bytes mide. */
  const leerIfd = (inicio: number) => {
    const etiquetas = new Map<number, { pos: number; cuenta: number }>();
    const n = u16(inicio);
    for (let i = 0; i < n; i++) {
      const e = inicio + 2 + i * 12;
      const tag = u16(e);
      const tipo = u16(e + 2);
      const cuenta = u32(e + 4);
      const bytesPorValor = tipo === 3 ? 2 : tipo === 4 ? 4 : 1; // SHORT, LONG, ASCII/BYTE
      const pos = cuenta * bytesPorValor <= 4 ? e + 8 : tiff + u32(e + 8);
      etiquetas.set(tag, { pos, cuenta });
    }
    return etiquetas;
  };
  const ascii = (e?: { pos: number; cuenta: number }) =>
    e ? texto(v, e.pos, e.cuenta).replace(/\0+$/, '').trim() : undefined;

  const ifd0 = leerIfd(tiff + u32(tiff + 4));
  const punteroExif = ifd0.get(0x8769);
  const exif = punteroExif ? leerIfd(tiff + u32(punteroExif.pos)) : new Map<number, { pos: number; cuenta: number }>();

  const fecha =
    ascii(exif.get(0x9003)) ?? // DateTimeOriginal: cuando se tomó (la buena)
    ascii(exif.get(0x9004)) ?? // DateTimeDigitized
    ascii(ifd0.get(0x0132)); // DateTime (a veces es la de edición)
  const zona = ascii(exif.get(0x9011)) ?? ascii(exif.get(0x9010)); // "-06:00"
  return fecha ? interpretarFechaExif(fecha, zona) : null;
}

/**
 * "2026:10:09 14:02:15" (+ "-06:00" opcional) → Date.
 * Sin zona, el EXIF está en la hora local del celular que la tomó: la interpretamos
 * como hora local de este dispositivo (en campo, son el mismo).
 */
export function interpretarFechaExif(valor: string, zona?: string): Date | null {
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(valor);
  if (!m) return null;
  const [anio, mes, dia, h, min, s] = m.slice(1).map(Number);
  if (anio === 0 || mes === 0 || dia === 0) return null; // "0000:00:00 00:00:00" = sin fecha

  const z = zona ? /^([+-])(\d{2}):(\d{2})$/.exec(zona) : null;
  if (z) {
    const signo = z[1] === '-' ? -1 : 1;
    const desfaseMin = signo * (Number(z[2]) * 60 + Number(z[3]));
    return new Date(Date.UTC(anio, mes - 1, dia, h, min, s) - desfaseMin * 60_000);
  }
  return new Date(anio, mes - 1, dia, h, min, s);
}

/**
 * Elige la hora de captura, de la más a la menos confiable:
 *   EXIF → fecha del archivo → ahora.
 * Se descarta cualquiera que sea del futuro (reloj de cámara mal puesto) o absurda.
 */
export function elegirFechaCaptura(
  exif: Date | null,
  modificadoMs: number | undefined,
  ahora: Date,
): { fecha: Date; origen: OrigenFechaFoto } {
  const razonable = (ms: number) => ms >= FECHA_MINIMA && ms <= ahora.getTime() + TOLERANCIA_FUTURO_MS;

  if (exif && !Number.isNaN(exif.getTime()) && razonable(exif.getTime())) {
    return { fecha: exif, origen: 'EXIF' };
  }
  if (modificadoMs && razonable(modificadoMs)) {
    return { fecha: new Date(modificadoMs), origen: 'ARCHIVO' };
  }
  return { fecha: ahora, origen: 'SUBIDA' };
}

// ---------------------------------------------------------------- todo junto

function cargarImagen(archivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new FotoRechazada('Ese archivo no se pudo abrir como imagen. Intenta con otra foto.'));
    };
    img.src = url;
  });
}

/**
 * Archivo elegido → foto lista para mandar:
 *  1. lee la hora de captura (EXIF) del archivo original,
 *  2. revisa que sea HD (si no, FotoRechazada con el motivo),
 *  3. la reduce a máx. 1920 px y la comprime a ~1.2 MB sin bajar de HD.
 */
export async function prepararFoto(archivo: File, ahora = new Date()): Promise<FotoPreparada> {
  if (!archivo.type.startsWith('image/')) {
    throw new FotoRechazada('Ese archivo no es una imagen.');
  }

  const exif = leerFechaExif(await archivo.arrayBuffer());
  const { fecha, origen } = elegirFechaCaptura(exif, archivo.lastModified, ahora);

  // Los navegadores actuales ya giran la foto según el EXIF al dibujarla.
  const img = await cargarImagen(archivo);
  const ancho = img.naturalWidth;
  const alto = img.naturalHeight;
  if (!cumpleHD(ancho, alto)) {
    throw new FotoRechazada(
      `Esta foto tiene baja resolución (${ancho}×${alto}). Se necesita mínimo ${LADO_LARGO_MIN}×${LADO_CORTO_MIN}: ` +
        'tómala con la cámara del celular (no capturas de pantalla ni fotos reenviadas por WhatsApp).',
    );
  }

  const escala = calcularEscala(ancho, alto);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(ancho * escala);
  canvas.height = Math.round(alto * escala);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new FotoRechazada('Tu navegador no pudo procesar la foto.');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Bajamos la calidad poco a poco hasta que pese ≤ 1.2 MB (base64 pesa 4/3 del real).
  let datos = '';
  for (const calidad of [0.85, 0.78, 0.7, 0.62, 0.55]) {
    datos = canvas.toDataURL('image/jpeg', calidad);
    if (datos.length * 0.75 <= MAX_BYTES) break;
  }

  return {
    datos,
    ancho: canvas.width,
    alto: canvas.height,
    fechaCaptura: fecha.toISOString(),
    origenFecha: origen,
  };
}

/** Texto para mostrar junto a la foto: "Tomada 9 oct 2026, 14:02". */
export function textoHoraFoto(fechaCaptura: string, origen: OrigenFechaFoto): { principal: string; detalle?: string } {
  const hora = new Date(fechaCaptura).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
  switch (origen) {
    case 'EXIF':
      return { principal: `Tomada ${hora}` };
    case 'ARCHIVO':
      return { principal: `Tomada ${hora}`, detalle: 'según la fecha del archivo' };
    case 'SUBIDA':
      return { principal: `Agregada ${hora}`, detalle: 'la foto no traía su hora de captura' };
  }
}
