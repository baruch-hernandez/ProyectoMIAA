// Sprint 4: red, servidor y base SQLite de prueba para la bandeja de salida.
import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:movil/sincronizacion/almacen_fotos_offline.dart';
import 'package:movil/sincronizacion/bd_local.dart';
import 'package:movil/sincronizacion/reportes_offline_dao.dart';
import 'package:movil/sincronizacion/servicio_conectividad.dart';
import 'package:movil/sincronizacion/sync_manager.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

/// El "modo avión": [poner] cambia la red y avisa como lo haría connectivity_plus.
class RedFalsa implements ServicioConectividad {
  RedFalsa({this.conRed = true});

  bool conRed;
  final _cambios = StreamController<bool>.broadcast();

  void poner(bool valor) {
    conRed = valor;
    _cambios.add(valor);
  }

  @override
  Stream<bool> get cambios => _cambios.stream;

  @override
  Future<bool> hayRed() async => conRed;
}

/// POST /reportes/sync simulado, idempotente como el de verdad (por clientSyncId).
class ServidorFalso {
  ServidorFalso(this.red);

  final RedFalsa red;

  /// clientSyncId → metadatos recibidos (una sola vez cada uno).
  final recibidos = <String, Map<String, dynamic>>{};

  /// nombre de parte → bytes de la foto tal como llegaron.
  final fotos = <String, Uint8List>{};
  int peticiones = 0;

  /// Si se pone, en esa petición (1, 2…) guarda todo pero la respuesta "se pierde" y se va la red.
  int? cortarEnLaPeticion;

  Future<Map<String, dynamic>> enviar(List<Map<String, dynamic>> reportes, Map<String, Uint8List> archivos) async {
    peticiones++;
    if (!red.conRed) throw _sinRed();
    for (final r in reportes) {
      recibidos.putIfAbsent(r['clientSyncId'] as String, () => r);
    }
    fotos.addAll(archivos);
    if (peticiones == cortarEnLaPeticion) {
      red.poner(false);
      throw _sinRed();
    }
    return {
      'sincronizados': [
        for (final r in reportes)
          {'clientSyncId': r['clientSyncId'], 'id': recibidos.keys.toList().indexOf(r['clientSyncId'] as String) + 1, 'folio': 'R-2026-X'},
      ],
      'rechazados': <Object>[],
    };
  }

  static DioException _sinRed() =>
      DioException(requestOptions: RequestOptions(path: '/reportes/sync'), type: DioExceptionType.connectionError);
}

/// Carpeta temporal + SQLite real (en la PC, sin isolate: corre igual dentro de testWidgets).
class EntornoOffline {
  EntornoOffline._(this.carpeta, this.rutaBd);

  final Directory carpeta;
  final String rutaBd;
  Database? _bd;

  static Future<EntornoOffline> crear() async {
    sqfliteFfiInit();
    final carpeta = await Directory.systemTemp.createTemp('miaa_s4_');
    final e = EntornoOffline._(carpeta, '${carpeta.path}${Platform.pathSeparator}miaa_local.db');
    addTearDown(e.borrar);
    return e;
  }

  /// "Abrir la app": la base del mismo archivo de siempre.
  Future<Database> abrir() async => _bd = await abrirBdLocal(fabrica: databaseFactoryFfiNoIsolate, ruta: rutaBd);

  /// "Cerrar la app".
  Future<void> cerrar() async {
    await _bd?.close();
    _bd = null;
  }

  AlmacenFotosOffline get fotos => AlmacenFotosOffline(carpetaBase: () async => carpeta);

  SyncManager sync({required int usuarioId, required RedFalsa red, required EnviarLote enviar, Database? bd}) =>
      SyncManager(
        usuarioId: usuarioId,
        dao: ReportesOfflineDao(Future.value(bd ?? _bd!)),
        fotos: fotos,
        red: red,
        enviarLote: enviar,
      );

  Future<void> borrar() async {
    await cerrar();
    if (await carpeta.exists()) await carpeta.delete(recursive: true);
  }
}
