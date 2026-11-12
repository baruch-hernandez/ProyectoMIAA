// Sprint 4 — tarea 3.1: el DAO de reportes_offline contra SQLite de verdad (sqflite_common_ffi):
// inserción, consulta por estado y cómo queda cada reporte después de una sincronización simulada.
//   flutter test test/s4_bd_local_dao_test.dart
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:movil/sincronizacion/bd_local.dart';
import 'package:movil/sincronizacion/reportes_offline_dao.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'apoyo/sync_falsos.dart';

ReporteOffline reporte(String uuid, {int usuarioId = 1, DateTime? fecha, String carpeta = '/x'}) => ReporteOffline(
      uuidCliente: uuid,
      usuarioId: usuarioId,
      descripcion: 'Fuga en la toma $uuid',
      latitud: 21.8818,
      longitud: -102.2916,
      precisionGps: 6.5,
      fotoPath: carpeta,
      fechaCapturaUtc: fecha ?? DateTime.utc(2026, 11, 11, 16),
      datos: {
        'calle': 'Madero',
        'fotos': [
          {'archivo': 'f1.jpg', 'fechaCaptura': '2026-11-11T15:59:00.000Z', 'origenFecha': 'OBTURADOR'},
        ],
      },
    );

void main() {
  late EntornoOffline entorno;
  late ReportesOfflineDao dao;

  setUp(() async {
    entorno = await EntornoOffline.crear();
    dao = ReportesOfflineDao(entorno.abrir());
  });

  test('la migración crea la tabla con las columnas del backlog', () async {
    final bd = await entorno.abrir();
    final columnas = (await bd.rawQuery('PRAGMA table_info(reportes_offline)')).map((c) => c['name']).toSet();
    expect(columnas, containsAll(['id', 'uuid_cliente', 'descripcion', 'latitud', 'longitud', 'precision_gps',
        'foto_path', 'fecha_captura_utc', 'sync_status', 'intentos']));
    expect(await bd.getVersion(), migraciones.length);
  });

  test('insertar y leer: regresa lo mismo, con sus metadatos', () async {
    await dao.insertar(reporte('a'));

    final leido = (await dao.buscar('a'))!;
    expect(leido.estado, EstadoSync.pendiente, reason: 'todo reporte nuevo entra PENDIENTE_SINCRONIZAR');
    expect(leido.intentos, 0);
    expect(leido.precisionGps, 6.5);
    expect(leido.fechaCapturaUtc, DateTime.utc(2026, 11, 11, 16));
    expect(leido.datos['calle'], 'Madero');
    expect((leido.datos['fotos'] as List).single['archivo'], 'f1.jpg');
  });

  test('el mismo uuid dos veces no duplica la fila', () async {
    await dao.insertar(reporte('a'));
    await dao.insertar(reporte('a'));
    expect(await dao.contar(1, EstadoSync.pendiente), 1);
  });

  test('consulta por estado: solo los del notificador, del más viejo al más nuevo, con límite', () async {
    await dao.insertar(reporte('nuevo', fecha: DateTime.utc(2026, 11, 11, 18)));
    await dao.insertar(reporte('viejo', fecha: DateTime.utc(2026, 11, 11, 9)));
    await dao.insertar(reporte('medio', fecha: DateTime.utc(2026, 11, 11, 12)));
    await dao.insertar(reporte('de-otro', usuarioId: 2));
    await dao.marcarRechazado('medio', 'Fuera del estado');

    final pendientes = await dao.porEstado(1, [EstadoSync.pendiente]);
    expect(pendientes.map((r) => r.uuidCliente), ['viejo', 'nuevo']);
    expect((await dao.porEstado(1, [EstadoSync.pendiente, EstadoSync.rechazado])).map((r) => r.uuidCliente),
        ['viejo', 'medio', 'nuevo']);
    expect((await dao.porEstado(1, [EstadoSync.pendiente], limite: 1)).single.uuidCliente, 'viejo');
    expect(await dao.contar(2, EstadoSync.pendiente), 1, reason: 'en un celular compartido no se mezclan');
  });

  test('un intento fallido suma y deja el error, sin dejar de estar pendiente', () async {
    await dao.insertar(reporte('a'));
    await dao.sumarIntento('a', 'Sin conexión');
    await dao.sumarIntento('a', 'Sin conexión');

    final r = (await dao.buscar('a'))!;
    expect(r.estado, EstadoSync.pendiente);
    expect(r.intentos, 2);
    expect(r.error, 'Sin conexión');
  });

  test('tras una sincronización simulada: el aceptado queda SINCRONIZADO sin fotos, el rechazado con su motivo',
      () async {
    final red = RedFalsa(conRed: true);
    final carpetaA = await entorno.fotos.guardar('a', {'f1.jpg': Uint8List.fromList([1, 2, 3])});
    final carpetaB = await entorno.fotos.guardar('b', {'f1.jpg': Uint8List.fromList([4, 5, 6])});
    await dao.insertar(reporte('a', carpeta: carpetaA));
    await dao.insertar(reporte('b', carpeta: carpetaB));
    final sync = entorno.sync(
      usuarioId: 1,
      red: red,
      bd: await entorno.abrir(),
      enviar: (reportes, archivos) async => {
        'sincronizados': [
          {'clientSyncId': 'a', 'id': 41, 'folio': 'R-2026-000041'},
        ],
        'rechazados': [
          {'clientSyncId': 'b', 'motivo': 'Revisa los datos', 'errores': {'latitud': 'Fuera del estado'}},
        ],
      },
    );
    addTearDown(sync.dispose);

    await sync.sincronizar();

    final a = (await dao.buscar('a'))!;
    expect(a.estado, EstadoSync.sincronizado);
    expect(a.folio, 'R-2026-000041');
    expect(await Directory(carpetaA).exists(), isFalse, reason: 'ya están en el servidor: se libera espacio');
    final b = (await dao.buscar('b'))!;
    expect(b.estado, EstadoSync.rechazado);
    expect(b.error, 'Fuera del estado');
    expect(await Directory(carpetaB).exists(), isTrue, reason: 'el rechazado conserva sus fotos');
    expect(sync.pendientes, 0);
    expect(sync.enCola.map((r) => r.uuidCliente), ['b'], reason: 'el rechazado sigue a la vista');
  });

  test('una foto perdida: ese queda rechazado con SU motivo y los demás salen en la misma vuelta', () async {
    final red = RedFalsa(conRed: true);
    final servidor = ServidorFalso(red);
    // El de la foto perdida es el más viejo: va en el 1.er lote junto con otros 4; el 6.º va en el 2.º
    await dao.insertar(reporte('perdida', carpeta: '${entorno.carpeta.path}/no-existe', fecha: DateTime.utc(2026, 11, 11, 8)));
    for (var i = 0; i < 6; i++) {
      final carpeta = await entorno.fotos.guardar('r$i', {'f1.jpg': Uint8List.fromList([i])});
      await dao.insertar(reporte('r$i', carpeta: carpeta, fecha: DateTime.utc(2026, 11, 11, 9 + i)));
    }
    final sync = entorno.sync(usuarioId: 1, red: red, bd: await entorno.abrir(), enviar: servidor.enviar);
    addTearDown(sync.dispose);

    await sync.sincronizar();

    expect(servidor.recibidos.keys.toSet(), {for (var i = 0; i < 6; i++) 'r$i'}, reason: 'no se corta tras el 1.er lote');
    final perdida = (await dao.buscar('perdida'))!;
    expect(perdida.estado, EstadoSync.rechazado);
    expect(perdida.error, startsWith('Se perdió una foto'), reason: 'no lo pisa otro mensaje');
    expect(perdida.intentos, 0);
  });

  test('"Reintentar" vuelve a mandar un rechazado', () async {
    final red = RedFalsa(conRed: true);
    final servidor = ServidorFalso(red);
    final carpeta = await entorno.fotos.guardar('a', {'f1.jpg': Uint8List.fromList([1])});
    await dao.insertar(reporte('a', carpeta: carpeta));
    await dao.marcarRechazado('a', 'La hora de captura está en el futuro');
    final sync = entorno.sync(usuarioId: 1, red: red, bd: await entorno.abrir(), enviar: servidor.enviar);
    addTearDown(sync.dispose);

    await sync.reintentar((await dao.buscar('a'))!);

    expect(servidor.recibidos.keys, ['a']);
    expect((await dao.buscar('a'))!.estado, EstadoSync.sincronizado);
  });

  test('al cerrar y volver a abrir la base, los reportes siguen ahí', () async {
    await dao.insertar(reporte('a'));
    await entorno.cerrar();
    final otraVez = await abrirBdLocal(fabrica: databaseFactoryFfiNoIsolate, ruta: entorno.rutaBd);
    addTearDown(otraVez.close);
    expect(await ReportesOfflineDao(Future.value(otraVez)).contar(1, EstadoSync.pendiente), 1);
  });
}
