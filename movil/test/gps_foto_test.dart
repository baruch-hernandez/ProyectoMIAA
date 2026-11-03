// Historia 3 (Sprint 3): punto GPS y hora fidedigna de cada foto de la cámara.
//   flutter test test/gps_foto_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:movil/core/reloj.dart';
import 'package:movil/fotos/foto_evidencia.dart';
import 'package:movil/fotos/pantalla_vista_previa.dart';
import 'package:movil/fotos/procesador_fotos.dart';
import 'package:movil/reportes/almacen_borrador.dart';
import 'package:movil/reportes/borrador_reporte.dart';
import 'package:movil/ubicacion/reglas_gps.dart';
import 'package:movil/ubicacion/ubicacion.dart';

import 'apoyo/falsos.dart';

const _plaza = LecturaGps(lat: 21.8823400, lng: -102.2958100, precision: 0.8); // Plaza de la Patria

LecturaGps _con(double precision) => LecturaGps(lat: _plaza.lat, lng: _plaza.lng, precision: precision);

void main() {
  group('semáforo (3.1)', () {
    test('verde ≤ 1 m, amarillo hasta 5 m, rojo más', () {
      expect(semaforoDe(1.0), Semaforo.verde);
      expect(semaforoDe(1.01), Semaforo.amarillo);
      expect(semaforoDe(5.0), Semaforo.amarillo);
      expect(semaforoDe(5.1), Semaforo.rojo);
    });
  });

  group('obturador (1.3 / 3.2)', () {
    String? motivo(LecturaGps? l, {int edad = 0, int esperando = 0}) =>
        motivoParaEsperar(l, edad: Duration(seconds: edad), esperando: Duration(seconds: esperando));

    test('sin lectura, o con una vieja, no se dispara', () {
      expect(motivo(null), isNotNull);
      expect(motivo(_plaza, edad: 6), contains('Se perdió'));
    });

    test('con ±1 m se dispara de inmediato', () {
      expect(motivo(_con(1.0)), isNull);
    });

    test('±3 m: se espera; al cumplirse la espera máxima, se acepta lo mejor del hardware', () {
      expect(motivo(_con(3), esperando: 10), allOf(contains('±3.0 m'), contains('en 20 s')));
      expect(motivo(_con(3), esperando: ReglasGps.esperaMaxima.inSeconds), isNull);
      expect(lecturaParaFoto(_con(3), edad: Duration.zero)!.precision, 3);
    });

    test('interior sin señal: pasada la espera se toma igual, pero sin coordenadas', () {
      expect(motivo(null, esperando: 10), contains('en 20 s'));
      expect(motivo(null, esperando: 30), isNull);
      expect(lecturaParaFoto(null, edad: Duration.zero), isNull);
    });

    test('más de ±20 m o una lectura vieja no se graban con la foto', () {
      expect(motivo(_con(25), esperando: 120), isNull);
      expect(lecturaParaFoto(_con(25), edad: Duration.zero), isNull);
      expect(lecturaParaFoto(_plaza, edad: const Duration(seconds: 6)), isNull);
    });

    test('un punto preciso fuera de Aguascalientes no se acepta, ni esperando', () {
      const cdmx = LecturaGps(lat: 19.4326, lng: -99.1332, precision: 0.5);
      expect(motivo(cdmx), contains('fuera'));
      expect(motivo(cdmx, esperando: 120), contains('fuera'));
    });
  });

  group('EXIF y hora del disparo (2.1 / 2.4)', () {
    final disparo = DateTime.utc(2026, 11, 3, 18, 4, 5);

    FotoProcesada procesar({LecturaGps? gps}) => procesarFoto(EntradaFoto(
          // El EXIF de la cámara dice otra hora (reloj del celular movido): manda el disparo
          bytes: jpgDePrueba(1600, 1200, fechaExif: '2026:11:03 08:00:00', zona: '-06:00'),
          momentoSeleccion: disparo,
          ahora: disparo,
          momentoObturador: disparo,
          gps: gps,
          desfaseRelojMs: 3600000,
        ));

    test('la hora registrada es la del disparo, no la del EXIF que escribió la cámara', () {
      final r = procesar(gps: _plaza);
      expect(r.fechaCaptura, disparo);
      expect(r.origenFecha, OrigenFechaFoto.archivo);
      expect(r.desfaseRelojMs, 3600000);
    });

    test('el punto, la precisión y la hora quedan grabados en los bytes del JPG', () {
      final exif = img.decodeJpgExif(procesar(gps: _plaza).bytes)!;
      final g = exif.gpsIfd;
      double grados(int tag) => g[tag]!.toDouble(0) + g[tag]!.toDouble(1) / 60 + g[tag]!.toDouble(2) / 3600;

      expect(g[0x0001].toString(), 'N');
      expect(g[0x0003].toString(), 'W');
      expect(grados(0x0002), closeTo(_plaza.lat, 1e-7));
      expect(-grados(0x0004), closeTo(_plaza.lng, 1e-7));
      expect(g[0x001F]!.toDouble(), closeTo(0.8, 1e-9));
      expect(leerFechaExif(exif), disparo);
    });
  });

  group('reloj del servidor (2.2)', () {
    tearDown(RelojServidor.olvidar);

    test('sin respuesta del servidor no hay desfase y la hora es la del celular', () {
      expect(RelojServidor.desfase, isNull);
      expect(RelojServidor.ahora().difference(DateTime.now().toUtc()).inSeconds.abs(), lessThan(2));
    });

    test('un celular atrasado 1 h se corrige con el encabezado Date', () {
      RelojServidor.registrar('Tue, 03 Nov 2026 18:00:00 GMT', ahora: DateTime.utc(2026, 11, 3, 17, 0, 0));
      expect(RelojServidor.desfase!.inMinutes, 60);
      expect(RelojServidor.ahora().difference(DateTime.now().toUtc()).inMinutes, 60);
    });

    test('un segundo de diferencia es la red, no un reloj movido', () {
      RelojServidor.registrar('Tue, 03 Nov 2026 18:00:00 GMT', ahora: DateTime.utc(2026, 11, 3, 17, 59, 59));
      expect(RelojServidor.desfase, Duration.zero);
    });

    test('un encabezado roto no cambia nada', () {
      RelojServidor.registrar('ayer');
      expect(RelojServidor.desfase, isNull);
    });
  });

  test('borrador: la foto guarda su punto y hora en un solo bloque y los manda al backend (2.3)', () async {
    final almacen = AlmacenBorradorEnMemoria();
    final b = BorradorReporte.nuevo(almacen);
    await b.agregarFoto(
      FotoProcesada(
        bytes: pngDePrueba(),
        ancho: 1920,
        alto: 1080,
        fechaCaptura: DateTime.utc(2026, 11, 3, 18, 4, 5),
        origenFecha: OrigenFechaFoto.archivo,
        gps: _plaza,
        desfaseRelojMs: -120000,
      ),
      OrigenFoto.camara,
    );

    final reabierto = await BorradorReporte.cargar(almacen);
    final foto = reabierto.fotos.single;
    expect(foto.gps!.lat, _plaza.lat);
    expect(foto.gps!.precision, 0.8);
    expect(foto.desfaseRelojMs, -120000);

    final enviada = (reabierto.aSolicitud()['fotos'] as List).single as Map;
    expect(enviada['latitud'], _plaza.lat);
    expect(enviada['longitud'], _plaza.lng);
    expect(enviada['precisionGps'], 0.8);
    expect(enviada['desfaseRelojMs'], -120000);
    expect(enviada['fechaCaptura'], '2026-11-03T18:04:05.000Z');
  });

  testWidgets('vista previa: tarjeta con lat, lng, margen de error y hora UTC (3.3)', (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: PantallaVistaPrevia(
        foto: FotoProcesada(
          bytes: pngDePrueba(),
          ancho: 1920,
          alto: 1080,
          fechaCaptura: DateTime.utc(2026, 11, 3, 18, 4, 5),
          origenFecha: OrigenFechaFoto.archivo,
          gps: _plaza,
          desfaseRelojMs: 0,
        ),
        origen: OrigenFoto.camara,
      ),
    ));
    expect(find.byKey(PantallaVistaPrevia.llaveTarjetaGps), findsOneWidget);
    expect(find.textContaining('Lat 21.8823400'), findsOneWidget);
    expect(find.text('Margen de error: ±0.8 m'), findsOneWidget);
    expect(find.textContaining('18:04:05 UTC'), findsOneWidget);
    expect(find.text('Hora verificada con el servidor.'), findsOneWidget);
  });

  test('origen de la hora, en palabras', () {
    expect(origenDeLaHora(null), contains('no se pudo verificar'));
    expect(origenDeLaHora(3 * 60000), contains('3 min atrasado'));
    expect(origenDeLaHora(-30000), contains('30 s adelantado'));
  });
}
