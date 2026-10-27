// Tareas 3.1 y 3.4: compresión/resolución de las fotos y hora de captura (EXIF → ARCHIVO → SUBIDA).
//   flutter test test/procesador_fotos_test.dart
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:movil/fotos/foto_evidencia.dart';
import 'package:movil/fotos/procesador_fotos.dart';

import 'apoyo/falsos.dart';

final _ahora = DateTime.utc(2026, 10, 27, 19, 0);

EntradaFoto _entrada(Uint8List bytes, {DateTime? obturador, DateTime? archivo}) => EntradaFoto(
      bytes: bytes,
      momentoSeleccion: _ahora,
      ahora: _ahora,
      momentoObturador: obturador,
      fechaArchivo: archivo,
    );

void main() {
  group('procesarFoto (3.1)', () {
    test('reduce a 1920 de lado largo, queda en JPG y bajo el peso máximo', () {
      final r = procesarFoto(_entrada(jpgDePrueba(2560, 1920)));
      expect(r.ancho, 1920);
      expect(r.alto, 1440);
      expect(detectarFormato(r.bytes), FormatoFoto.jpg);
      expect(r.bytes.length, lessThanOrEqualTo(ReglasFoto.pesoMaximo));
    });

    test('endereza las fotos verticales (EXIF Orientation = 6)', () {
      final r = procesarFoto(_entrada(jpgDePrueba(2560, 1920, orientacion: 6)));
      expect(r.ancho, 1440);
      expect(r.alto, 1920);
    });

    test('una foto ya chica pero válida no se agranda', () {
      final r = procesarFoto(_entrada(jpgDePrueba(1600, 900)));
      expect(r.ancho, 1600);
      expect(r.alto, 900);
    });

    test('una foto muy alargada no baja del mínimo del lado corto', () {
      final r = procesarFoto(_entrada(jpgDePrueba(3000, 760)));
      expect(r.alto, greaterThanOrEqualTo(ReglasFoto.ladoCortoMin));
    });

    test('rechaza fotos de baja resolución (el backend pide mínimo 1280×720)', () {
      expect(
        () => procesarFoto(_entrada(jpgDePrueba(800, 600))),
        throwsA(isA<FotoInvalida>().having((e) => e.mensaje, 'mensaje', contains('800×600'))),
      );
    });

    test('acepta PNG y lo convierte a JPG', () {
      final png = img.encodePng(img.Image(width: 1600, height: 900));
      final r = procesarFoto(_entrada(png));
      expect(detectarFormato(r.bytes), FormatoFoto.jpg);
    });

    test('rechaza lo que no es JPG ni PNG', () {
      expect(
        () => procesarFoto(_entrada(Uint8List.fromList([1, 2, 3, 4, 5, 6, 7, 8]))),
        throwsA(isA<FotoInvalida>()),
      );
    });

    test('toma la hora del EXIF del archivo original (con zona horaria)', () {
      final r = procesarFoto(_entrada(jpgDePrueba(1600, 1200, fechaExif: '2026:10:27 09:15:30', zona: '-06:00')));
      expect(r.origenFecha, OrigenFechaFoto.exif);
      expect(r.fechaCaptura, DateTime.utc(2026, 10, 27, 15, 15, 30));
    });
  });

  group('parsearFechaExif', () {
    test('con zona: se convierte a UTC', () {
      expect(parsearFechaExif('2026:10:27 09:15:30', '-06:00'), DateTime.utc(2026, 10, 27, 15, 15, 30));
      expect(parsearFechaExif('2026:10:27 09:15:30', '+01:00'), DateTime.utc(2026, 10, 27, 8, 15, 30));
    });

    test('sin zona: es la hora local del celular', () {
      expect(parsearFechaExif('2026:10:27 09:15:30', null), DateTime(2026, 10, 27, 9, 15, 30).toUtc());
    });

    test('fechas vacías o basura → null', () {
      expect(parsearFechaExif('0000:00:00 00:00:00', null), isNull);
      expect(parsearFechaExif('ayer', null), isNull);
      expect(parsearFechaExif(null, null), isNull);
    });
  });

  group('resolverFechaCaptura (3.4)', () {
    final seleccion = DateTime.utc(2026, 10, 27, 18, 0);

    test('1) EXIF manda', () {
      final r = resolverFechaCaptura(
        fechaExif: DateTime.utc(2026, 10, 27, 17, 0),
        momentoObturador: seleccion,
        momentoSeleccion: seleccion,
        ahora: _ahora,
      );
      expect(r.origen, OrigenFechaFoto.exif);
      expect(r.fecha, DateTime.utc(2026, 10, 27, 17, 0));
    });

    test('2) cámara de la app sin EXIF: el instante del disparo (ARCHIVO)', () {
      final disparo = DateTime.utc(2026, 10, 27, 18, 5);
      final r = resolverFechaCaptura(momentoObturador: disparo, momentoSeleccion: seleccion, ahora: _ahora);
      expect(r.origen, OrigenFechaFoto.archivo);
      expect(r.fecha, disparo);
    });

    test('3) galería: la fecha del archivo vale si es anterior a la selección', () {
      final archivo = DateTime.utc(2026, 10, 26, 12, 0);
      final r = resolverFechaCaptura(fechaArchivo: archivo, momentoSeleccion: seleccion, ahora: _ahora);
      expect(r.origen, OrigenFechaFoto.archivo);
      expect(r.fecha, archivo);
    });

    test('4) fecha "de ahorita" = la copia del selector: se usa SUBIDA', () {
      final r = resolverFechaCaptura(
        fechaArchivo: seleccion.add(const Duration(seconds: 2)),
        momentoSeleccion: seleccion,
        ahora: _ahora,
      );
      expect(r.origen, OrigenFechaFoto.subida);
      expect(r.fecha, seleccion);
    });

    test('5) EXIF del futuro (reloj mal) se ignora', () {
      final r = resolverFechaCaptura(
        fechaExif: _ahora.add(const Duration(days: 2)),
        momentoSeleccion: seleccion,
        ahora: _ahora,
      );
      expect(r.origen, OrigenFechaFoto.subida);
    });
  });
}
