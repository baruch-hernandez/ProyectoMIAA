import { useEffect } from 'react';
import { presenciaApi } from '../services/presenciaApi';

/** Cada cuánto avisa "sigo aquí". El backend da 60 s de margen (miaa.presencia.segundos-en-linea). */
const LATIDO_MS = 30_000;

/**
 * Mientras la app esté ABIERTA, manda un latido al backend para salir "En línea"
 * en el panel del administrador (tarea 2.4).
 *
 *  - Al montar (entró o recargó la página) manda uno de inmediato.
 *  - Luego cada 30 s. El backend lo da por DESCONECTADO si pasan 60 s sin latido: así un
 *    latido perdido (mala señal) no lo hace parpadear, pero si cierra la pestaña o se queda
 *    sin red, en máximo un minuto sale desconectado.
 *  - Si la pestaña está oculta (otra pestaña o pantalla apagada), no manda nada: igual que
 *    en WhatsApp, "en línea" = la app está a la vista. Al volver, manda uno al instante.
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
