// Tipos que reflejan EXACTAMENTE los DTO del backend (mismos nombres de campo).
// Si cambias un record de Java (QuejaRequestDTO, QuejaDetalleDTO...), cambia aquí también.

export type EstadoQueja = 'PENDIENTE' | 'ASIGNADA' | 'EN_PROCESO' | 'RESUELTA' | 'CANCELADA';
export type PrioridadQueja = 'BAJA' | 'MEDIA' | 'ALTA';
export type CategoriaQueja =
  | 'FUGA_AGUA'
  | 'FALTA_AGUA'
  | 'BAJA_PRESION'
  | 'CALIDAD_AGUA'
  | 'DRENAJE'
  | 'MEDIDOR'
  | 'COBRO'
  | 'OTRO';

export interface Coordenadas {
  lat: number;
  lng: number;
}

/** POST /quejas  ↔  QuejaRequestDTO.java */
export interface QuejaRequest {
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
  colonia: string;
  codigoPostal: string;
  municipio: string;
  referencias: string;
  numeroContrato: string;
  latitud: number | null;
  longitud: number | null;
  categoria: CategoriaQueja;
  descripcion: string;
  prioridad: PrioridadQueja;
  fotos: string[]; // base64 "data:image/jpeg;base64,..."
}

/** GET /quejas/mias  ↔  QuejaResumenDTO.java */
export interface QuejaResumen {
  id: number;
  folio: string;
  domicilio: string;
  colonia: string;
  municipio: string;
  categoria: CategoriaQueja;
  prioridad: PrioridadQueja;
  estado: EstadoQueja;
  asignadoA: string | null;
  fechaCreacion: string; // ISO: "2026-10-07T14:46:00"
}

/** ↔ NotaDTO.java */
export interface Nota {
  id: number;
  texto: string;
  autor: string;
  autorRol: string;
  fechaCreacion: string;
}

/** GET /quejas/{id}  ↔  QuejaDetalleDTO.java */
export interface QuejaDetalle {
  id: number;
  folio: string;
  calle: string;
  numeroExterior: string;
  numeroInterior: string | null;
  colonia: string;
  codigoPostal: string;
  municipio: string;
  referencias: string | null;
  numeroContrato: string | null;
  latitud: number | null;
  longitud: number | null;
  categoria: CategoriaQueja;
  descripcion: string;
  prioridad: PrioridadQueja;
  estado: EstadoQueja;
  creadoPor: string;
  asignadoA: string | null;
  fechaCreacion: string;
  fechaActualizacion: string;
  fotos: string[];
  notas: Nota[];
}
