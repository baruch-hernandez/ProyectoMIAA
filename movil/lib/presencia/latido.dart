import 'dart:async';

import 'package:flutter/foundation.dart';

import '../core/api.dart';
import '../core/config.dart';

/// Tarea 2.4: "sigo aquí" al backend cada 30 s → el admin ve al notificador "En línea".
/// Si la app se va al fondo, se detiene (como WhatsApp); al volver, avisa de inmediato.
class Latido extends ChangeNotifier {
  Latido(this._api);

  final Api _api;
  Timer? _timer;
  bool _enviando = false;
  bool _cerrado = false;

  DateTime? ultimoOk;
  String? ultimoError;
  int enviados = 0;

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
    } catch (e) {
      ultimoError = ApiError.de(e).mensaje; // sin red: se reintenta en el siguiente latido
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
