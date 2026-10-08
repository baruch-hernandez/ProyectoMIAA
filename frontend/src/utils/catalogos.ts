// Etiquetas y colores para mostrar los valores que manda el backend.
// ⚠️ Deben coincidir con los enums de Java (CategoriaQueja, PrioridadQueja, EstadoQueja).
import type { CategoriaQueja, EstadoQueja, PrioridadQueja } from '../types/queja';

export const CATEGORIAS: Record<CategoriaQueja, string> = {
  FUGA_AGUA: 'Fuga de agua',
  FALTA_AGUA: 'Falta de agua',
  BAJA_PRESION: 'Baja presión',
  CALIDAD_AGUA: 'Calidad del agua',
  DRENAJE: 'Drenaje / alcantarillado',
  MEDIDOR: 'Medidor',
  COBRO: 'Cobro / recibo',
  OTRO: 'Otro',
};

export const PRIORIDADES: Record<PrioridadQueja, string> = {
  BAJA: 'Baja',
  MEDIA: 'Media',
  ALTA: 'Alta',
};

export const ESTADOS: Record<EstadoQueja, string> = {
  PENDIENTE: 'Pendiente',
  ASIGNADA: 'Asignada',
  EN_PROCESO: 'En proceso',
  RESUELTA: 'Resuelta',
  CANCELADA: 'Cancelada',
};

/** Clases de Tailwind por estado (fondo + texto + borde). */
export const COLOR_ESTADO: Record<EstadoQueja, string> = {
  PENDIENTE: 'bg-amber-50 text-amber-800 border-amber-200',
  ASIGNADA: 'bg-blue-50 text-blue-800 border-blue-200',
  EN_PROCESO: 'bg-violet-50 text-violet-800 border-violet-200',
  RESUELTA: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  CANCELADA: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const COLOR_PRIORIDAD: Record<PrioridadQueja, string> = {
  BAJA: 'bg-slate-100 text-slate-700',
  MEDIA: 'bg-orange-50 text-orange-700',
  ALTA: 'bg-red-50 text-red-700',
};

/** Los 11 municipios de Aguascalientes (mismo orden que QuejaService.MUNICIPIOS). */
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

/** Centro de la ciudad de Aguascalientes (mismo que usa AdminDashboard). */
export const CENTRO_AGS: [number, number] = [21.8824, -102.2826];

export function formatoFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}
