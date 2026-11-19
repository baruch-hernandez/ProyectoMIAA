import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

import '../core/api.dart';
import '../core/carga.dart';
import '../core/config.dart';
import '../permisos/servicio_permisos.dart';
import '../ubicacion/fuente_gps.dart';
import '../ubicacion/limite_ags.dart';
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
/// Sprint 5 (tarea 2.1): UNA petición por latido, POST /heartbeat. Para cuidar los datos
/// móviles, las coordenadas solo van cuando sirven: al moverse [metrosParaReenviar] o más, o cada
/// [reenviarCada] si sigue en el mismo lugar; los demás latidos van sin cuerpo. Las lecturas fuera
/// del estado (saltos del GPS) ni se mandan: el backend las rechaza.
class Latido extends ChangeNotifier {
  Latido(this._api, {this.gps});

  final Api _api;

  /// null = no manda ubicación (solo "sigo aquí").
  final EscucharGps? gps;

  static const metrosParaReenviar = 5.0;
  static const reenviarCada = Duration(seconds: 30);

  Timer? _timer;
  StreamSubscription<LecturaGps>? _lecturas;
  LecturaGps? _ultimaLectura;
  LecturaGps? _ultimaEnviada;
  DateTime? _enviadaEn;
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
    _ultimaEnviada = null; // y la primera lectura de la siguiente vez sí se manda
  }

  /// La app se pausó (pantalla apagada, al fondo): deja de latir y sale inactivo al instante.
  /// Si no hay red, el backend lo da por inactivo solo a los 2 s sin latido.
  Future<void> pausar() async {
    detener();
    try {
      await _api.dio.delete('/yo/conexion', options: Carga.oculta).timeout(const Duration(seconds: 2));
    } catch (_) {}
  }

  /// Si el GPS no está escuchando (sin permiso todavía, o se cortó), lo intenta de nuevo.
  /// Así, en cuanto el notificador da el permiso (p. ej. en su primera foto), empieza a compartir.
  void _escucharGps() {
    final abrir = gps;
    if (abrir == null || _lecturas != null || _timer == null) return;
    _lecturas = abrir().where((l) => dentroDeAguascalientes(l.lat, l.lng)).listen(
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
    final conPunto = l != null && _hayQueMandar(l);
    try {
      await _api.dio.post('/heartbeat',
          data: conPunto ? {'latitud': l.lat, 'longitud': l.lng, 'precision': l.precision} : null,
          options: Carga.oculta); // 204; de fondo: sin gota de carga
      if (conPunto) {
        _ultimaEnviada = l;
        _enviadaEn = ultimaUbicacion = DateTime.now();
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

  bool _hayQueMandar(LecturaGps l) {
    final antes = _ultimaEnviada;
    return antes == null ||
        DateTime.now().difference(_enviadaEn!) >= reenviarCada ||
        Geolocator.distanceBetween(antes.lat, antes.lng, l.lat, l.lng) >= metrosParaReenviar;
  }

  @override
  void dispose() {
    _cerrado = true;
    detener();
    super.dispose();
  }
}
