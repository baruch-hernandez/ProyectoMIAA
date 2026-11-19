import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:movil/core/api.dart';
import 'package:movil/permisos/servicio_permisos.dart';
import 'package:movil/presencia/latido.dart';
import 'package:movil/ubicacion/ubicacion.dart';

import 'apoyo/falsos.dart';

/// El latido manda la ubicación al mapa del admin SOLO si ya hay permiso y GPS, sin preguntar nada,
/// y solo mientras la sesión está abierta.
void main() {
  const punto = LecturaGps(lat: 21.88, lng: -102.29, precision: 8);

  test('con permiso y GPS prendido entrega las lecturas', () async {
    final lecturas = await lecturasSiHayPermiso(
      permisos: PermisosFalsos(estado: EstadoPermiso.concedido),
      gps: FuenteGpsFalsa(lecturas: [punto, punto]),
    ).toList();
    expect(lecturas, hasLength(2));
    expect(lecturas.first.lat, 21.88);
  });

  test('sin permiso no lee el GPS ni muestra el diálogo', () async {
    final permisos = PermisosFalsos();
    final lecturas = await lecturasSiHayPermiso(permisos: permisos, gps: FuenteGpsFalsa(lecturas: [punto])).toList();
    expect(lecturas, isEmpty);
    expect(permisos.solicitudes, 0);
  });

  /// Api con un servidor falso que responde 204 y anota cada petición: "POST /ruta" + si llevó coordenadas.
  Future<(Api, List<String>)> apiFalsa() async {
    final rutas = <String>[];
    final api = await Api.crear(token: () => 't', alExpirar: (_) {});
    api.dio.interceptors.add(InterceptorsWrapper(onRequest: (o, h) {
      rutas.add('${o.method} ${o.path}${o.data == null ? '' : ' +gps'}');
      h.resolve(Response(requestOptions: o, statusCode: 204));
    }));
    return (api, rutas);
  }

  test('Sprint 5: un latido por segundo a /heartbeat; las coordenadas solo si cambiaron', () async {
    final (api, rutas) = await apiFalsa();
    final latido = Latido(api, gps: () => Stream.value(punto));
    addTearDown(latido.dispose);

    latido.iniciar(); // 1.er latido: el GPS todavía no da lectura
    await pumpEventQueue();
    await latido.latir(); // ya hay lectura: va con coordenadas
    await latido.latir(); // mismo lugar, hace menos de 30 s: sin coordenadas (ahorra datos)

    expect(rutas, ['POST /heartbeat', 'POST /heartbeat +gps', 'POST /heartbeat']);
    expect(Latido.compartiendo.value, isTrue);
    expect(latido.ultimaUbicacion, isNotNull);
  });

  test('una lectura fuera de Aguascalientes no se manda (el backend la rechazaría)', () async {
    final (api, rutas) = await apiFalsa();
    final latido = Latido(api, gps: () => Stream.value(const LecturaGps(lat: 19.43, lng: -99.13, precision: 5))); // CDMX
    addTearDown(latido.dispose);

    latido.iniciar();
    await pumpEventQueue();
    await latido.latir();

    expect(rutas, ['POST /heartbeat', 'POST /heartbeat']);
  });

  test('tarea 2.2: al cerrar sesión (detener) ya no sale ningún latido ni ubicación', () async {
    final (api, rutas) = await apiFalsa();
    final latido = Latido(api, gps: () => Stream.value(punto));
    addTearDown(latido.dispose);
    latido.iniciar();
    await pumpEventQueue();
    await latido.latir();
    expect(Latido.compartiendo.value, isTrue);

    latido.detener(); // PantallaInicio._salir lo llama antes de POST /auth/logout
    final antes = rutas.length;
    await Future<void>.delayed(const Duration(milliseconds: 1500)); // más que un latido

    expect(rutas.length, antes);
    expect(latido.activo, isFalse);
    expect(Latido.compartiendo.value, isFalse, reason: 'se apaga el indicador GPS');
  });

  test('con la ubicación del celular apagada no entrega nada', () async {
    final lecturas = await lecturasSiHayPermiso(
      permisos: PermisosFalsos(estado: EstadoPermiso.concedido),
      gps: FuenteGpsFalsa(lecturas: [punto], activo: false),
    ).toList();
    expect(lecturas, isEmpty);
  });
}
