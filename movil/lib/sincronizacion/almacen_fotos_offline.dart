import 'dart:io';
import 'dart:typed_data';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

/// Sprint 4 (tarea 2.2): las fotos de cada reporte guardado sin conexión, en la carpeta PRIVADA
/// de la app (no salen en la galería ni las ven otras apps):
///   `<documentos>/reportes_offline/<uuid>/<foto>.jpg`
/// Ya vienen comprimidas (JPEG de ProcesadorFotos): se guardan tal cual, sin volver a comprimir.
class AlmacenFotosOffline {
  AlmacenFotosOffline({Future<Directory> Function()? carpetaBase})
      : _carpetaBase = carpetaBase ?? getApplicationDocumentsDirectory;

  final Future<Directory> Function() _carpetaBase;

  /// Guarda las fotos de un reporte ({nombre: bytes}) y regresa su carpeta (foto_path).
  Future<String> guardar(String uuid, Map<String, Uint8List> fotos) async {
    final carpeta = Directory(p.join((await _carpetaBase()).path, 'reportes_offline', uuid));
    await carpeta.create(recursive: true);
    for (final f in fotos.entries) {
      await File(p.join(carpeta.path, f.key)).writeAsBytes(f.value, flush: true);
    }
    return carpeta.path;
  }

  /// null si el archivo ya no está.
  Future<Uint8List?> leer(String carpeta, String nombre) async {
    final archivo = File(p.join(carpeta, nombre));
    return await archivo.exists() ? archivo.readAsBytes() : null;
  }

  Future<void> borrar(String carpeta) async {
    final c = Directory(carpeta);
    if (await c.exists()) await c.delete(recursive: true);
  }
}
