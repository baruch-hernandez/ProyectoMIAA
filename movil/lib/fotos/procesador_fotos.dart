import 'dart:isolate';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:image/image.dart' as img;

import 'foto_evidencia.dart';

/// Reglas de las fotos. Las mínimas y el peso salen de ValidadorFotos.java del backend:
/// si la app las respeta, el servidor nunca rechaza una foto.
class ReglasFoto {
  ReglasFoto._();

  /// Backend: lado largo ≥ 1280 y lado corto ≥ 720 (HD).
  static const ladoLargoMin = 1280;
  static const ladoCortoMin = 720;

  /// Hasta dónde se reduce: 1920 px de lado largo se leen bien los dígitos de un medidor
  /// y la foto queda en ~0.3–0.9 MB.
  static const ladoLargoMax = 1920;

  /// Calidades JPEG que se prueban, de mejor a peor, hasta que la foto quepa en [pesoMaximo].
  static const calidades = [85, 78, 70, 62];

  /// El backend acepta ~1.8 MB por foto; se deja margen.
  static const pesoMaximo = 1700 * 1024;

  /// Backend: máximo 3 fotos por reporte.
  static const maxFotos = 3;

  /// Tolerancia para relojes desfasados (igual que el backend).
  static const toleranciaFuturo = Duration(minutes: 10);

  /// Si la fecha del archivo es de "hace un momento", es la de la COPIA que hace el
  /// selector en la caché, no la de la foto original.
  static const margenCopia = Duration(seconds: 30);
}

/// La foto no sirve como evidencia; [mensaje] se muestra tal cual al notificador.
class FotoInvalida implements Exception {
  const FotoInvalida(this.mensaje);

  final String mensaje;

  @override
  String toString() => mensaje;
}

/// Lo que entra al procesamiento. Solo datos simples: viaja a otro isolate.
class EntradaFoto {
  const EntradaFoto({
    required this.bytes,
    required this.momentoSeleccion,
    required this.ahora,
    this.fechaArchivo,
    this.momentoObturador,
  });

  final Uint8List bytes;

  /// Cuándo se abrió la cámara/galería/explorador.
  final DateTime momentoSeleccion;

  /// "Ahora", como parámetro para poder probarlo.
  final DateTime ahora;
  final DateTime? fechaArchivo;
  final DateTime? momentoObturador;

  factory EntradaFoto.desde(FotoCruda cruda, {required DateTime momentoSeleccion, DateTime? ahora}) => EntradaFoto(
        bytes: cruda.bytes,
        momentoSeleccion: momentoSeleccion,
        ahora: ahora ?? DateTime.now(),
        fechaArchivo: cruda.fechaArchivo,
        momentoObturador: cruda.momentoObturador,
      );
}

/// Resultado: JPEG listo para el reporte + su hora de captura y de dónde salió.
class FotoProcesada {
  const FotoProcesada({
    required this.bytes,
    required this.ancho,
    required this.alto,
    required this.fechaCaptura,
    required this.origenFecha,
  });

  final Uint8List bytes;
  final int ancho;
  final int alto;
  final DateTime fechaCaptura;
  final OrigenFechaFoto origenFecha;
}

/// Procesa la foto en otro isolate para que la pantalla no se congele.
/// Es una clase para poder cambiarla por una falsa en las pruebas de widgets.
class ProcesadorFotos {
  const ProcesadorFotos();

  Future<FotoProcesada> procesar(EntradaFoto entrada) => Isolate.run(() => procesarFoto(entrada));
}

enum FormatoFoto { jpg, png }

/// Reconoce JPG o PNG por sus primeros bytes (no por la extensión, que se puede cambiar).
FormatoFoto? detectarFormato(Uint8List b) {
  if (b.length >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF) return FormatoFoto.jpg;
  if (b.length >= 8 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47) return FormatoFoto.png;
  return null;
}

