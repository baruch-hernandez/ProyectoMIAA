import 'package:file_picker/file_picker.dart';
import 'package:image_picker/image_picker.dart';

import 'foto_evidencia.dart';
import 'procesador_fotos.dart';

/// Galería y explorador de archivos. Interfaz para poder simularla en las pruebas.
abstract class FuenteFotos {
  /// Tarea 3.2: selector de galería. null si el notificador canceló.
  Future<FotoCruda?> desdeGaleria();

  /// Tarea 3.3: explorador de archivos (solo JPG y PNG). null si canceló.
  Future<FotoCruda?> desdeArchivos();
}

/// Implementación real.
///  - Galería: image_picker usa el Photo Picker del sistema en Android 13+.
///  - Archivos: file_picker abre el explorador de Android (Storage Access Framework).
/// En los dos casos se pide la foto ORIGINAL (sin reducir), para leer su EXIF;
/// la compresión la hace ProcesadorFotos.
class FuenteFotosDispositivo implements FuenteFotos {
  FuenteFotosDispositivo({ImagePicker? selector}) : _selector = selector ?? ImagePicker();

  final ImagePicker _selector;

  static const extensiones = ['jpg', 'jpeg', 'png'];

  @override
  Future<FotoCruda?> desdeGaleria() async {
    final archivo = await _selector.pickImage(source: ImageSource.gallery, requestFullMetadata: true);
    if (archivo == null) return null;
    return FotoCruda(
      bytes: await archivo.readAsBytes(),
      nombre: archivo.name,
      fechaArchivo: await _fechaSegura(archivo.lastModified),
    );
  }

  @override
  Future<FotoCruda?> desdeArchivos() async {
    final archivo = await FilePicker.pickFile(type: FileType.custom, allowedExtensions: extensiones);
    if (archivo == null) return null;
    final extension = (archivo.extension ?? '').toLowerCase();
    if (!extensiones.contains(extension)) {
      throw const FotoInvalida('Ese archivo no es una foto JPG o PNG.');
    }
    return FotoCruda(
      bytes: await archivo.readAsBytes(),
      nombre: archivo.name,
      fechaArchivo: await _fechaSegura(archivo.xFile.lastModified),
    );
  }

  /// Algunos proveedores (content://) no dan la fecha: no es error, solo no hay dato.
  static Future<DateTime?> _fechaSegura(Future<DateTime> Function() leer) async {
    try {
      return await leer();
    } catch (_) {
      return null;
    }
  }
}
