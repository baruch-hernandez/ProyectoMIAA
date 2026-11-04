import 'dart:io' show Platform;

import 'package:flutter/services.dart';

/// Datos del dispositivo que Flutter no da directo.
/// El canal lo atiende android/app/src/main/kotlin/mx/gob/miaa/movil/MainActivity.kt.
class Plataforma {
  Plataforma._();

  static const _canal = MethodChannel('mx.gob.miaa.movil/dispositivo');
  static const _gnss = EventChannel('mx.gob.miaa.movil/gnss');
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

  /// ¿"Ahorro de batería" prendido? (PowerManager.isPowerSaveMode). Si no se sabe, false.
  static Future<bool> ahorroEnergia() async {
    if (!Platform.isAndroid) return false;
    try {
      return await _canal.invokeMethod<bool>('ahorroEnergia') ?? false;
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }

  /// Abre los ajustes del "Ahorro de batería".
  static Future<bool> abrirAhorroEnergia() async {
    if (!Platform.isAndroid) return false;
    try {
      return await _canal.invokeMethod<bool>('abrirAhorroEnergia') ?? false;
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }

  /// Milisegundos desde que se prendió el celular (SystemClock.elapsedRealtime): cuenta también
  /// con la pantalla apagada y mover el reloj no lo cambia. Fuera de Android, null.
  static Future<int?> arranqueMs() async {
    if (!Platform.isAndroid) return null;
    try {
      return await _canal.invokeMethod<int>('arranqueMs');
    } on PlatformException {
      return null;
    } on MissingPluginException {
      return null;
    }
  }

  /// Lecturas directas del chip GPS: {lat, lng, precision}.
  static Stream<Map<Object?, Object?>> lecturasGnss() => _gnss.receiveBroadcastStream().cast();
}
