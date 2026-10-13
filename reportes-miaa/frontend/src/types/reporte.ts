// Tipos que reflejan EXACTAMENTE los DTO del backend (mismos nombres de campo).
// Si cambias un record de Java (ReporteRequestDTO, ReporteDetalleDTO...), cambia aquí también.
//
// Un reporte es solo: domicilio + descripción + fotos + notas.
// (Sin categoría, prioridad, estado ni asignación: así lo pidió MIAA.)

export interface Coordenadas {
  lat: number;
  lng: number;
}

/** De dónde salió la hora de captura de una foto, de más a menos confiable. */
export type OrigenFechaFoto = 'EXIF' | 'ARCHIVO' | 'SUBIDA';

/** Foto que se manda al backend  ↔  FotoRequestDTO.java */
export interface FotoNueva {
  datos: string; // "data:image/jpeg;base64,..."
  fechaCaptura: string; // ISO con zona: "2026-10-09T20:02:15.000Z"
  origenFecha: OrigenFechaFoto;
}

/** ↔ FotoDTO.java */
export interface Foto {
  id: number;
  datos: string;
  ancho: number;
  alto: number;
  fechaCaptura: string; // cuándo se TOMÓ (la que importa)
  origenFecha: OrigenFechaFoto;
  fechaSubida: string; // cuándo llegó al servidor
}

/** POST /reportes  ↔  ReporteRequestDTO.java */
export interface ReporteRequest {
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
  descripcion: string;
  fotos: FotoNueva[];
}

/** GET /reportes y /reportes/mios  ↔  ReporteResumenDTO.java */
export interface ReporteResumen {
  id: number;
  folio: string;
  domicilio: string;
  colonia: string;
  municipio: string;
  descripcion: string; // recortada
  autor: string;
  autorId: number;
  fechaCreacion: string;
  totalFotos: number;
  totalNotas: number;
}

/** ↔ NotaDTO.java */
export interface Nota {
  id: number;
  texto: string;
  autor: string;
  autorRol: string;
  fechaCreacion: string;
}

/** GET /reportes/{id}  ↔  ReporteDetalleDTO.java */
export interface ReporteDetalle {
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
  descripcion: string;
  autor: string;
  fechaCreacion: string;
  fechaActualizacion: string;
  fotos: Foto[];
  notas: Nota[];
  /** true solo para quien lo subió (puede agregar notas y quitar/poner fotos) */
  puedeEditar: boolean;
}

/** GET /usuarios/empleados  ↔  EmpleadoDTO.java */
export interface Empleado {
  id: number;
  nombre: string;
  username: string;
  ultimoAcceso: string | null;
  ultimoReporte: string | null;
  totalReportes: number;
  ultimaActividad: string | null;
  activo: boolean;
  diasSinActividad: number | null;
}

/** GET /usuarios/empleados  ↔  EmpleadosDTO.java */
export interface EmpleadosRespuesta {
  /** Días sin actividad para considerar a alguien inactivo (configurable en el backend) */
  diasInactivo: number;
  empleados: Empleado[];
}
