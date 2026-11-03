import 'dart:io' show HttpDate;

/// Tarea 2.2: la hora del SERVIDOR, para que mover el reloj del celular a mano no cambie la
/// hora de las fotos. Cada respuesta de la API trae el encabezado HTTP "Date"; con él se mide
/// cuánto está adelantado o atrasado el celular y se corrige.
///
/// shortcut: si alguien mueve el reloj DESPUÉS de la última respuesta, la corrección vale hasta
/// la siguiente (el latido llega cada 30 s). Con un reloj monótono nativo se cerraría ese hueco.
class RelojServidor {
  RelojServidor._();

  /// "Date" solo trae segundos y la red tarda: diferencias menores no son un reloj movido.
  static const tolerancia = Duration(seconds: 2);

  static Duration? _desfase;

  /// servidor − celular. null = todavía no contesta el servidor (sin red desde que se abrió).
  static Duration? get desfase => _desfase;

  /// Lee el encabezado "Date" de una respuesta. Si no viene o está mal, no cambia nada.
  static void registrar(String? fechaHttp, {DateTime? ahora}) {
    if (fechaHttp == null) return;
    final DateTime servidor;
    try {
      // "Date" corta los milisegundos: a la mitad del segundo está el error más chico
      servidor = HttpDate.parse(fechaHttp).add(const Duration(milliseconds: 500));
    } on Exception {
      return;
    }
    final d = servidor.difference(ahora ?? DateTime.now());
    _desfase = d.abs() < tolerancia ? Duration.zero : d;
  }

  /// La hora confiable (UTC): la del celular corregida con el último desfase medido.
  static DateTime ahora() => DateTime.now().toUtc().add(_desfase ?? Duration.zero);

  /// Para las pruebas.
  static void olvidar() => _desfase = null;
}
