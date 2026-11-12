// Sprint 4 — tarea 3.4: prueba de estrés de reconexión. 10 reportes hechos sin red se suben en
// ráfaga mientras la red va y viene (y una respuesta se pierde a medio camino):
//   - llegan los 10, cada uno UNA vez;
//   - cada foto llega idéntica byte por byte;
//   - consumo de red: lotes de 5 (no 10 peticiones), y nada se intenta mientras no hay red.
//   flutter test test/s4_rafaga_reconexion_test.dart
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:movil/fotos/foto_evidencia.dart';
import 'package:movil/fotos/procesador_fotos.dart';
import 'package:movil/reportes/almacen_borrador.dart';
import 'package:movil/reportes/borrador_reporte.dart';
import 'package:movil/sincronizacion/reportes_offline_dao.dart';
import 'package:movil/ubicacion/ubicacion.dart';

import 'apoyo/sync_falsos.dart';

/// Un JPEG "distinto" por reporte (los bytes solo tienen que ser únicos y comparables).
Uint8List bytesFoto(int semilla) {
  final azar = Random(semilla);
  return Uint8List.fromList(List.generate(200 * 1024, (_) => azar.nextInt(256)));
}

Future<BorradorReporte> borradorListo(int i) async {
  final b = BorradorReporte.nuevo(AlmacenBorradorEnMemoria())
    ..ponerCampo(CampoReporte.calle, 'Madero')
    ..ponerCampo(CampoReporte.numeroExterior, '$i')
    ..ponerCampo(CampoReporte.colonia, 'Centro')
    ..ponerCampo(CampoReporte.codigoPostal, '20000')
    ..ponerCampo(CampoReporte.tipoPredio, 'HABITACIONAL')
    ..ponerCampo(CampoReporte.descripcion, 'Reporte sin conexión número $i')
    ..ponerUbicacion(Ubicacion(lat: 21.88 + i / 1000, lng: -102.29, precision: 5, fuente: FuenteUbicacion.gps));
  await b.agregarFoto(
    FotoProcesada(
      bytes: bytesFoto(i),
      ancho: 1600,
      alto: 1200,
      fechaCaptura: DateTime.utc(2026, 11, 11, 10, i),
      origenFecha: OrigenFechaFoto.obturador,
    ),
    OrigenFoto.camara,
  );
  return b;
}

void main() {
  test('10 reportes offline, red intermitente y una respuesta perdida: llegan 10, una vez, intactos', () async {
    final entorno = await EntornoOffline.crear();
    await entorno.abrir();
    final red = RedFalsa(conRed: false); // modo avión
    final servidor = ServidorFalso(red)..cortarEnLaPeticion = 2;
    final sync = entorno.sync(usuarioId: 1, red: red, enviar: servidor.enviar);
    addTearDown(sync.dispose);
    await sync.iniciar();

    // 1) Sin red se llenan 10 reportes: todos quedan en el celular, sin una sola petición
    final originales = <String, Uint8List>{};
    for (var i = 0; i < 10; i++) {
      final b = await borradorListo(i);
      originales[b.clienteId] = b.fotos.single.bytes;
      expect((await sync.guardarYEnviar(b)).estado, EstadoSync.pendiente);
    }
    expect(sync.pendientes, 10);
    expect(servidor.peticiones, 0, reason: 'sin red ni se intenta');

    // 2) Vuelve la red: sale el 1.er lote; en el 2.º el servidor lo guarda pero la red se cae
    //    antes de la respuesta → el celular no sabe si llegó y los deja pendientes
    red.poner(true);
    await Future<void>.delayed(Duration.zero);
    await sync.sincronizar();
    expect(servidor.peticiones, 2);
    expect(sync.pendientes, 5);
    expect(servidor.recibidos, hasLength(10), reason: 'el servidor sí alcanzó a guardar el 2.º lote');

    // 3) Mientras no hay red, el reloj de reintentos no gasta peticiones
    await sync.sincronizar();
    expect(servidor.peticiones, 2);

    // 4) Vuelve la red: se reenvía el 2.º lote y el servidor no lo duplica
    red.poner(true);
    await Future<void>.delayed(Duration.zero);
    await sync.sincronizar();

    expect(servidor.peticiones, 3, reason: '10 reportes en 3 peticiones (1 repetida por el corte), no 10+');
    expect(servidor.recibidos.keys.toSet(), originales.keys.toSet(), reason: 'los 10, ni uno más');
    expect(sync.pendientes, 0);
    expect(sync.enCola, isEmpty);
    for (final MapEntry(key: uuid, value: bytes) in originales.entries) {
      expect(servidor.fotos['$uuid-0'], bytes, reason: 'la foto de $uuid llegó idéntica');
      final r = (await sync.dao.buscar(uuid))!;
      expect(r.estado, EstadoSync.sincronizado);
      expect(await Directory(r.fotoPath).exists(), isFalse, reason: 'ya se liberó el espacio');
    }
    final reintentados = [for (final u in originales.keys) (await sync.dao.buscar(u))!.intentos].where((n) => n > 0);
    expect(reintentados, hasLength(5), reason: 'solo el lote cortado cuenta un intento fallido');
  });
}
