// Catálogos y formatos de fecha que comparten las pantallas.

/** Los 11 municipios de Aguascalientes (mismo orden que ReporteService.MUNICIPIOS). */
export const MUNICIPIOS = [
  'Aguascalientes',
  'Asientos',
  'Calvillo',
  'Cosío',
  'El Llano',
  'Jesús María',
  'Pabellón de Arteaga',
  'Rincón de Romos',
  'San Francisco de los Romo',
  'San José de Gracia',
  'Tepezalá',
] as const;

/** Tipos de predio: clave que entiende el backend (DatosReporte.TIPOS_PREDIO) → lo que se lee. */
export const TIPOS_PREDIO: Record<string, string> = {
  HABITACIONAL: 'Habitacional',
  COMERCIAL: 'Comercial',
  INDUSTRIAL: 'Industrial',
  BALDIO: 'Baldío',
  EN_CONSTRUCCION: 'En construcción',
  DESHABITADO: 'Deshabitado',
};

/** Centro de la ciudad de Aguascalientes. */
export const CENTRO_AGS: [number, number] = [21.8824, -102.2826];

/** "9 oct 2026, 14:02" */
export function formatoFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Cada cuánto pregunta el admin por las ubicaciones (solo con el mapa abierto y visible). */
export const CONSULTA_MS = 1_000;

/** "hace 12 s", "hace 3 min", "hace 2 h" */
export function haceCuanto(segundos: number): string {
  if (segundos < 60) return `hace ${segundos} s`;
  const min = Math.floor(segundos / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} d`;
}

/** "hace 3 h", "ayer", "12 sep": más fácil de leer en la calle que una fecha completa. */
export function fechaRelativa(iso: string): string {
  const fecha = new Date(iso);
  const minutos = Math.round((Date.now() - fecha.getTime()) / 60000);
  if (minutos < 1) return 'justo ahora';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias === 1) return 'ayer';
  if (dias < 7) return `hace ${dias} días`;
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}
