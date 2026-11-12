import 'dart:async';

import 'package:flutter/foundation.dart';

import '../core/api.dart';
import '../core/reloj.dart';
import '../reportes/borrador_reporte.dart';
import 'almacen_fotos_offline.dart';
import 'reportes_offline_dao.dart';
import 'servicio_conectividad.dart';

/// Manda un lote a POST /reportes/sync y regresa la respuesta (ResultadoSyncDTO).
/// En la app: ApiReportes.sincronizar (el token JWT lo pone el interceptor de Api).
typedef EnviarLote = Future<Map<String, dynamic>> Function(
    List<Map<String, dynamic>> reportes, Map<String, Uint8List> archivos);

/// Qué pasó al tocar "Enviar" en el formulario.
typedef ResultadoEnvio = ({EstadoSync estado, String? error});

/// Sprint 4 (tarea 2.4): la bandeja de salida de reportes.
///
/// "Enviar" SIEMPRE guarda primero en el celular (SQLite + archivos) y después intenta mandarlo:
/// si no hay red o el servidor no contesta, no se pierde nada. Los pendientes se mandan solos, en
/// lotes, sin que el notificador espere:
///   - al volver la red (ServicioConectividad),
///   - al abrir la app o volver a ella,
///   - cada minuto mientras haya pendientes (un wifi sin internet no avisa cuando ya sirve).
///
/// Vive mientras la app está abierta con sesión (en Inicio). Con la app cerrada no se manda nada:
/// se manda al volver a abrirla (no usamos workmanager, ver README).
class SyncManager extends ChangeNotifier {
  SyncManager({
    required this.usuarioId,
    required this.dao,
    required this.fotos,
    required this.red,
    required this.enviarLote,
    this.tamanoLote = 5,
    this.cadaCuanto = const Duration(minutes: 1),
  });

  final int usuarioId;
  final ReportesOfflineDao dao;
  final AlmacenFotosOffline fotos;
  final ServicioConectividad red;
  final EnviarLote enviarLote;

  /// Reportes por petición: 5 × hasta 3 fotos de ~1 MB cabe en una petición sin ahogar los datos.
  final int tamanoLote;
  final Duration cadaCuanto;

  /// Pendientes y rechazados de este notificador, del más viejo al más nuevo.
  List<ReporteOffline> enCola = const [];
  bool hayRed = true;
  bool sincronizando = false;

  int get pendientes => enCola.where((r) => r.estado == EstadoSync.pendiente).length;

  StreamSubscription<bool>? _cambiosRed;
  Timer? _reloj;
  Future<void>? _enCurso;
  bool _cerrado = false;

  Future<void> iniciar() async {
    _cambiosRed = red.cambios.listen((conRed) {
      hayRed = conRed;
      _avisar();
      if (conRed) unawaited(sincronizar()); // sin red → con red: se manda lo pendiente
    });
    _reloj = Timer.periodic(cadaCuanto, (_) {
      if (pendientes > 0) unawaited(sincronizar());
    });
    hayRed = await red.hayRed();
    await sincronizar();
  }

  /// Guarda el reporte en el celular y, si hay red, intenta mandarlo de una vez.
  /// Si guardar falla (disco lleno), lanza la excepción y el borrador NO se debe limpiar.
  Future<ResultadoEnvio> guardarYEnviar(BorradorReporte b) async {
    final uuid = await guardar(b);
    if (await red.hayRed()) {
      // Con señal mala no se hace esperar de más: si tarda, sigue en segundo plano
      await sincronizar().timeout(const Duration(seconds: 20), onTimeout: () {});
    }
    final r = await dao.buscar(uuid);
    return (estado: r?.estado ?? EstadoSync.pendiente, error: r?.estado == EstadoSync.rechazado ? r?.error : null);
  }

  /// Copia las fotos a su carpeta y deja el reporte PENDIENTE_SINCRONIZAR. Regresa su uuid.
  Future<String> guardar(BorradorReporte b) async {
    final ubicacion = b.ubicacion!; // el formulario no deja enviar sin ubicación
    final carpeta = await fotos.guardar(b.clienteId, {for (final f in b.fotos) '${f.id}.jpg': f.bytes});
    final datos = b.aDatosOffline();
    await dao.insertar(ReporteOffline(
      uuidCliente: b.clienteId,
      usuarioId: usuarioId,
      descripcion: datos['descripcion'] as String,
      latitud: ubicacion.lat,
      longitud: ubicacion.lng,
      precisionGps: ubicacion.precision,
      fotoPath: carpeta,
      fechaCapturaUtc: RelojServidor.ahora(), // corregida con la hora del servidor si ya se midió
      datos: datos,
    ));
    await _refrescar();
    return b.clienteId;
  }

  /// Manda todos los pendientes, de [tamanoLote] en [tamanoLote]. Si ya está corriendo, espera a esa.
  /// Nunca lanza: si la base local falla, se intenta de nuevo en el siguiente ciclo.
  Future<void> sincronizar() => _enCurso ??= _sincronizar()
      .catchError((Object e) => debugPrint('SyncManager: $e'))
      .whenComplete(() => _enCurso = null);

