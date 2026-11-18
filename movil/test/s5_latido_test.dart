// Sprint 5 — QA 3.2: Payload exacto del latido (latitud, longitud, precision) y flujo de logout.
//   flutter test test/s5_latido_test.dart
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:movil/auth/sesion.dart';
import 'package:movil/core/api.dart';
import 'package:movil/presencia/latido.dart';
import 'package:movil/ubicacion/ubicacion.dart';

void main() {
  const puntoAgs = LecturaGps(lat: 21.88, lng: -102.29, precision: 8);

  tearDown(() => Latido.compartiendo.value = false);

  test('3.2 El payload incluye latitud, longitud y precision con sesión activa y va vacío en el arranque', () async {
    final peticiones = <({String path, Object? data})>[];
    final api = await Api.crear(token: () => 'token-qa', alExpirar: (_) {});
    api.dio.interceptors.add(InterceptorsWrapper(onRequest: (o, h) {
      peticiones.add((path: o.path, data: o.data));
      h.resolve(Response(requestOptions: o, statusCode: 204));
    }));

    final latido = Latido(api, gps: () => Stream.value(puntoAgs));
    addTearDown(latido.dispose);

    // 1. Primer latido inmediato al iniciar (aún sin lectura de stream) -> va sin data
    latido.iniciar();
    await pumpEventQueue();

    expect(peticiones, hasLength(1));
    expect(peticiones.first.path, '/usuarios/heartbeat');
    expect(peticiones.first.data, isNull);

    // 2. El stream GPS ya entregó puntoAgs y late -> manda el mapa exacto con coordenadas
    await latido.latir();

    expect(peticiones, hasLength(2));
    expect(peticiones[1].path, '/usuarios/heartbeat');
    expect(peticiones[1].data, {'latitud': 21.88, 'longitud': -102.29, 'precision': 8.0});
    expect(Latido.compartiendo.value, isTrue);
  });

  test('3.2 Deja de emitir peticiones tras detener() en el flujo de logout', () async {
    var conteo = 0;
    final api = await Api.crear(token: () => 'token-qa', alExpirar: (_) {});
    api.dio.interceptors.add(InterceptorsWrapper(onRequest: (o, h) {
      conteo++;
      h.resolve(Response(requestOptions: o, statusCode: 204));
    }));

    final latido = Latido(api, gps: () => Stream.value(puntoAgs));
    addTearDown(latido.dispose);

    latido.iniciar();
    await pumpEventQueue();
    await latido.latir();
    expect(Latido.compartiendo.value, isTrue);

    // PantallaInicio._salir() ejecuta latido.detener() antes de sesion.salir()
    latido.detener();
    final totalAlDetener = conteo;

    await Future<void>.delayed(const Duration(milliseconds: 1500));

    expect(conteo, totalAlDetener, reason: 'No debe salir ningún latido tras detener');
    expect(latido.activo, isFalse);
    expect(Latido.compartiendo.value, isFalse);
  });

  test('3.2 Sesion.salir() llama a POST /auth/logout y limpia el estado de sesión', () async {
    FlutterSecureStorage.setMockInitialValues({
      'token': 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjQ5OTk5OTk5OTl9.firma',
      'usuario': '{"id":1,"username":"notificador1","role":"NOTIFICADOR","nombre":"Notificador 1"}',
    });

    final sesion = await Sesion.iniciar();
    expect(sesion.conSesion, isTrue);

    final llamadas = <String>[];
    sesion.api.dio.interceptors.add(InterceptorsWrapper(onRequest: (o, h) {
      llamadas.add('${o.method} ${o.path}');
      h.resolve(Response(requestOptions: o, statusCode: 204));
    }));

    await sesion.salir();

    expect(llamadas, ['POST /auth/logout']);
    expect(sesion.conSesion, isFalse);
    expect(sesion.usuario, isNull);
  });
}