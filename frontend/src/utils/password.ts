// Reglas de contraseña: las MISMAS que PoliticaPassword.java (el backend las vuelve a revisar).

export function reglasPassword(nueva: string, confirmacion?: string) {
  const reglas = [
    // Las MISMAS reglas que el backend (PoliticaPassword.java): si no coinciden, el front
    // dice "todo bien" y el servidor la rechaza con 400.
    { texto: 'Al menos 6 caracteres', ok: nueva.length >= 6 && nueva.length <= 72 },
    { texto: 'Al menos una letra y un número', ok: /\p{L}/u.test(nueva) && /\d/.test(nueva) },
  ];
  if (confirmacion !== undefined) {
    reglas.push({ texto: 'Las dos nuevas coinciden', ok: nueva.length > 0 && nueva === confirmacion });
  }
  return reglas;
}

export function cumplePolitica(password: string): boolean {
  return reglasPassword(password).every((r) => r.ok);
}

// Sin caracteres que se confunden al dictarlos (l/1, O/0, i)
const LETRAS = 'abcdefghjkmnpqrstuvwxyz';
const DIGITOS = '23456789';

function alAzar(conjunto: string, cuantos: number): string {
  const valores = crypto.getRandomValues(new Uint32Array(cuantos)); // aleatorio de verdad, no Math.random
  return Array.from(valores, (v) => conjunto[v % conjunto.length]).join('');
}

/**
 * Contraseña TEMPORAL fácil de dictar por teléfono, p. ej. "MIAA-4827-kxdp".
 * Cumple la política (letras + números, 14 caracteres). El empleado la cambia al entrar.
 */
export function generarPasswordTemporal(): string {
  return `MIAA-${alAzar(DIGITOS, 4)}-${alAzar(LETRAS, 4)}`;
}