  /// Un rechazado vuelve a la cola (p. ej. lo rechazó por la hora del celular y ya se corrigió).
  Future<void> reintentar(ReporteOffline r) async {
    await dao.reintentar(r.uuidCliente);
    await _refrescar();
    await sincronizar();
  }

  /// Un rechazado que ya no se quiere (lo vio el notificador): se borra con sus fotos.
  Future<void> descartar(ReporteOffline r) async {
    await dao.borrar(r.uuidCliente);
    await fotos.borrar(r.fotoPath);
    await _refrescar();
  }

  Future<void> _sincronizar() async {
    hayRed = await red.hayRed();
    if (!hayRed) {
      _avisar();
      return; // sin red ni se intenta: no gasta intentos ni batería
    }
    sincronizando = true;
    _avisar();
    try {
      while (!_cerrado) {
        final lote = await dao.porEstado(usuarioId, [EstadoSync.pendiente], limite: tamanoLote);
        if (lote.isEmpty) break;

        final enviados = <ReporteOffline>[]; // los que SÍ van en la petición
        final reportes = <Map<String, dynamic>>[];
        final archivos = <String, Uint8List>{};
        for (final r in lote) {
          final armado = await _armar(r, archivos);
          if (armado == null) continue; // le falta una foto: ya quedó rechazado y no se toca más
          enviados.add(r);
          reportes.add(armado);
        }
        if (reportes.isEmpty) continue;

        final Map<String, dynamic> respuesta;
        try {
          respuesta = await enviarLote(reportes, archivos);
        } catch (e) {
          // Sin red, servidor caído o sesión vencida: siguen pendientes y se reintenta después
          final error = ApiError.de(e).mensaje;
          for (final r in enviados) {
            await dao.sumarIntento(r.uuidCliente, error);
          }
          break;
        }
        if (!await _aplicar(respuesta, enviados)) break;
      }
    } finally {
      sincronizando = false;
      await _refrescar();
    }
  }

  /// Arma los metadatos de un reporte para POST /reportes/sync y junta sus fotos en [archivos]
  /// (una parte por foto). null si falta una foto en el celular: ese ya no se puede mandar.
  Future<Map<String, dynamic>?> _armar(ReporteOffline r, Map<String, Uint8List> archivos) async {
    final metaFotos = <Map<String, dynamic>>[];
    for (final f in (r.datos['fotos'] as List? ?? const [])) {
      final meta = Map<String, dynamic>.from(f as Map);
      final bytes = await fotos.leer(r.fotoPath, meta.remove('archivo') as String);
      if (bytes == null) {
        await dao.marcarRechazado(r.uuidCliente, 'Se perdió una foto en el celular; vuelve a hacer el reporte.');
        return null;
      }
      final parte = '${r.uuidCliente}-${metaFotos.length}';
      archivos[parte] = bytes;
      metaFotos.add({...meta, 'parte': parte});
    }
    return {
      ...r.datos,
      'clientSyncId': r.uuidCliente,
      'fechaCaptura': r.fechaCapturaUtc.toUtc().toIso8601String(),
      'descripcion': r.descripcion,
      'latitud': r.latitud,
      'longitud': r.longitud,
      'fotos': metaFotos,
    };
  }

  /// Marca cada reporte enviado según la respuesta. false si alguno no vino en ella (no debería
  /// pasar): se deja pendiente y se corta, para no mandarlo en bucle.
  Future<bool> _aplicar(Map<String, dynamic> respuesta, List<ReporteOffline> enviados) async {
    final porUuid = {for (final r in enviados) r.uuidCliente: r};
    for (final s in (respuesta['sincronizados'] as List? ?? const [])) {
      final r = porUuid.remove(s['clientSyncId']);
      if (r == null) continue;
      await dao.marcarSincronizado(r.uuidCliente, folio: s['folio'] as String?);
      await fotos.borrar(r.fotoPath); // ya están en el servidor
      // shortcut: la fila SINCRONIZADO se queda (≈1 KB); si algún día estorba, purgar las de más de 30 días
    }
    for (final x in (respuesta['rechazados'] as List? ?? const [])) {
      final r = porUuid.remove(x['clientSyncId']);
      if (r == null) continue;
      final errores = (x['errores'] as Map?)?.values.join(' · ');
      await dao.marcarRechazado(r.uuidCliente, errores ?? x['motivo']?.toString() ?? 'Rechazado por el servidor');
    }
    for (final r in porUuid.values) {
      await dao.sumarIntento(r.uuidCliente, 'El servidor no respondió por este reporte');
    }
    return porUuid.isEmpty;
  }

  Future<void> _refrescar() async {
    if (_cerrado) return;
    enCola = await dao.porEstado(usuarioId, [EstadoSync.pendiente, EstadoSync.rechazado]);
    _avisar();
  }

  void _avisar() {
    if (!_cerrado) notifyListeners();
  }

  @override
  void dispose() {
    _cerrado = true;
    _cambiosRed?.cancel();
    _reloj?.cancel();
    super.dispose();
  }
}
