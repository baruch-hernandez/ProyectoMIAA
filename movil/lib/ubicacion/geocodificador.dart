import 'package:dio/dio.dart';

import '../core/config.dart';
import 'direccion_gps.dart';

/// Lo que regresa la búsqueda de dirección de un punto.
sealed class ResultadoGeocodificacion {
  const ResultadoGeocodificacion();
}

class DireccionEncontrada extends ResultadoGeocodificacion {
  const DireccionEncontrada(this.direccion);

  final DireccionGps direccion;
}

/// El punto cae donde no hay calles (un baldío, el campo…).
class SinDireccion extends ResultadoGeocodificacion {
  const SinDireccion();
}

class FueraDeAgs extends ResultadoGeocodificacion {
  const FueraDeAgs();
}

/// Coordenadas → dirección. Interfaz para poder simularla en las pruebas.
abstract class Geocodificador {
  Future<ResultadoGeocodificacion> direccionDe(double lat, double lng);
}

/// Geocodificación inversa con Nominatim (OpenStreetMap), igual que la web
/// (frontend/src/services/geocodificacion.ts).
///
/// Nominatim es gratis y sin llave, pero con reglas: máximo 1 petición por segundo, identificarse
/// con User-Agent y nada de uso masivo. Para producción en MIAA conviene un servidor propio
/// (GEOCODER_URL en config/*.json) o pasar por el backend.
///
/// OJO: es un Dio APARTE del de la API: así nunca se le manda el token JWT a un servidor externo,
/// y usa los certificados normales del sistema (no el fijado del backend de desarrollo).
class GeocodificadorNominatim implements Geocodificador {
  GeocodificadorNominatim({Dio? dio})
      : _dio = dio ??
            Dio(BaseOptions(
              baseUrl: Config.geocoderUrl,
              connectTimeout: const Duration(seconds: 8),
              receiveTimeout: const Duration(seconds: 8),
              headers: {'User-Agent': 'MIAA-Notificador/1.0 (mx.gob.miaa.movil)'},
            ));

  final Dio _dio;

  /// Si mueven el mapa y regresan al mismo lugar, no se vuelve a pedir (~1 m de precisión).
  final _cache = <String, ResultadoGeocodificacion>{};
  DateTime? _ultima;

  @override
  Future<ResultadoGeocodificacion> direccionDe(double lat, double lng) async {
    final llave = '${lat.toStringAsFixed(5)},${lng.toStringAsFixed(5)}';
    final guardado = _cache[llave];
    if (guardado != null) return guardado;

    // Máximo 1 petición por segundo. El turno se aparta ANTES de esperar: así dos llamadas
    // encimadas no leen la misma hora y salen juntas.
    final ahora = DateTime.now();
    final ultima = _ultima;
    final turno = ultima == null || ahora.difference(ultima) >= const Duration(seconds: 1)
        ? ahora
        : ultima.add(const Duration(seconds: 1));
    _ultima = turno;
    final espera = turno.difference(ahora);
    if (espera > Duration.zero) await Future<void>.delayed(espera);

    final respuesta = await _dio.get<dynamic>('/reverse', queryParameters: {
      'format': 'jsonv2',
      'lat': lat.toStringAsFixed(6),
      'lon': lng.toStringAsFixed(6),
      'zoom': '18', // nivel "edificio": trae calle y número si existen
      'addressdetails': '1',
      'accept-language': 'es',
    });

    final datos = respuesta.data;
    final ResultadoGeocodificacion resultado;
    final direccion = datos is Map ? datos['address'] : null;
    if (datos is! Map || datos['error'] != null || direccion is! Map) {
      resultado = const SinDireccion();
    } else {
      final a = direccion.cast<String, dynamic>();
      resultado = estaEnAguascalientes(a) ? DireccionEncontrada(interpretarDireccion(a)) : const FueraDeAgs();
    }
    _cache[llave] = resultado;
    return resultado;
  }
}
