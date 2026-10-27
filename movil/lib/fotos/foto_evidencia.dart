import 'dart:typed_data';

/// De dónde salió la foto (tarea 3.4: trazabilidad de auditoría).
enum OrigenFoto {
  camara('Cámara'),
  galeria('Galería'),
  archivos('Archivos');

  const OrigenFoto(this.etiqueta);

  final String etiqueta;

  /// Como se guarda y se manda: CAMARA, GALERIA, ARCHIVOS.
  String get clave => name.toUpperCase();

  static OrigenFoto desdeClave(String? clave) =>
      OrigenFoto.values.firstWhere((o) => o.clave == clave, orElse: () => OrigenFoto.galeria);
}

/// De dónde se sacó la HORA de captura, de más a menos confiable.
/// Son los mismos valores que el enum OrigenFechaFoto del backend.
enum OrigenFechaFoto {
  /// Metadato EXIF "DateTimeOriginal" que escribe la cámara.
  exif('EXIF'),

  /// Fecha del archivo o el instante del disparo en la cámara de la app.
  archivo('archivo'),

  /// No se pudo saber: la hora en que se eligió la foto.
  subida('hora de selección');

  const OrigenFechaFoto(this.etiqueta);

  final String etiqueta;

  /// EXIF, ARCHIVO, SUBIDA (lo que espera el backend en "origenFecha").
  String get clave => name.toUpperCase();

  static OrigenFechaFoto desdeClave(String? clave) =>
      OrigenFechaFoto.values.firstWhere((o) => o.clave == clave, orElse: () => OrigenFechaFoto.subida);
}

/// La foto tal como la entrega la cámara, la galería o el explorador, antes de procesarla.
class FotoCruda {
  const FotoCruda({
    required this.bytes,
    required this.nombre,
    this.fechaArchivo,
    this.momentoObturador,
  });

  final Uint8List bytes;
  final String nombre;

  /// Fecha de modificación del archivo, si el sistema la dio.
  final DateTime? fechaArchivo;

  /// Solo con la cámara de la app: el instante en que se tocó el botón.
  final DateTime? momentoObturador;
}

/// Una foto ya fijada al borrador del reporte (tarea 2.5), con sus metadatos de auditoría.
class FotoEvidencia {
  const FotoEvidencia({
    required this.id,
    required this.ruta,
    required this.bytes,
    required this.ancho,
    required this.alto,
    required this.origen,
    required this.fechaCaptura,
    required this.origenFecha,
    required this.fechaAdjunta,
  });

  final String id;

  /// Dónde quedó guardada dentro de la carpeta privada de la app.
  final String ruta;

  /// La imagen ya comprimida (JPEG). No se guarda en el JSON: se vuelve a leer de [ruta].
  final Uint8List bytes;

  final int ancho;
  final int alto;
  final OrigenFoto origen;

  /// Cuándo se TOMÓ la foto (UTC).
  final DateTime fechaCaptura;
  final OrigenFechaFoto origenFecha;

  /// Cuándo se adjuntó al reporte (UTC).
  final DateTime fechaAdjunta;

  int get pesoBytes => bytes.length;

  /// Lo que se persiste en el borrador. "origen_fecha_foto" agrupa la trazabilidad de auditoría.
  Map<String, dynamic> aJson() => {
        'id': id,
        'ruta': ruta,
        'ancho': ancho,
        'alto': alto,
        'peso': pesoBytes,
        'origen_fecha_foto': {
          'origen_foto': origen.clave,
          'fecha_captura': fechaCaptura.toUtc().toIso8601String(),
          'origen_fecha': origenFecha.clave,
          'fecha_adjunta': fechaAdjunta.toUtc().toIso8601String(),
        },
      };

  /// Lee una foto del borrador; los bytes los pone quien la carga (desde el archivo).
  factory FotoEvidencia.desdeJson(Map<String, dynamic> json, Uint8List bytes) {
    final meta = (json['origen_fecha_foto'] as Map).cast<String, dynamic>();
    return FotoEvidencia(
      id: json['id'] as String,
      ruta: json['ruta'] as String,
      bytes: bytes,
      ancho: (json['ancho'] as num).toInt(),
      alto: (json['alto'] as num).toInt(),
      origen: OrigenFoto.desdeClave(meta['origen_foto'] as String?),
      fechaCaptura: DateTime.parse(meta['fecha_captura'] as String),
      origenFecha: OrigenFechaFoto.desdeClave(meta['origen_fecha'] as String?),
      fechaAdjunta: DateTime.parse(meta['fecha_adjunta'] as String),
    );
  }
}
