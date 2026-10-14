// Texto del aviso de privacidad que acepta cada LECTURISTA la primera vez que entra.
//
// ⚠️ BORRADOR: lo debe revisar y completar el área jurídica de MIAA. Cambia los textos
// entre [corchetes]. Cuando el texto cambie, sube también la VERSIÓN aquí Y en
// application.properties (miaa.aviso-privacidad.version): así todos lo vuelven a aceptar.

/** Debe ser IGUAL a miaa.aviso-privacidad.version del backend. */
export const VERSION_AVISO = '2026-10';

/** Mientras sea true, se muestra una nota de "borrador" (para que nadie lo olvide). */
export const AVISO_ES_BORRADOR = true;

export interface SeccionAviso {
  titulo: string;
  parrafos: string[];
}

export const AVISO_PRIVACIDAD: SeccionAviso[] = [
  {
    titulo: '¿Quién es responsable de tus datos?',
    parrafos: [
      '[Razón social de MIAA], con domicilio en [domicilio de MIAA], es responsable del tratamiento de los datos personales que se recaban a través de esta aplicación.',
    ],
  },
  {
    titulo: '¿Qué datos recabamos?',
    parrafos: [
      'Tu nombre, usuario y correo de trabajo, y la fecha y hora en que inicias sesión.',
      'Tu ubicación (GPS) mientras tienes la aplicación abierta y la sesión iniciada.',
      'Las fotografías que tomas como evidencia, con su fecha y hora de captura, y la ubicación de los domicilios que reportas.',
    ],
  },
  {
    titulo: '¿Para qué los usamos?',
    parrafos: [
      'Para registrar y verificar los reportes de domicilios, coordinar el trabajo de campo y controlar el acceso a la aplicación.',
    ],
  },
  {
    titulo: 'Sobre tu ubicación',
    parrafos: [
      'Solo se comparte mientras la aplicación está abierta y con tu sesión iniciada; siempre verás un indicador "GPS" cuando esté activa.',
      'Se guarda únicamente tu última ubicación, sin historial de recorridos. Deja de compartirse al cerrar sesión.',
      'Solo la puede consultar el personal administrador autorizado de MIAA.',
    ],
  },
  {
    titulo: '¿Con quién los compartimos?',
    parrafos: [
      '[MIAA debe confirmarlo.] No se comparten con terceros, salvo que lo requiera una autoridad competente conforme a la ley.',
    ],
  },
  {
    titulo: 'Tus derechos',
    parrafos: [
      'Puedes solicitar el acceso, la rectificación, la cancelación o la oposición al uso de tus datos (derechos ARCO) escribiendo a [correo o área responsable de MIAA].',
    ],
  },
  {
    titulo: 'Cambios a este aviso',
    parrafos: ['Si este aviso cambia, la aplicación te pedirá leerlo y aceptarlo de nuevo.'],
  },
];
