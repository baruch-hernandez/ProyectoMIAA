import 'dart:async';

import 'package:flutter/foundation.dart';

import '../core/api.dart';
import '../core/config.dart';
import '../permisos/servicio_permisos.dart';
import '../ubicacion/fuente_gps.dart';
import '../ubicacion/ubicacion.dart';

/// Abre las lecturas del GPS para el mapa del admin (vacías si no se puede).
typedef EscucharGps = Stream<LecturaGps> Function();

/// Lecturas del GPS SOLO si ya hay permiso y la ubicación está prendida: el latido nunca
/// muestra diálogos (el permiso se pide al tomar la primera foto o al tocar «Mi ubicación»).
Stream<LecturaGps> lecturasSiHayPermiso({
  ServicioPermisos permisos = const ServicioPermisosAndroid(),
  FuenteGps gps = const FuenteGpsDispositivo(),
}) async* {
  if (!(await permisos.consultar(TipoPermiso.ubicacion)).permitido) return;
  if (!await gps.servicioActivo()) return;
  yield* gps.lecturas();
}

/// Tarea 2.4: "sigo aquí" al backend cada segundo → el admin ve al notificador "Activo".
/// Con la pantalla apagada o la app al fondo se detiene y avisa que se pausó (sale inactivo al
/// instante); al volver, late de inmediato.
///
/// UNA petición por latido (datos móviles y batería): con lectura del GPS manda POST /ubicacion,
/// que el backend también cuenta como latido; sin lectura, POST /usuarios/yo/conexion.
class Latido extends ChangeNotifier {
  Latido(this._api, {this.gps});

  final Api _api;

  /// null = no manda ubicación (solo "sigo aquí").
  final EscucharGps? gps;

  Timer? _timer;
  StreamSubscription<LecturaGps>? _lecturas;
  LecturaGps? _ultimaLectura;
  bool _enviando = false;
  bool _cerrado = false;

  DateTime? ultimoOk;
  String? ultimoError;
  int enviados = 0;

  /// Cuándo llegó al servidor la última ubicación (null = todavía ninguna).
  DateTime? ultimaUbicacion;

  /// true mientras el admin está recibiendo la ubicación: lo muestra BarraUbicacion en todas las
  /// pantallas (el aviso de privacidad promete un indicador "GPS"). Es global porque la barra
  /// vive arriba de todas las pantallas y el latido solo dentro de Inicio.
  static final compartiendo = ValueNotifier<bool>(false);

  bool get activo => _timer != null;

  void iniciar() {
    detener();
    _timer = Timer.periodic(const Duration(seconds: Config.latidoSegundos), (_) => latir());
    _escucharGps(); // ya, no hasta el 10.º latido: al volver a la app el mapa lo muestra enseguida
    latir();
    notifyListeners();
  }

  void detener() {
    compartiendo.value = false;
    _timer?.cancel();
    _timer = null;
    _lecturas?.cancel();
    _lecturas = null;
    _ultimaLectura = null; // al volver, no se manda un punto viejo como si fuera de ahora
  }

  /// La app se pausó (pantalla apagada, al fondo): deja de latir y sale inactivo al instante.
  /// Si no hay red, el backend lo da por inactivo solo a los 2 s sin latido.
  Future<void> pausar() async {
    detener();
    try {
      await _api.dio.delete('/usuarios/yo/conexion').timeout(const Duration(seconds: 2));
    } catch (_) {}
  }

  /// Si el GPS no está escuchando (sin permiso todavía, o se cortó), lo intenta de nuevo.
  /// Así, en cuanto el notificador da el permiso (p. ej. en su primera foto), empieza a compartir.
  void _escucharGps() {
    final abrir = gps;
    if (abrir == null || _lecturas != null || _timer == null) return;
    _lecturas = abrir().listen(
      (l) => _ultimaLectura = l,
      onError: (Object _) {},
      onDone: () => _lecturas = null,
    );
  }

  Future<void> latir() async {
    if (_enviando || _cerrado) return;
    _enviando = true;
    if (enviados % 10 == 0) _escucharGps(); // reintento cada ~10 s, no en cada latido
    final l = _ultimaLectura;
    try {
      if (l == null) {
        await _api.dio.post('/usuarios/yo/conexion'); // 204 sin cuerpo
      } else {
        await _api.dio.post('/ubicacion', data: {
          'latitud': l.lat,
          'longitud': l.lng,
          'precision': l.precision,
          'fecha': DateTime.now().toUtc().toIso8601String(),
        });
        ultimaUbicacion = DateTime.now();
      }
      ultimoOk = DateTime.now();
      ultimoError = null;
      enviados++;
      compartiendo.value = l != null && _timer != null; // si se pausó mientras tanto, ya no se comparte
    } catch (e) {
      ultimoError = ApiError.de(e).mensaje; // sin red: se reintenta en el siguiente latido
      compartiendo.value = false;
    } finally {
      _enviando = false;
      // La pantalla pudo cerrarse mientras esperábamos la respuesta (p. ej. al cerrar sesión)
      if (!_cerrado) notifyListeners();
    }
  }

  @override
  void dispose() {
    _cerrado = true;
    detener();
    super.dispose();
  }
}
