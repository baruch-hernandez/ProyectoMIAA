/// Texto del aviso de privacidad que acepta cada notificador la primera vez que entra.
///
/// Es COPIA de frontend/src/utils/avisoPrivacidad.ts: si cambia el texto, cambia los dos y sube
/// la versión aquí, en la web y en application.properties (miaa.aviso-privacidad.version).
/// Si la versión de la app no es la del backend, este responde 409 y se muestra su mensaje.
library;

/// Debe ser IGUAL a miaa.aviso-privacidad.version del backend.
const versionAviso = '2026-10';

/// Mientras sea true, se muestra una nota de "borrador" (para que nadie lo olvide).
const avisoEsBorrador = true;

const avisoPrivacidad = <(String, List<String>)>[
  (
    '¿Quién es responsable de tus datos?',
    [
      'El Modelo Integral de Aguas de Aguascalientes, Organismo Público Descentralizado del Municipio de Aguascalientes, en lo sucesivo MIAA, con domicilio en el ala sur del Centro de Atención Municipal (CAM) del municipio de Aguascalientes, en Avenida López Mateos 214, zona centro de la ciudad de Aguascalientes, Ags.; es responsable del tratamiento de los datos personales que se recaban a través de esta aplicación.',
    ],
  ),
  (
    '¿Qué datos recabamos?',
    [
      'Tu nombre, usuario y correo de trabajo, y la fecha y hora en que inicias sesión.',
      'Tu ubicación (GPS) mientras tienes la aplicación abierta y la sesión iniciada.',
      'Las fotografías que tomas como evidencia, con su fecha y hora de captura, y la ubicación de los domicilios que reportas.',
    ],
  ),
  (
    '¿Para qué los usamos?',
    [
      'Para registrar y verificar los reportes de domicilios, coordinar el trabajo de campo y controlar el acceso a la aplicación.',
    ],
  ),
  (
    'Sobre tu ubicación',
    [
      'Solo se comparte mientras la aplicación está abierta y con tu sesión iniciada; siempre verás un indicador "GPS" cuando esté activa.',
      'Se guarda únicamente tu última ubicación, sin historial de recorridos. Deja de compartirse al cerrar sesión.',
      'Solo la puede consultar el personal administrador autorizado de MIAA.',
    ],
  ),
  (
    '¿Con quién los compartimos?',
    ['No se comparten con terceros, salvo que lo requiera una autoridad competente conforme a la ley.'],
  ),
  (
    'Tus derechos',
    [
      'Puedes solicitar el acceso, la rectificación, la cancelación o la oposición al uso de tus datos (derechos ARCO) escribiendo a [correo o área responsable de MIAA].',
    ],
  ),
  (
    'Cambios a este aviso',
    ['Si este aviso cambia, la aplicación te pedirá leerlo y aceptarlo de nuevo.'],
  ),
];