/// Tareas 3.1 y 3.4: endereza, valida resolución, reduce, comprime y resuelve la hora de captura.
/// Es síncrona y pura (sin plugins) para correr en un isolate y en las pruebas.
FotoProcesada procesarFoto(EntradaFoto e) {
  final formato = detectarFormato(e.bytes);
  if (formato == null) {
    throw const FotoInvalida('Solo se aceptan fotos JPG o PNG.');
  }

  // La hora EXIF se lee del archivo ORIGINAL, antes de tocarlo.
  final exif = formato == FormatoFoto.jpg ? img.decodeJpgExif(e.bytes) : null;
  final fechaExif = exif == null ? null : leerFechaExif(exif);

  var imagen = img.decodeImage(e.bytes);
  if (imagen == null) {
    throw const FotoInvalida('No se pudo leer la imagen; puede estar dañada.');
  }
  // Las fotos verticales vienen "acostadas" con una marca de orientación: se enderezan de verdad.
  imagen = img.bakeOrientation(imagen);

  final ancho = imagen.width;
  final alto = imagen.height;
  final largo = math.max(ancho, alto);
  final corto = math.min(ancho, alto);
  if (largo < ReglasFoto.ladoLargoMin || corto < ReglasFoto.ladoCortoMin) {
    throw FotoInvalida('La foto mide $ancho×$alto y se necesita mínimo '
        '${ReglasFoto.ladoLargoMin}×${ReglasFoto.ladoCortoMin} para que se lea bien. '
        'Tómala con la cámara.');
  }

  // Reducir el lado largo a 1920, sin que el corto baje del mínimo (fotos muy alargadas).
  var escala = math.min(1.0, ReglasFoto.ladoLargoMax / largo);
  if (corto * escala < ReglasFoto.ladoCortoMin) {
    escala = ReglasFoto.ladoCortoMin / corto;
  }
  if (escala < 1.0) {
    imagen = img.copyResize(
      imagen,
      width: (ancho * escala).round(),
      height: (alto * escala).round(),
      interpolation: img.Interpolation.linear,
    );
  }

  Uint8List? salida;
  for (final calidad in ReglasFoto.calidades) {
    salida = img.encodeJpg(imagen, quality: calidad);
    if (salida.length <= ReglasFoto.pesoMaximo) break;
  }
  if (salida == null || salida.length > ReglasFoto.pesoMaximo) {
    throw const FotoInvalida('La foto pesa demasiado aun comprimida. Vuelve a tomarla.');
  }

  final fecha = resolverFechaCaptura(
    fechaExif: fechaExif,
    momentoObturador: e.momentoObturador,
    fechaArchivo: e.fechaArchivo,
    momentoSeleccion: e.momentoSeleccion,
    ahora: e.ahora,
  );

  return FotoProcesada(
    bytes: salida,
    ancho: imagen.width,
    alto: imagen.height,
    fechaCaptura: fecha.fecha,
    origenFecha: fecha.origen,
  );
}

/// "DateTimeOriginal" (y su zona "OffsetTimeOriginal", si la cámara la escribió).
/// Si no hay, se intenta con "DateTime" del IFD0.
DateTime? leerFechaExif(img.ExifData exif) {
  final original = exif.exifIfd['DateTimeOriginal']?.toString();
  final zona = exif.exifIfd['OffsetTimeOriginal']?.toString();
  final fecha = parsearFechaExif(original, zona);
  if (fecha != null) return fecha;
  return parsearFechaExif(exif.imageIfd['DateTime']?.toString(), null);
}

final _fechaExif = RegExp(r'^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})');
final _zonaExif = RegExp(r'^([+-])(\d{2}):(\d{2})$');

/// "2026:10:27 12:49:05" (+ "-06:00" opcional) → instante en UTC.
/// Sin zona, la hora EXIF es la hora LOCAL del celular que la tomó.
DateTime? parsearFechaExif(String? texto, String? zona) {
  if (texto == null) return null;
  final m = _fechaExif.firstMatch(texto.replaceAll('\u0000', '').trim());
  if (m == null) return null;
  final p = [for (var i = 1; i <= 6; i++) int.parse(m.group(i)!)];
  if (p[0] == 0 || p[1] < 1 || p[1] > 12 || p[2] < 1 || p[2] > 31) return null; // "0000:00:00 …"

  final z = zona == null ? null : _zonaExif.firstMatch(zona.replaceAll('\u0000', '').trim());
  if (z != null) {
    final signo = z.group(1) == '-' ? -1 : 1;
    final desfase = Duration(hours: int.parse(z.group(2)!), minutes: int.parse(z.group(3)!)) * signo;
    return DateTime.utc(p[0], p[1], p[2], p[3], p[4], p[5]).subtract(desfase);
  }
  return DateTime(p[0], p[1], p[2], p[3], p[4], p[5]).toUtc();
}

/// Tarea 3.4: qué hora de captura se registra y de dónde salió (EXIF → ARCHIVO → SUBIDA).
({DateTime fecha, OrigenFechaFoto origen}) resolverFechaCaptura({
  DateTime? fechaExif,
  DateTime? momentoObturador,
  DateTime? fechaArchivo,
  required DateTime momentoSeleccion,
  required DateTime ahora,
}) {
  bool creible(DateTime f) =>
      f.isAfter(DateTime.utc(2000)) && !f.isAfter(ahora.add(ReglasFoto.toleranciaFuturo));

  if (fechaExif != null && creible(fechaExif)) {
    return (fecha: fechaExif.toUtc(), origen: OrigenFechaFoto.exif);
  }
  // Cámara de la app: el disparo ES la creación del archivo.
  if (momentoObturador != null && creible(momentoObturador)) {
    return (fecha: momentoObturador.toUtc(), origen: OrigenFechaFoto.archivo);
  }
  // Galería/archivos: la fecha del archivo vale solo si es anterior a cuando se eligió
  // (si es "de ahorita", es la de la copia que hizo el selector).
  if (fechaArchivo != null &&
      creible(fechaArchivo) &&
      fechaArchivo.isBefore(momentoSeleccion.subtract(ReglasFoto.margenCopia))) {
    return (fecha: fechaArchivo.toUtc(), origen: OrigenFechaFoto.archivo);
  }
  return (fecha: momentoSeleccion.toUtc(), origen: OrigenFechaFoto.subida);
}
