import 'package:image_picker/image_picker.dart';

import 'foto_evidencia.dart';

/// Galería. Interfaz para poder simularla en las pruebas.
abstract class FuenteFotos {
  /// Tarea 3.2: selector de galería. null si el notificador canceló.
  Future<FotoCruda?> desdeGaleria();
}

/// Implementación real: image_picker usa el Photo Picker del sistema en Android 13+.
/// Se pide la foto ORIGINAL (sin reducir), para leer su EXIF; la compresión la hace ProcesadorFotos.
class FuenteFotosDispositivo implements FuenteFotos {
  FuenteFotosDispositivo({ImagePicker? selector}) : _selector = selector ?? ImagePicker();

  final ImagePicker _selector;

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

  /// Algunos proveedores (content://) no dan la fecha: no es error, solo no hay dato.
  static Future<DateTime?> _fechaSegura(Future<DateTime> Function() leer) async {
    try {
      return await leer();
    } catch (_) {
      return null;
    }
  }
}
