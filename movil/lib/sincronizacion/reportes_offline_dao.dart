import 'dart:convert';

import 'package:sqflite/sqflite.dart';

/// En qué va un reporte de la bandeja de salida.
enum EstadoSync {
  pendiente('PENDIENTE_SINCRONIZAR'),
  sincronizado('SINCRONIZADO'),

  /// El backend no lo aceptó (p. ej. fuera del estado): no se reintenta solo.
  rechazado('RECHAZADO');

  const EstadoSync(this.clave);

  final String clave;

  static EstadoSync desdeClave(String clave) => values.firstWhere((e) => e.clave == clave);
}

/// Una fila de reportes_offline.
class ReporteOffline {
  const ReporteOffline({
    required this.uuidCliente,
    required this.usuarioId,
    required this.descripcion,
    required this.latitud,
    required this.longitud,
    required this.fotoPath,
    required this.fechaCapturaUtc,
    required this.datos,
    this.precisionGps,
    this.estado = EstadoSync.pendiente,
    this.intentos = 0,
    this.error,
    this.folio,
  });

  final String uuidCliente;
  final int usuarioId;
  final String descripcion;
  final double latitud;
  final double longitud;
  final double? precisionGps;
  final String fotoPath;
  final DateTime fechaCapturaUtc;
  final EstadoSync estado;
  final int intentos;

  /// Lo demás del reporte (domicilio, predio) y "fotos": [{archivo, fechaCaptura, origenFecha…}].
  final Map<String, dynamic> datos;
  final String? error;
  final String? folio;

  Map<String, Object?> aFila() => {
        'uuid_cliente': uuidCliente,
        'usuario_id': usuarioId,
        'descripcion': descripcion,
        'latitud': latitud,
        'longitud': longitud,
        'precision_gps': precisionGps,
        'foto_path': fotoPath,
        'fecha_captura_utc': fechaCapturaUtc.toUtc().toIso8601String(),
        'sync_status': estado.clave,
        'intentos': intentos,
        'datos': jsonEncode(datos),
        'error': error,
        'folio': folio,
      };

  factory ReporteOffline.deFila(Map<String, Object?> f) => ReporteOffline(
        uuidCliente: f['uuid_cliente'] as String,
        usuarioId: f['usuario_id'] as int,
        descripcion: f['descripcion'] as String,
        latitud: (f['latitud'] as num).toDouble(),
        longitud: (f['longitud'] as num).toDouble(),
        precisionGps: (f['precision_gps'] as num?)?.toDouble(),
        fotoPath: f['foto_path'] as String,
        fechaCapturaUtc: DateTime.parse(f['fecha_captura_utc'] as String),
        estado: EstadoSync.desdeClave(f['sync_status'] as String),
        intentos: f['intentos'] as int,
        datos: (jsonDecode(f['datos'] as String) as Map).cast<String, dynamic>(),
        error: f['error'] as String?,
        folio: f['folio'] as String?,
      );
}

/// Sprint 4 (tarea 2.1): leer y escribir la bandeja de salida. Todo filtra por notificador.
class ReportesOfflineDao {
  ReportesOfflineDao(this._bd);

  final Future<Database> _bd;
  static const _tabla = 'reportes_offline';

  /// Mismo uuid otra vez (p. ej. no se alcanzó a limpiar el borrador): se reemplaza, no se duplica.
  Future<void> insertar(ReporteOffline r) async =>
      (await _bd).insert(_tabla, r.aFila(), conflictAlgorithm: ConflictAlgorithm.replace);

  Future<ReporteOffline?> buscar(String uuid) async {
    final filas = await (await _bd).query(_tabla, where: 'uuid_cliente = ?', whereArgs: [uuid]);
    return filas.isEmpty ? null : ReporteOffline.deFila(filas.single);
  }

  /// Del más viejo al más nuevo: se mandan en el orden en que se hicieron.
  Future<List<ReporteOffline>> porEstado(int usuarioId, List<EstadoSync> estados, {int? limite}) async {
    final filas = await (await _bd).query(
      _tabla,
      where: 'usuario_id = ? AND sync_status IN (${List.filled(estados.length, '?').join(', ')})',
      whereArgs: [usuarioId, ...estados.map((e) => e.clave)],
      orderBy: 'fecha_captura_utc, id',
      limit: limite,
    );
    return filas.map(ReporteOffline.deFila).toList();
  }

  Future<int> contar(int usuarioId, EstadoSync estado) async => Sqflite.firstIntValue(await (await _bd).rawQuery(
        'SELECT COUNT(*) FROM $_tabla WHERE usuario_id = ? AND sync_status = ?',
        [usuarioId, estado.clave],
      ))!;

  Future<void> marcarSincronizado(String uuid, {String? folio}) =>
      _cambiar(uuid, {'sync_status': EstadoSync.sincronizado.clave, 'folio': folio, 'error': null});

  Future<void> marcarRechazado(String uuid, String motivo) =>
      _cambiar(uuid, {'sync_status': EstadoSync.rechazado.clave, 'error': motivo});

  /// Un rechazado vuelve a PENDIENTE_SINCRONIZAR (el notificador tocó "Reintentar").
  Future<void> reintentar(String uuid) =>
      _cambiar(uuid, {'sync_status': EstadoSync.pendiente.clave, 'error': null});

  /// No se pudo mandar (sin red, servidor caído): sigue pendiente.
  Future<void> sumarIntento(String uuid, String error) async => (await _bd).rawUpdate(
        'UPDATE $_tabla SET intentos = intentos + 1, error = ? WHERE uuid_cliente = ?',
        [error, uuid],
      );

  Future<void> borrar(String uuid) async => (await _bd).delete(_tabla, where: 'uuid_cliente = ?', whereArgs: [uuid]);

  Future<void> _cambiar(String uuid, Map<String, Object?> valores) async =>
      (await _bd).update(_tabla, valores, where: 'uuid_cliente = ?', whereArgs: [uuid]);
}
