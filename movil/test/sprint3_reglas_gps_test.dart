import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';

import 'package:movil/fotos/foto_evidencia.dart';
import 'package:movil/ubicacion/reglas_gps.dart';
import 'package:movil/ubicacion/ubicacion.dart';

void main() {
  group('3.1 Reglas de precisión GPS y semáforo', () {
    test('motivoParaEsperar bloquea la captura si el error es > 1.0 m', () {
      const lecturaImprecisa = LecturaGps(lat: 21.8853, lng: -102.2916, precision: 2.5);

      final motivo = motivoParaEsperar(
        lecturaImprecisa,
        edad: Duration.zero,
        esperando: const Duration(seconds: 3),
      );

      expect(motivo, isNotNull);
      expect(motivo, contains('Afinando el GPS: ±2.5 m'));
      expect(motivo, contains('meta ±1 m'));
    });

    test('motivoParaEsperar habilita la captura cuando la precisión es <= 1.0 m', () {
      const lecturaOptima = LecturaGps(lat: 21.8853, lng: -102.2916, precision: 0.8);

      final motivo = motivoParaEsperar(
        lecturaOptima,
        edad: Duration.zero,
        esperando: const Duration(seconds: 3),
      );

      expect(motivo, isNull);
    });

    test('bloqueoDeHardware detecta GPS apagado, aproximado y ahorro de batería', () {
      expect(
        bloqueoDeHardware(gpsApagado: true, aproximada: false, ahorro: false),
        contains('La ubicación del celular está apagada'),
      );
      expect(
        bloqueoDeHardware(gpsApagado: false, aproximada: true, ahorro: false),
        contains('«Usar ubicación precisa»'),
      );
      expect(
        bloqueoDeHardware(gpsApagado: false, aproximada: false, ahorro: true),
        contains('Apaga el ahorro de batería'),
      );
      expect(
        bloqueoDeHardware(gpsApagado: false, aproximada: false, ahorro: false),
        isNull,
      );
    });

    test('semaforoDe clasifica en verde (<=1m), amarillo (1-5m) y rojo (>5m)', () {
      expect(semaforoDe(0.8), Semaforo.verde);
      expect(semaforoDe(1.0), Semaforo.verde);
      expect(semaforoDe(3.0), Semaforo.amarillo);
      expect(semaforoDe(5.0), Semaforo.amarillo);
      expect(semaforoDe(6.2), Semaforo.rojo);
    });
  });

  group('3.2 Inmutabilidad y formato UTC en FotoEvidencia', () {
    test('Serializa metadatos atómicos y timestamp en formato ISO 8601 UTC', () {
      final fechaFijada = DateTime.utc(2026, 11, 6, 15, 30, 0);
      const gps = LecturaGps(lat: 21.88123456, lng: -102.28123456, precision: 0.9);

      final foto = FotoEvidencia(
        id: 'foto-test-001',
        ruta: '/data/user/0/mx.gob.miaa.movil/cache/prueba.jpg',
        bytes: Uint8List.fromList([10, 20, 30, 40]),
        ancho: 1920,
        alto: 1080,
        origen: OrigenFoto.camara,
        fechaCaptura: fechaFijada,
        origenFecha: OrigenFechaFoto.obturador,
        fechaAdjunta: fechaFijada,
        gps: gps,
        desfaseRelojMs: 12,
      );

      final json = foto.aJson();

      expect(json['id'], 'foto-test-001');
      expect(json['ancho'], 1920);
      expect(json['alto'], 1080);
      expect(json['peso'], 4);

      final origenMeta = json['origen_fecha_foto'] as Map<String, dynamic>;
      expect(origenMeta['origen_foto'], 'CAMARA');
      expect(origenMeta['origen_fecha'], 'OBTURADOR');
      expect(origenMeta['fecha_captura'], '2026-11-06T15:30:00.000Z');
      expect(origenMeta['desfase_reloj_ms'], 12);

      final gpsMeta = json['gps'] as Map<String, dynamic>;
      expect(gpsMeta['lat'], 21.88123456);
      expect(gpsMeta['lng'], -102.28123456);
      expect(gpsMeta['precision'], 0.9);
    });
  });
}