import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

/// Cuántas cosas está esperando el notificador ahorita; mientras sea > 0, CapaCarga muestra la
/// gota llenándose (igual que GotaCarga.tsx en la web).
///
/// Cuenta sola cada petición de Api (InterceptorCarga). Las de fondo (latido, sincronización
/// automática) no cuentan: llevan [Carga.oculta] en sus Options.
class Carga {
  Carga._();

  static final pendientes = ValueNotifier<int>(0);

  static const segundoPlano = 'segundoPlano';

  /// Options(extra) de una petición de fondo: no muestra la gota.
  static Options get oculta => Options(extra: {segundoPlano: true});

  /// Muestra la gota mientras dura [tarea] (p. ej. enviar un reporte, aunque sus peticiones sean
  /// de fondo porque las comparte con la sincronización automática).
  static Future<T> durante<T>(Future<T> Function() tarea) async {
    pendientes.value++;
    try {
      return await tarea();
    } finally {
      pendientes.value--;
    }
  }
}

/// Cuenta las peticiones que el usuario espera: +1 al salir, −1 al contestar o fallar.
class InterceptorCarga extends Interceptor {
  static const _contada = '_cargaContada';

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (options.extra[Carga.segundoPlano] != true) {
      options.extra[_contada] = true;
      Carga.pendientes.value++;
    }
    handler.next(options);
  }

  @override
  void onResponse(Response<dynamic> response, ResponseInterceptorHandler handler) {
    _terminar(response.requestOptions);
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    _terminar(err.requestOptions);
    handler.next(err);
  }

  static void _terminar(RequestOptions options) {
    if (options.extra.remove(_contada) == true) Carga.pendientes.value--;
  }
}
