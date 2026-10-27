import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:path_provider/path_provider.dart';

/// Dónde vive el borrador del reporte mientras se llena: si la app se cierra o el celular
/// se queda sin batería, el reporte y sus fotos siguen ahí al volver.
abstract class AlmacenBorrador {
  Future<Map<String, dynamic>?> leerDatos();
  Future<void> guardarDatos(Map<String, dynamic> datos);
  Future<String> guardarFoto(String id, Uint8List bytes);
  Future<Uint8List?> leerFoto(String ruta);
  Future<void> borrarFoto(String ruta);

  /// Borra todo (después de enviar el reporte).
  Future<void> limpiar();
}

/// En la carpeta PRIVADA de la app (no aparece en la galería ni la ven otras apps):
///   <documentos>/borrador_reporte/borrador.json
///   <documentos>/borrador_reporte/fotos/<id>.jpg
class AlmacenBorradorArchivos implements AlmacenBorrador {
  AlmacenBorradorArchivos({Future<Directory> Function()? carpetaBase})
      : _carpetaBase = carpetaBase ?? getApplicationDocumentsDirectory;

  final Future<Directory> Function() _carpetaBase;
  Directory? _carpeta;

  Future<Directory> _raiz() async {
    final c = _carpeta ??= Directory('${(await _carpetaBase()).path}/borrador_reporte');
    await Directory('${c.path}/fotos').create(recursive: true);
    return c;
  }

  Future<File> _json() async => File('${(await _raiz()).path}/borrador.json');

  @override
  Future<Map<String, dynamic>?> leerDatos() async {
    final archivo = await _json();
    if (!await archivo.exists()) return null;
    try {
      return (jsonDecode(await archivo.readAsString()) as Map).cast<String, dynamic>();
    } catch (_) {
      return null; // dañado: se empieza de cero
    }
  }

  @override
  Future<void> guardarDatos(Map<String, dynamic> datos) async {
    final archivo = await _json();
    // Primero a un temporal y luego se renombra: si se corta a la mitad, no queda un JSON roto.
    final temporal = File('${archivo.path}.tmp');
    await temporal.writeAsString(jsonEncode(datos), flush: true);
    await temporal.rename(archivo.path);
  }

  @override
  Future<String> guardarFoto(String id, Uint8List bytes) async {
    final archivo = File('${(await _raiz()).path}/fotos/$id.jpg');
    await archivo.writeAsBytes(bytes, flush: true);
    return archivo.path;
  }

  @override
  Future<Uint8List?> leerFoto(String ruta) async {
    final archivo = File(ruta);
    if (!await archivo.exists()) return null;
    return archivo.readAsBytes();
  }

  @override
  Future<void> borrarFoto(String ruta) async {
    final archivo = File(ruta);
    if (await archivo.exists()) await archivo.delete();
  }

  @override
  Future<void> limpiar() async {
    final c = await _raiz();
    if (await c.exists()) await c.delete(recursive: true);
  }
}

/// Versión en memoria para pruebas (no toca el disco).
class AlmacenBorradorEnMemoria implements AlmacenBorrador {
  Map<String, dynamic>? datos;
  final fotos = <String, Uint8List>{};
  int guardados = 0;

  @override
  Future<Map<String, dynamic>?> leerDatos() async {
    final actuales = datos;
    if (actuales == null) return null;
    return jsonDecode(jsonEncode(actuales)) as Map<String, dynamic>;
  }

  @override
  Future<void> guardarDatos(Map<String, dynamic> nuevos) async {
    // Pasarlo por JSON confirma que todo lo que se persiste se puede serializar.
    datos = jsonDecode(jsonEncode(nuevos)) as Map<String, dynamic>;
    guardados++;
  }

  @override
  Future<String> guardarFoto(String id, Uint8List bytes) async {
    final ruta = 'memoria://fotos/$id.jpg';
    fotos[ruta] = bytes;
    return ruta;
  }

  @override
  Future<Uint8List?> leerFoto(String ruta) async => fotos[ruta];

  @override
  Future<void> borrarFoto(String ruta) async {
    fotos.remove(ruta);
  }

  @override
  Future<void> limpiar() async {
    datos = null;
    fotos.clear();
  }
}
