import 'dart:async';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:movil/core/capa_carga.dart';
import 'package:movil/core/carga.dart';

/// Servidor falso: contesta [status] cuando se complete [listo] (así se ve el "mientras tanto").
class _Adaptador implements HttpClientAdapter {
  _Adaptador(this.status);

  final int status;
  Future<void> listo = Future.value();

  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<Uint8List>? cuerpo, Future<void>? cancelar) async {
    await listo;
    return ResponseBody.fromString('{}', status, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    });
  }

  @override
  void close({bool force = false}) {}
}

Dio _dio(_Adaptador a) => Dio()
  ..httpClientAdapter = a
  ..interceptors.add(InterceptorCarga());

void main() {
  setUp(() => Carga.pendientes.value = 0);

  group('InterceptorCarga', () {
    test('cuenta la petición mientras espera y la descuenta al contestar', () async {
      final a = _Adaptador(200);
      final contestar = Completer<void>();
      a.listo = contestar.future;

      final peticion = _dio(a).get('/reportes/mios');
      await Future<void>.delayed(const Duration(milliseconds: 20)); // ya salió y espera al servidor
      expect(Carga.pendientes.value, 1);

      contestar.complete();
      await peticion;
      expect(Carga.pendientes.value, 0);
    });

    test('también la descuenta si el servidor falla', () async {
      await expectLater(_dio(_Adaptador(500)).get('/x'), throwsA(isA<DioException>()));
      expect(Carga.pendientes.value, 0);
    });

    test('las de fondo (latido, sincronización automática) no cuentan', () async {
      final a = _Adaptador(204);
      final contestar = Completer<void>();
      a.listo = contestar.future;

      final latido = _dio(a).post('/usuarios/heartbeat', options: Carga.oculta);
      await Future<void>.delayed(const Duration(milliseconds: 20)); // ya salió y espera al servidor
      expect(Carga.pendientes.value, 0);
      contestar.complete();
      await latido;
      expect(Carga.pendientes.value, 0);
    });

    test('Carga.durante cuenta aunque falle la tarea', () async {
      await expectLater(Carga.durante(() async => throw StateError('sin disco')), throwsStateError);
      expect(Carga.pendientes.value, 0);
    });
  });

  group('CapaCarga (la gota)', () {
    Future<void> abrir(WidgetTester t) => t.pumpWidget(MaterialApp(
          home: const Scaffold(body: Text('Inicio')),
          builder: (context, navegador) => CapaCarga(child: navegador!),
        ));

    testWidgets('no aparece si la respuesta es rápida', (t) async {
      await abrir(t);
      Carga.pendientes.value = 1;
      await t.pump(const Duration(milliseconds: 200));
      Carga.pendientes.value = 0;
      await t.pump(const Duration(milliseconds: 500));
      expect(find.byKey(CapaCarga.llave), findsNothing);
    });

    testWidgets('si tarda, aparece encima de la pantalla y se va al terminar', (t) async {
      await abrir(t);
      Carga.pendientes.value = 1;
      await t.pump(CapaCarga.retraso + const Duration(milliseconds: 50));
      expect(find.byKey(CapaCarga.llave), findsOneWidget);
      expect(find.text('Cargando…'), findsOneWidget);
      expect(find.text('Inicio'), findsOneWidget, reason: 'la pantalla sigue debajo, sin reconstruirse');

      await t.pump(const Duration(seconds: 2)); // se sigue llenando mientras espera
      expect(find.byKey(CapaCarga.llave), findsOneWidget);

      Carga.pendientes.value = 0;
      await t.pump(); // se llena…
      expect(find.byKey(CapaCarga.llave), findsOneWidget);
      await t.pump(const Duration(milliseconds: 400)); // …y se desvanece
      expect(find.byKey(CapaCarga.llave), findsNothing);
    });
  });
}
