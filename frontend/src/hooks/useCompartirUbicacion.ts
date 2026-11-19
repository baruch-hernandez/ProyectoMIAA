import { useEffect, useState } from 'react';
import { presenciaApi } from '../services/presenciaApi';
import { dentroDeAguascalientes } from '../utils/limiteAgs';

export type EstadoUbicacion = 'iniciando' | 'compartiendo' | 'sin-permiso' | 'no-disponible' | 'error';

/** Un latido por segundo: el backend da 2 s de margen (miaa.presencia.segundos-en-linea). */
const LATIDO_MS = 1_000;

const hayGeolocalizacion = typeof navigator !== 'undefined' && 'geolocation' in navigator;

/**
 * Mientras el notificador tenga la app A LA VISTA: "sigo aquí" y su ubicación para el admin,
 * en UNA petición por segundo (POST /usuarios/heartbeat), igual que la app de Flutter.
 *
 *  - Con coordenadas si el GPS ya dio una lectura dentro del estado; si no, sin cuerpo.
 *    watchPosition solo guarda la última lectura: el latido de cada segundo la lleva.
 *  - Pestaña oculta o pantalla apagada: avisa que se pausó (sale inactivo al instante). Si ese
 *    aviso no llega, el backend lo da por inactivo a los 2 s sin latido. Al volver, late ya.
 *  - Sin red, falla en silencio; al volver la red ('online') late de inmediato.
 *
 * Límite de las páginas web: si el celular apaga la pantalla o la app se va al fondo,
 * el navegador pausa todo y deja de mandar. Para rastreo en segundo plano hace falta
 * una app nativa (por ejemplo la de Flutter).
 */
export function useCompartirUbicacion(): EstadoUbicacion {
  const [estado, setEstado] = useState<EstadoUbicacion>(hayGeolocalizacion ? 'iniciando' : 'no-disponible');

  useEffect(() => {
    let ultima: GeolocationPosition | null = null;
    let enviando = false;

    const latir = () => {
      if (enviando || document.hidden) return;
      const c = ultima?.coords;
      // Una lectura loca del GPS fuera del estado la rechazaría el backend: ese latido va sin coordenadas
      const punto = c && dentroDeAguascalientes({ lat: c.latitude, lng: c.longitude })
        ? { latitud: c.latitude, longitud: c.longitude, precision: Math.round(c.accuracy) }
        : undefined;
      enviando = true;
      presenciaApi
        .latido(punto)
        .catch(() => { /* sin red o servidor caído: el siguiente latido lo intenta otra vez */ })
        .finally(() => { enviando = false; });
    };

    const idVigilancia = hayGeolocalizacion
      ? navigator.geolocation.watchPosition(
        (pos) => {
          ultima = pos;
          setEstado('compartiendo');
        },
        (err) => setEstado(err.code === err.PERMISSION_DENIED ? 'sin-permiso' : 'error'),
        { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
      )
      : undefined;

    latir(); // al montar (entró o recargó la página)
    const intervalo = window.setInterval(latir, LATIDO_MS);

    const alCambiarVisibilidad = () => {
      if (!document.hidden) latir();
      else presenciaApi.pausar().catch(() => { /* sin red: el backend lo pasa a inactivo a los 2 s */ });
    };
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    window.addEventListener('online', latir);

    // Al salir del layout (cerrar sesión) deja de latir
    return () => {
      if (idVigilancia !== undefined) navigator.geolocation.clearWatch(idVigilancia);
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      window.removeEventListener('online', latir);
    };
  }, []);

  return estado;
}
