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
  /** UUID que genera el celular: si se reenvía (sin conexión), el servidor no lo duplica */
  clienteId?: string;
}

/** PUT /reportes/{id}  ↔  ReporteEdicionDTO.java (sin fotos: se cambian aparte) */
export type ReporteEdicion = Omit<ReporteRequest, 'fotos' | 'clienteId'>;

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
  editado: boolean;
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
  /** Cuándo se corrigió domicilio o descripción (null = nunca) */
  fechaEdicion: string | null;
  fotos: Foto[];
  notas: Nota[];
  /** true solo para quien lo subió (puede agregar notas y quitar/poner fotos) */
  puedeEditar: boolean;
  /** true si además sigue a tiempo de corregirlo o borrarlo */
  puedeModificar: boolean;
  /** Hasta cuándo puede corregirlo o borrarlo */
  modificableHasta: string | null;
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
  /** Ahorita está compartiendo su ubicación (app abierta y con red) */
  enLinea: boolean;
  /** false = el admin lo dio de baja */
  habilitado: boolean;
}

/** GET /usuarios/empleados  ↔  EmpleadosDTO.java */
export interface EmpleadosRespuesta {
  /** Días sin actividad para considerar a alguien inactivo (configurable en el backend) */
  diasInactivo: number;
  empleados: Empleado[];
}

/** POST /ubicacion  ↔  UbicacionRequestDTO.java */
export interface UbicacionNueva {
  latitud: number;
  longitud: number;
  precision: number; // metros (±)
  fecha: string; // cuándo la midió el celular (ISO)
}

/** GET /usuarios/empleados/{id}/ubicacion  ↔  UbicacionEmpleadoDTO.java */
export interface UbicacionEmpleado {
  empleadoId: number;
  nombre: string;
  username: string;
  tieneUbicacion: boolean;
  enLinea: boolean;
  latitud: number | null;
  longitud: number | null;
  precisionMetros: number | null;
  fechaDispositivo: string | null;
  fechaRecibida: string | null;
  segundosDesdeUltima: number | null;
  segundosParaEnLinea: number;
}

// ---------------------------------------------------------------- cuentas

/** GET /usuarios/yo  ↔  CuentaDTO.java */
export interface Cuenta {
  id: number;
  nombre: string;
  username: string;
  email: string | null;
  rol: 'ADMIN' | 'NOTIFICADOR';
  debeCambiarPassword: boolean;
  avisoPrivacidadPendiente: boolean;
  /** Versión vigente del aviso (la que se debe aceptar) */
  avisoPrivacidadVersion: string;
}

/** GET /usuarios/empleados/{id}  ↔  CuentaEmpleadoDTO.java */
export interface CuentaEmpleado {
  id: number;
  nombre: string;
  username: string;
  email: string | null;
  habilitado: boolean;
  debeCambiarPassword: boolean;
  fechaAlta: string | null;
  ultimoAcceso: string | null;
  avisoPrivacidadFecha: string | null;
  /** Bloqueada por intentos fallidos hasta esta hora (null = no) */
  bloqueadoHasta: string | null;
}

/** POST /usuarios/empleados  ↔  NuevoEmpleadoDTO.java */
export interface NuevoEmpleado {
  nombre: string;
  username: string;
  email: string;
  passwordTemporal: string;
}

export type EdicionEmpleado = Omit<NuevoEmpleado, 'passwordTemporal'>;
