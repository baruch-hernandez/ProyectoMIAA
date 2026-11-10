import 'dart:async';

import 'package:flutter/foundation.dart';

import '../core/api.dart';
import '../core/config.dart';
import '../permisos/servicio_permisos.dart';
import '../ubicacion/fuente_gps.dart';
import '../ubicacion/ubicacion.dart';

/// Lee dónde está el celular, o null si no se puede (sin permiso, GPS apagado, sin señal).
typedef LeerPosicion = Future<LecturaGps?> Function();

/// Una lectura del GPS SOLO si ya hay permiso y la ubicación está prendida: el latido nunca
/// muestra diálogos (el permiso se pide al tomar la primera foto o al tocar «Mi ubicación»).
Future<LecturaGps?> posicionSiHayPermiso({
  ServicioPermisos permisos = const ServicioPermisosAndroid(),
  FuenteGps gps = const FuenteGpsDispositivo(),
}) async {
  try {
    if (!(await permisos.consultar(TipoPermiso.ubicacion)).permitido) return null;
    if (!await gps.servicioActivo()) return null;
    return await gps.lecturas().first.timeout(const Duration(seconds: 15));
  } catch (_) {
    return null; // sin señal a tiempo: se intenta en el siguiente latido
  }
}

/// Tarea 2.4: "sigo aquí" al backend cada 30 s → el admin ve al notificador "Activo".
/// Con la pantalla apagada o la app al fondo se detiene y pasa a inactivo; al volver, avisa de inmediato.
/// En cada latido también manda la ubicación (POST /ubicacion) para el mapa del admin.
class Latido extends ChangeNotifier {
  Latido(this._api, {this.posicion});

  final Api _api;

  /// null = no manda ubicación (solo "sigo aquí").
  final LeerPosicion? posicion;
  Timer? _timer;
  bool _enviando = false;
  bool _cerrado = false;

  DateTime? ultimoOk;
  String? ultimoError;
  int enviados = 0;

  /// Cuándo llegó al servidor la última ubicación (null = todavía ninguna).
  DateTime? ultimaUbicacion;

  bool get activo => _timer != null;

  void iniciar() {
    detener();
    latir();
    _timer = Timer.periodic(const Duration(seconds: Config.latidoSegundos), (_) => latir());
    notifyListeners();
  }

  void detener() {
    _timer?.cancel();
    _timer = null;
  }

  Future<void> latir() async {
    if (_enviando || _cerrado) return;
    _enviando = true;
    try {
      await _api.dio.post('/usuarios/yo/conexion'); // 204 sin cuerpo
      ultimoOk = DateTime.now();
      ultimoError = null;
      enviados++;
      await _mandarUbicacion();
    } catch (e) {
      ultimoError = ApiError.de(e).mensaje; // sin red: se reintenta en el siguiente latido
    } finally {
      _enviando = false;
      // La pantalla pudo cerrarse mientras esperábamos la respuesta (p. ej. al cerrar sesión)
      if (!_cerrado) notifyListeners();
    }
  }

  Future<void> _mandarUbicacion() async {
    final leer = posicion;
    if (leer == null) return;
    final l = await leer();
    // Si mientras leía el GPS la app se fue al fondo o cerró sesión, ya no se manda
    if (l == null || _cerrado || _timer == null) return;
    try {
      await _api.dio.post('/ubicacion', data: {
        'latitud': l.lat,
        'longitud': l.lng,
        'precision': l.precision,
        'fecha': DateTime.now().toUtc().toIso8601String(),
      });
      ultimaUbicacion = DateTime.now();
    } catch (_) {
      // sin red: el admin lo verá "sin conexión" con el último punto
    }
  }

  @override
  void dispose() {
    _cerrado = true;
    detener();
    super.dispose();
  }
}
