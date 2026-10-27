import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:permission_handler/permission_handler.dart';

import '../core/plataforma.dart';

/// Los permisos que usa el reporte.
enum TipoPermiso { camara, galeria }

/// El estado de un permiso, ya traducido a lo que le importa a la app (tarea 1.4).
enum EstadoPermiso {
  /// PermissionStatus.granted (o limited: "solo algunas fotos" en Android 14).
  concedido,

  /// PermissionStatus.denied: se negó, pero Android todavía puede volver a preguntar.
  denegado,

  /// PermissionStatus.permanentlyDenied: Android ya no pregunta; solo se activa en Ajustes.
  denegadoPermanente,

  /// PermissionStatus.restricted: lo bloquea una política del dispositivo.
  restringido;

  bool get permitido => this == EstadoPermiso.concedido;
}

/// PermissionStatus (permission_handler) → EstadoPermiso.
EstadoPermiso traducirEstado(PermissionStatus estado) {
  switch (estado) {
    case PermissionStatus.granted:
    case PermissionStatus.limited:
    case PermissionStatus.provisional:
      return EstadoPermiso.concedido;
    case PermissionStatus.denied:
      return EstadoPermiso.denegado;
    case PermissionStatus.permanentlyDenied:
      return EstadoPermiso.denegadoPermanente;
    case PermissionStatus.restricted:
      return EstadoPermiso.restringido;
  }
}

/// Consulta y pide permisos. Es una interfaz para poder usar una versión falsa en las pruebas.
abstract class ServicioPermisos {
  /// Solo lee el estado (no muestra nada). OJO: en Android, `status` nunca dice
  /// "permanentemente denegado"; eso solo lo sabe [solicitar].
  Future<EstadoPermiso> consultar(TipoPermiso tipo);

  /// Muestra el diálogo del sistema si Android todavía puede preguntar.
  /// Si ya está negado para siempre, regresa [EstadoPermiso.denegadoPermanente] sin mostrar nada.
  Future<EstadoPermiso> solicitar(TipoPermiso tipo);

  /// Abre la pantalla de Ajustes de ESTA app y espera a que el usuario regrese.
  /// Regresa false si no se pudo abrir.
  Future<bool> abrirAjustes();
}

/// Implementación real con permission_handler.
class ServicioPermisosAndroid implements ServicioPermisos {
  const ServicioPermisosAndroid();

  /// Cámara → CAMERA.
  /// Galería → READ_MEDIA_IMAGES en Android 13+ (API 33+) y READ_EXTERNAL_STORAGE en 12 o menos
  /// (así está declarado en el AndroidManifest, con maxSdkVersion="32").
  Future<Permission> _permiso(TipoPermiso tipo) async {
    if (tipo == TipoPermiso.camara) return Permission.camera;
    final sdk = await Plataforma.sdkAndroid();
    return (sdk ?? 33) >= 33 ? Permission.photos : Permission.storage;
  }

  @override
  Future<EstadoPermiso> consultar(TipoPermiso tipo) async {
    final permiso = await _permiso(tipo);
    return traducirEstado(await permiso.status);
  }

  @override
  Future<EstadoPermiso> solicitar(TipoPermiso tipo) async {
    final permiso = await _permiso(tipo);
    return traducirEstado(await permiso.request());
  }

  @override
  Future<bool> abrirAjustes() async {
    final abrio = await openAppSettings();
    if (!abrio) return false;
    await esperarRegresoALaApp();
    return true;
  }
}

/// Espera a que la app vuelva al frente (p. ej. después de ir a Ajustes).
/// Tiene un límite para no quedarse esperando para siempre.
Future<void> esperarRegresoALaApp({Duration limite = const Duration(minutes: 5)}) {
  final regreso = Completer<void>();
  final oyente = AppLifecycleListener(onResume: () {
    if (!regreso.isCompleted) regreso.complete();
  });
  return regreso.future.timeout(limite, onTimeout: () {}).whenComplete(oyente.dispose);
}
