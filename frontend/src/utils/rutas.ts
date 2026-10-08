// Todo lo de "rutas" del panel del jefe en un solo lugar: tipos, etiquetas,
// colores y la lógica de filtrado (sin React, para poder reusarla y probarla).

export type EstadoRuta = 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADA';

export const ESTADOS_RUTA: EstadoRuta[] = ['PENDIENTE', 'EN_PROCESO', 'COMPLETADA'];

export interface LecturistaResumen {
  id: number;
  nombre: string;
  username: string;
}

/** Forma de una ruta como la usa el panel (ya con `puntos` convertido de JSON a arreglo). */
export interface RutaItem {
  id: number;
  codigoSector: string;
  colonia: string;
  estado: string; // en la BD es texto libre; normalmente uno de EstadoRuta
  puntos: [number, number][];
  fechaAsignacion?: string;
  lecturista?: { id: number; nombre?: string; username?: string } | null;
}

export const ETIQUETA_ESTADO_RUTA: Record<EstadoRuta, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  COMPLETADA: 'Completada',
};

export const ETIQUETA_PLURAL_RUTA: Record<EstadoRuta, string> = {
  PENDIENTE: 'Pendientes',
  EN_PROCESO: 'En proceso',
  COMPLETADA: 'Completadas',
};

/** Paleta MIAA (misma lógica que las quejas): ámbar = pendiente, cielo = en proceso, menta = completada. */
export const COLOR_ESTADO_RUTA: Record<EstadoRuta, { linea: string; insignia: string; punto: string }> = {
  PENDIENTE: { linea: '#e0a800', insignia: 'bg-[#fff4cc] text-[#7a5600]', punto: 'bg-miaa-ambar' },
  EN_PROCESO: { linea: '#1aa3e0', insignia: 'bg-[#e0f6ff] text-[#035e86]', punto: 'bg-miaa-cielo' },
  COMPLETADA: { linea: '#0fa987', insignia: 'bg-[#d3fbf2] text-[#0b6b58]', punto: 'bg-miaa-menta' },
};

const COLOR_DESCONOCIDO = { linea: '#64748b', insignia: 'bg-slate-200 text-slate-700', punto: 'bg-slate-400' };

export function esEstadoRuta(valor: string): valor is EstadoRuta {
  return (ESTADOS_RUTA as string[]).includes(valor);
}

export function colorRuta(estado: string) {
  return esEstadoRuta(estado) ? COLOR_ESTADO_RUTA[estado] : COLOR_DESCONOCIDO;
}

export function etiquetaRuta(estado: string) {
  return esEstadoRuta(estado) ? ETIQUETA_ESTADO_RUTA[estado] : estado;
}

// ---------------------------------------------------------------- filtros

/** "todos" | "sin-asignar" | id del lecturista como texto (así cabe en la URL). */
export type FiltroLecturista = 'todos' | 'sin-asignar' | `${number}`;

export interface FiltrosRutas {
  estado: EstadoRuta | 'TODAS';
  lecturista: FiltroLecturista;
  busqueda: string;
}

export const FILTROS_INICIALES: FiltrosRutas = { estado: 'TODAS', lecturista: 'todos', busqueda: '' };

/** Quita acentos y pasa a minúsculas: "Purísima" encuentra "purisima". */
function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Filtra SOLO por lecturista y búsqueda (sirve para calcular los conteos por estado). */
function filtrarSinEstado(rutas: RutaItem[], f: FiltrosRutas): RutaItem[] {
  const q = normalizar(f.busqueda);
  return rutas.filter((r) => {
    if (f.lecturista === 'sin-asignar' && r.lecturista) return false;
    if (f.lecturista !== 'todos' && f.lecturista !== 'sin-asignar' && String(r.lecturista?.id) !== f.lecturista) {
      return false;
    }
    if (q) {
      const texto = normalizar(`${r.codigoSector} ${r.colonia} ${r.lecturista?.nombre ?? ''}`);
      if (!texto.includes(q)) return false;
    }
    return true;
  });
}

export function filtrarRutas(rutas: RutaItem[], f: FiltrosRutas): RutaItem[] {
  const base = filtrarSinEstado(rutas, f);
  return f.estado === 'TODAS' ? base : base.filter((r) => r.estado === f.estado);
}

/**
 * Cuántas rutas hay en cada estado, RESPETANDO el lecturista y la búsqueda elegidos.
 * Así, si eliges a "Juan Pérez", las pestañas dicen cuántas pendientes tiene Juan.
 */
export function contarPorEstado(rutas: RutaItem[], f: FiltrosRutas): Record<EstadoRuta | 'TODAS', number> {
  const base = filtrarSinEstado(rutas, f);
  const conteo = { TODAS: base.length, PENDIENTE: 0, EN_PROCESO: 0, COMPLETADA: 0 };
  base.forEach((r) => {
    if (esEstadoRuta(r.estado)) conteo[r.estado] += 1;
  });
  return conteo;
}

export function hayFiltrosActivos(f: FiltrosRutas) {
  return f.estado !== 'TODAS' || f.lecturista !== 'todos' || f.busqueda.trim() !== '';
}
