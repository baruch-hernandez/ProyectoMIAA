import 'dart:io' show HttpDate;

import 'plataforma.dart';

/// Tarea 2.2: la hora del SERVIDOR, para que mover el reloj del celular a mano no cambie la
/// hora de las fotos. Cada respuesta de la API trae el encabezado HTTP "Date"; con él se mide
/// cuánto está adelantado o atrasado el celular y se corrige.
///
/// Entre una respuesta y otra, o sin red, la hora avanza con el contador de arranque del celular,
/// que mover el reloj no cambia. Se reinicia al apagar el celular, pero eso también borra esta
/// memoria: la hora queda como no verificada hasta que conteste el servidor.
class RelojServidor {
  RelojServidor._();

  /// "Date" solo trae segundos y la red tarda: diferencias menores no son un reloj movido.
  static const tolerancia = Duration(seconds: 2);

  static Duration? _desfase;

  /// Hora del servidor − contador de arranque, en ms. null = fuera de Android.
  static int? _baseMs;

  /// servidor − celular. null = todavía no contesta el servidor (sin red desde que se abrió).
  static Duration? get desfase => _desfase;

  /// Lee el encabezado "Date" de una respuesta. Si no viene o está mal, no cambia nada.
  static void registrar(String? fechaHttp, {DateTime? ahora, int? arranqueMs}) {
    if (fechaHttp == null) return;
    final DateTime servidor;
    try {
      // "Date" corta los milisegundos: a la mitad del segundo está el error más chico
      servidor = HttpDate.parse(fechaHttp).add(const Duration(milliseconds: 500));
    } on Exception {
      return;
    }
    final celular = ahora ?? DateTime.now();
    final d = servidor.difference(celular);
    _desfase = d.abs() < tolerancia ? Duration.zero : d;
    _baseMs = arranqueMs == null ? null : celular.add(_desfase!).millisecondsSinceEpoch - arranqueMs;
  }

  /// [registrar] con el contador de arranque del momento (lo que usa cada respuesta de la API).
  static Future<void> registrarRespuesta(String? fechaHttp) async {
    if (fechaHttp != null) registrar(fechaHttp, arranqueMs: await Plataforma.arranqueMs());
  }

  /// La hora confiable (UTC). Con [arranqueMs] no depende del reloj del celular; sin él, es la del
  /// celular corregida con el último desfase medido.
  static DateTime ahora({int? arranqueMs}) => _baseMs != null && arranqueMs != null
      ? DateTime.fromMillisecondsSinceEpoch(_baseMs! + arranqueMs, isUtc: true)
      : DateTime.now().toUtc().add(_desfase ?? Duration.zero);

  /// Cuánto se aleja [hora] del reloj del celular. null = nunca se pudo verificar con el servidor.
  static Duration? desfaseDe(DateTime hora, {DateTime? celular}) {
    if (_desfase == null) return null;
    final d = hora.difference(celular ?? DateTime.now());
    return d.abs() < tolerancia ? Duration.zero : d;
  }

  /// Para las pruebas.
  static void olvidar() {
    _desfase = null;
    _baseMs = null;
  }
}
