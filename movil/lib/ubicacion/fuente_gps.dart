import 'package:geolocator/geolocator.dart';

import 'ubicacion.dart';

/// El GPS del celular. Interfaz para poder simularlo en las pruebas.
abstract class FuenteGps {
  /// ¿Está prendida la ubicación del celular (el switch de "Ubicación")?
  Future<bool> servicioActivo();

  /// Abre los ajustes de ubicación del sistema (para prender el switch).
  Future<bool> abrirAjustesUbicacion();

  /// false si el usuario dio solo "Ubicación aproximada" (Android 12+): ±1–3 km, no sirve.
  Future<bool> esPrecisa();

  /// Lecturas del GPS mientras se escuchen.
  Stream<LecturaGps> lecturas();
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
  Stream<LecturaGps> lecturas() => Geolocator.getPositionStream(
        locationSettings: AndroidSettings(
          accuracy: LocationAccuracy.best,
          distanceFilter: 0,
          intervalDuration: const Duration(seconds: 1),
        ),
      ).map((p) => LecturaGps(lat: p.latitude, lng: p.longitude, precision: p.accuracy));
}
