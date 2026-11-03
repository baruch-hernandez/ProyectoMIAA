import 'package:geolocator/geolocator.dart';

import '../core/plataforma.dart';
import 'ubicacion.dart';

/// El GPS del celular. Interfaz para poder simularlo en las pruebas.
abstract class FuenteGps {
  /// ¿Está prendida la ubicación del celular (el switch de "Ubicación")?
  Future<bool> servicioActivo();

  /// Abre los ajustes de ubicación del sistema (para prender el switch).
  Future<bool> abrirAjustesUbicacion();

  /// false si el usuario dio solo "Ubicación aproximada" (Android 12+): ±1–3 km, no sirve.
  Future<bool> esPrecisa();

  /// ¿Está prendido el "Ahorro de batería"? Android puede espaciar o apagar el GPS (tarea 1.4).
  Future<bool> ahorroEnergia();

  /// Lecturas del GPS mientras se escuchen. Con [satelital] solo el chip GPS (sin wifi ni
  /// antenas): tarda más en el primer punto, pero es el que se usa para la foto de evidencia.
  Stream<LecturaGps> lecturas({bool satelital = false});
}

/// Implementación real con geolocator (FusedLocationProvider de Google en Android).
/// El permiso se pide ANTES con ServicioPermisos (TipoPermiso.ubicacion).
class FuenteGpsDispositivo implements FuenteGps {
  const FuenteGpsDispositivo();

  @override
  Future<bool> servicioActivo() => Geolocator.isLocationServiceEnabled();

  @override
  Future<bool> abrirAjustesUbicacion() => Geolocator.openLocationSettings();

  @override
  Future<bool> esPrecisa() async {
    try {
      return await Geolocator.getLocationAccuracy() == LocationAccuracyStatus.precise;
    } catch (_) {
      return true; // si no se puede saber, no se molesta al usuario
    }
  }

  @override
  Future<bool> ahorroEnergia() => Plataforma.ahorroEnergia();

  /// Tarea 1.2: bestForNavigation. Con [satelital], LocationManager de Android en vez del
  /// FusedLocationProvider de Google, que mezcla wifi y antenas.
  @override
  Stream<LecturaGps> lecturas({bool satelital = false}) => Geolocator.getPositionStream(
        locationSettings: AndroidSettings(
          accuracy: LocationAccuracy.bestForNavigation,
          distanceFilter: 0,
          intervalDuration: const Duration(seconds: 1),
          forceLocationManager: satelital,
        ),
      ).map((p) => LecturaGps(lat: p.latitude, lng: p.longitude, precision: p.accuracy));
}
