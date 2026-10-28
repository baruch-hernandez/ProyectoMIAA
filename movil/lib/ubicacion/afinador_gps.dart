import 'dart:async';

import 'ubicacion.dart';

/// Cómo terminó el afinado.
enum FinAfinado { objetivo, tiempo, manual, sinLecturas }

/// "Afinar" la ubicación, igual que afinarGps.ts de la web: en vez de quedarse con la PRIMERA
/// lectura (que suele venir de wifi o antenas, con ±50–500 m), se escuchan varias lecturas
/// unos segundos y se queda la más precisa. Se detiene sola al llegar a ±[objetivo] m o al
/// [limite] de tiempo. No sabe nada de plugins: recibe un Stream, así se prueba fácil.
class AfinadorGps {
  AfinadorGps({this.objetivo = 15, this.limite = const Duration(seconds: 20)});

  /// Con esta precisión (m) o mejor, ya no se espera más.
  final double objetivo;
  final Duration limite;

  StreamSubscription<LecturaGps>? _sub;
  Timer? _reloj;
  Completer<({LecturaGps? mejor, FinAfinado fin})>? _termino;
  LecturaGps? _mejor;

  LecturaGps? get mejor => _mejor;
  bool get activo => _termino != null && !_termino!.isCompleted;

  /// Empieza a escuchar. [alMejorar] se llama con cada lectura MÁS precisa que las anteriores.
  /// El Future termina con la mejor lectura (o null si no llegó ninguna).
  /// Si el stream falla antes de dar cualquier lectura, el Future falla con ese error.
  Future<({LecturaGps? mejor, FinAfinado fin})> afinar(
    Stream<LecturaGps> lecturas, {
    void Function(LecturaGps lectura)? alMejorar,
  }) {
    cancelar();
    _mejor = null;
    final termino = Completer<({LecturaGps? mejor, FinAfinado fin})>();
    _termino = termino;

    _reloj = Timer(limite, () => _terminar(FinAfinado.tiempo));
    _sub = lecturas.listen(
      (l) {
        if (!activo || !esMasPrecisa(l.precision, _mejor?.precision)) return;
        _mejor = l;
        alMejorar?.call(l);
        if (l.precision <= objetivo) _terminar(FinAfinado.objetivo);
      },
      onError: (Object e, StackTrace st) {
        if (!activo) return;
        // Con alguna lectura ya en mano, un error suelto no importa: se usa la mejor.
        if (_mejor != null) {
          _terminar(FinAfinado.manual);
        } else {
          _limpiar();
          termino.completeError(e, st);
        }
      },
      onDone: () => _terminar(_mejor == null ? FinAfinado.sinLecturas : FinAfinado.manual),
    );
    return termino.future;
  }

  /// "Usar este punto": termina ya con la mejor lectura hasta ahora.
  void terminar() => _terminar(FinAfinado.manual);

  /// Lo abandona sin resultado (p. ej. se salió de la pantalla o movió el mapa a mano).
  void cancelar() {
    final t = _termino;
    _limpiar();
    if (t != null && !t.isCompleted) t.complete((mejor: null, fin: FinAfinado.manual));
  }

  void _terminar(FinAfinado fin) {
    final t = _termino;
    if (t == null || t.isCompleted) return;
    _limpiar();
    t.complete((mejor: _mejor, fin: _mejor == null ? FinAfinado.sinLecturas : fin));
  }

  void _limpiar() {
    _reloj?.cancel();
    _reloj = null;
    unawaited(_sub?.cancel());
    _sub = null;
  }
}

/// ¿La nueva precisión es mejor que la que hay? (metros: menos es mejor)
bool esMasPrecisa(double nueva, double? actual) =>
    nueva.isFinite && nueva > 0 && (actual == null || nueva < actual);
