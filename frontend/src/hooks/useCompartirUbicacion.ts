import { useEffect, useState } from 'react';
import { ubicacionApi } from '../services/ubicacionApi';

export type EstadoUbicacion = 'iniciando' | 'compartiendo' | 'sin-permiso' | 'no-disponible' | 'error';

/** Mínimo entre envíos aunque el celular reporte movimiento seguido. */
const INTERVALO_MIN_MS = 1_000;
/** "Latido": aunque no se mueva, avisa cada segundo que sigue conectado (el backend da 2 s de margen). */
const LATIDO_MS = 1_000;

const hayGeolocalizacion = typeof navigator !== 'undefined' && 'geolocation' in navigator;

/**
 * Mientras el notificador tenga la app ABIERTA, comparte su ubicación con el admin.
 *
 *  - watchPosition: el navegador avisa cada vez que cambia la posición.
 *  - Se manda al backend como máximo cada segundo. Si se movió antes, NO se descarta: se
 *    agenda para cuando se cumpla el segundo (si no, el admin lo vería tarde).
 *  - Cada segundo se manda aunque no se mueva (latido), para que siga "en línea".
 *  - Sin red, el envío falla en silencio: el admin lo verá "sin conexión" y la última posición.
 *    Al volver la red ('online'), se manda de inmediato.
 *
 * Límite de las páginas web: si el celular apaga la pantalla o la app se va al fondo,
 * el navegador pausa todo y deja de mandar. Para rastreo en segundo plano hace falta
 * una app nativa (por ejemplo la de Flutter).
 */
export function useCompartirUbicacion(): EstadoUbicacion {
  const [estado, setEstado] = useState<EstadoUbicacion>(hayGeolocalizacion ? 'iniciando' : 'no-disponible');

  useEffect(() => {
    if (!hayGeolocalizacion) return;

    let ultima: GeolocationPosition | null = null;
    let ultimoEnvio = 0;
    let enviando = false;
    let pendiente: number | undefined; // envío agendado por un movimiento dentro de los 10 s

    const enviar = () => {
      window.clearTimeout(pendiente);
      pendiente = undefined;
      // Oculta = pausada (usePresencia ya avisó): un envío suelto la volvería a mostrar en línea
      if (!ultima || enviando || document.hidden) return;
      enviando = true;
      ultimoEnvio = Date.now();
      const { latitude, longitude, accuracy } = ultima.coords;
      ubicacionApi
        .enviar({
          latitud: latitude,
          longitud: longitude,
          precision: Math.round(accuracy),
          fecha: new Date(ultima.timestamp).toISOString(),
        })
        .catch(() => { /* sin red o servidor caído: el admin lo verá "sin conexión" */ })
        .finally(() => { enviando = false; });
    };

    const idVigilancia = navigator.geolocation.watchPosition(
      (pos) => {
        ultima = pos;
        setEstado('compartiendo');
        const transcurrido = Date.now() - ultimoEnvio;
        if (transcurrido >= INTERVALO_MIN_MS) enviar();
        else if (pendiente === undefined) pendiente = window.setTimeout(enviar, INTERVALO_MIN_MS - transcurrido);
      },
      (err) => setEstado(err.code === err.PERMISSION_DENIED ? 'sin-permiso' : 'error'),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    );

    const latido = window.setInterval(() => {
      if (Date.now() - ultimoEnvio >= LATIDO_MS) enviar();
    }, LATIDO_MS);

    const alVolverLaRed = () => enviar();
    window.addEventListener('online', alVolverLaRed);

    return () => {
      navigator.geolocation.clearWatch(idVigilancia);
      window.clearInterval(latido);
      window.clearTimeout(pendiente);
      window.removeEventListener('online', alVolverLaRed);
    };
  }, []);

  return estado;
}
