// Todo lo de la sesión en UN solo lugar. Antes cada componente leía localStorage
// a su manera (unos 'usuario', otros 'user'), y por eso el id se perdía.

export type RolUsuario = 'ADMIN' | 'NOTIFICADOR';

export interface UsuarioSesion {
  id: number;
  nombre: string;
  rol: RolUsuario;
  /** Entró con contraseña temporal: debe cambiarla antes de usar la app */
  debeCambiarPassword?: boolean;
  /** No ha aceptado el aviso de privacidad vigente */
  avisoPrivacidadPendiente?: boolean;
}

const LLAVE_TOKEN = 'token';
const LLAVE_USUARIO = 'usuario';

/**
 * La sesión vive en sessionStorage (requerimiento 3.2), no en localStorage:
 *  - se borra sola al cerrar la pestaña o el navegador, así el token no se queda guardado
 *    en una computadora compartida;
 *  - cada pestaña tiene su propia sesión (abrir otra pestaña pide iniciar sesión de nuevo).
 * Los reportes guardados sin señal viven aparte (IndexedDB) y NO se pierden al cerrar.
 */
const almacen = window.sessionStorage;

// Versiones anteriores guardaban el token en localStorage: se borra para no dejarlo ahí.
try {
  localStorage.removeItem(LLAVE_TOKEN);
  localStorage.removeItem(LLAVE_USUARIO);
} catch {
  /* navegador sin localStorage: nada que limpiar */
}

export function guardarSesion(token: string, usuario: UsuarioSesion): void {
  sessionStorage.removeItem('avisoLogin'); // ya entró: el aviso del login anterior sobra
  almacen.setItem(LLAVE_TOKEN, token);
  almacen.setItem(LLAVE_USUARIO, JSON.stringify(usuario));
}

export function obtenerToken(): string | null {
  return almacen.getItem(LLAVE_TOKEN);
}

export function obtenerUsuario(): UsuarioSesion | null {
  try {
    const crudo = almacen.getItem(LLAVE_USUARIO);
    if (!crudo) return null;
    const usuario = JSON.parse(crudo) as UsuarioSesion;
    // Sesiones abiertas antes del cambio de nombre del rol (LECTURISTA → NOTIFICADOR)
    if ((usuario.rol as string) === 'LECTURISTA') usuario.rol = 'NOTIFICADOR';
    return usuario;
  } catch {
    return null; // JSON corrupto: lo tratamos como "sin sesión"
  }
}

/** Actualiza parte de los datos guardados (p. ej. al resolver un requisito). */
export function actualizarUsuario(cambios: Partial<UsuarioSesion>): void {
  const actual = obtenerUsuario();
  if (actual) almacen.setItem(LLAVE_USUARIO, JSON.stringify({ ...actual, ...cambios }));
}

/** ¿Le falta cambiar su contraseña temporal o aceptar el aviso de privacidad? */
export function tieneRequisitosPendientes(u: UsuarioSesion | null): boolean {
  return Boolean(u?.debeCambiarPassword || u?.avisoPrivacidadPendiente);
}

/** Pantalla donde se resuelven los requisitos pendientes. */
export const RUTA_REQUISITOS = '/cuenta/requisitos';

/** Mensaje para mostrar en el login la próxima vez (p. ej. "tu cuenta fue dada de baja"). */
const LLAVE_AVISO_LOGIN = 'avisoLogin';
export function guardarAvisoLogin(mensaje: string): void {
  sessionStorage.setItem(LLAVE_AVISO_LOGIN, mensaje);
}
/** Solo lee (sin borrar): React puede llamar dos veces al inicializador en desarrollo. */
export function leerAvisoLogin(): string | null {
  return sessionStorage.getItem(LLAVE_AVISO_LOGIN);
}

/**
 * Cierra sesión borrando SOLO lo de la sesión.
 * (Los reportes pendientes de enviar viven en IndexedDB y se conservan.)
 */
export function cerrarSesion(): void {
  almacen.removeItem(LLAVE_TOKEN);
  almacen.removeItem(LLAVE_USUARIO);
}

/** Pantalla de inicio de cada rol (o la de requisitos, si tiene pendientes). */
export function rutaInicio(rol: RolUsuario | string | undefined, usuario: UsuarioSesion | null = obtenerUsuario()): string {
  if (usuario && tieneRequisitosPendientes(usuario)) return RUTA_REQUISITOS;
  switch (rol) {
    case 'ADMIN':
      return '/admin';
    case 'NOTIFICADOR':
      // El notificador es el empleado de campo: entra a sus reportes.
      return '/reportes';
    default:
      return '/';
  }
}
