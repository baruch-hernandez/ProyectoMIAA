import { useEffect } from 'react';
import { presenciaApi } from '../services/presenciaApi';

/** Cada cuánto avisa "sigo aquí". El backend da 2 s de margen (miaa.presencia.segundos-en-linea). */
const LATIDO_MS = 1_000;

/**
 * Mientras la app esté A LA VISTA, manda un latido al backend para salir "Activo"
 * en el panel del administrador (tarea 2.4).
 *
 *  - Al montar (entró o recargó la página) manda uno de inmediato y luego cada segundo.
 *  - Con la pestaña oculta (otra pestaña o pantalla apagada) avisa que se pausó y sale inactivo
 *    al instante. Si ese aviso no llega (sin red, navegador cerrado), el backend lo da por
 *    inactivo solo a los 2 s sin latido. Al volver, manda uno al instante.
 *  - Al volver la red ('online') también manda uno al instante.
 *  - Si un latido falla (sin red), se ignora: el siguiente lo intenta otra vez.
 */
export function usePresencia(): void {
  useEffect(() => {
    let enviando = false;

    const latir = () => {
      if (enviando || document.visibilityState !== 'visible') return;
      enviando = true;
      presenciaApi
        .latido()
        .catch(() => { /* sin red o servidor caído: se reintenta en el siguiente latido */ })
        .finally(() => { enviando = false; });
    };

    latir();
    const intervalo = window.setInterval(latir, LATIDO_MS);

    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible') latir();
      else presenciaApi.pausar().catch(() => { /* sin red: el backend lo pasa a inactivo a los 2 s */ });
    };
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    window.addEventListener('online', latir);

    // Limpieza: al salir del layout (cerrar sesión) deja de mandar latidos
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      window.removeEventListener('online', latir);
    };
  }, []);
}
