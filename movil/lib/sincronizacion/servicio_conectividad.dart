import 'package:connectivity_plus/connectivity_plus.dart';

/// Sprint 4 (tarea 2.3): ¿hay red? y aviso cuando cambia (sin red ⇄ con red).
///
/// Ojo: dice si el celular tiene wifi o datos, no si el servidor contesta (un wifi sin internet
/// cuenta como "con red"). Por eso SyncManager también reintenta cada minuto mientras haya pendientes.
abstract class ServicioConectividad {
  /// true = volvió la red, false = se perdió. Solo cuando cambia.
  Stream<bool> get cambios;

  Future<bool> hayRed();
}

class ServicioConectividadDispositivo implements ServicioConectividad {
  ServicioConectividadDispositivo([Connectivity? conectividad]) : _c = conectividad ?? Connectivity();

  final Connectivity _c;

  @override
  Stream<bool> get cambios => _c.onConnectivityChanged.map(_conRed).distinct();

  @override
  Future<bool> hayRed() async => _conRed(await _c.checkConnectivity());

  static bool _conRed(List<ConnectivityResult> tipos) => tipos.any((t) => t != ConnectivityResult.none);
}
