/// Configuración por ambiente. Los valores llegan al compilar con:
///   flutter run --dart-define-from-file=config/dev.json
/// (nada de URLs escritas en el código).
class Config {
  Config._();

  /// URL base de la API. En el emulador, la PC es 10.0.2.2; en un celular, la IP de la PC.
  static const apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'https://10.0.2.2:8500/api/v1',
  );

  /// En debug, confiar en el certificado autofirmado de desarrollo (assets/dev/miaa-dev.pem).
  static const certDev = bool.fromEnvironment('CERT_DEV', defaultValue: true);

  /// Cada cuánto se avisa "sigo aquí" al backend (tarea 2.4). El backend da 60 s de margen.
  static const latidoSegundos = int.fromEnvironment('LATIDO_SEGUNDOS', defaultValue: 30);
}
