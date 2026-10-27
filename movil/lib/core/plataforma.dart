import 'dart:io' show Platform;

import 'package:flutter/services.dart';

/// Datos del dispositivo que Flutter no da directo.
/// El canal lo atiende android/app/src/main/kotlin/mx/gob/miaa/movil/MainActivity.kt.
class Plataforma {
  Plataforma._();

  static const _canal = MethodChannel('mx.gob.miaa.movil/dispositivo');
  static int? _sdk;

  /// Versión de Android como "API level" (33 = Android 13). Fuera de Android, null.
  static Future<int?> sdkAndroid() async {
    if (!Platform.isAndroid) return null;
    if (_sdk != null) return _sdk;
    try {
      _sdk = await _canal.invokeMethod<int>('sdkInt');
    } on PlatformException {
      _sdk = null;
    } on MissingPluginException {
      _sdk = null;
    }
    return _sdk;
  }
}
