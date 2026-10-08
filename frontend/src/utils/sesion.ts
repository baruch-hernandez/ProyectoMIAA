// Todo lo de la sesión en UN solo lugar. Antes cada componente leía localStorage
// a su manera (unos 'usuario', otros 'user'), y por eso el id se perdía.

export type RolUsuario = 'ADMIN' | 'LECTURISTA';

export interface UsuarioSesion {
  id: number;
  nombre: string;
  rol: RolUsuario;
}

const LLAVE_TOKEN = 'token';
const LLAVE_USUARIO = 'usuario';

export function guardarSesion(token: string, usuario: UsuarioSesion): void {
  localStorage.setItem(LLAVE_TOKEN, token);
  localStorage.setItem(LLAVE_USUARIO, JSON.stringify(usuario));
}

export function obtenerToken(): string | null {
  return localStorage.getItem(LLAVE_TOKEN);
}

export function obtenerUsuario(): UsuarioSesion | null {
  try {
    const crudo = localStorage.getItem(LLAVE_USUARIO);
    return crudo ? (JSON.parse(crudo) as UsuarioSesion) : null;
  } catch {
    return null; // JSON corrupto: lo tratamos como "sin sesión"
  }
}

/**
 * Cierra sesión borrando SOLO lo de la sesión.
 * (localStorage.clear() también borraría las lecturas guardadas sin conexión.)
 */
export function cerrarSesion(): void {
  localStorage.removeItem(LLAVE_TOKEN);
  localStorage.removeItem(LLAVE_USUARIO);
}

/** Pantalla de inicio de cada rol. */
export function rutaInicio(rol: RolUsuario | string | undefined): string {
  switch (rol) {
    case 'ADMIN':
      return '/admin';
    case 'LECTURISTA':
      // El lecturista es el empleado de campo: entra a sus quejas.
      // (Si prefieres que entre a sus rutas de lectura, cambia esto a '/lecturas'.)
      return '/mis-quejas';
    default:
      return '/';
  }
}
