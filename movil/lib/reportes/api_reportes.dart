import 'package:dio/dio.dart';

import '../core/api.dart';

/// Los reportes en el backend (ReporteController.java). Con fotos el cuerpo puede pesar
/// varios MB, por eso crear y ver el detalle dan más tiempo que las demás llamadas.
class ApiReportes {
  ApiReportes(this._api);

  final Api _api;

  static final _conFotos = Options(
    sendTimeout: const Duration(seconds: 90),
    receiveTimeout: const Duration(seconds: 60),
  );

  /// POST /reportes
  Future<Map<String, dynamic>> crear(Map<String, dynamic> solicitud) =>
      _mapa(() => _api.dio.post('/reportes', data: solicitud, options: _conFotos));

  /// GET /reportes/mios: los del notificador con sesión, del más nuevo al más viejo (sin fotos).
  Future<List<Map<String, dynamic>>> mios() => _llamar(() async {
        final datos = (await _api.dio.get('/reportes/mios')).data;
        return [for (final r in datos is List ? datos : const []) (r as Map).cast<String, dynamic>()];
      });

  /// GET /reportes/{id}: el reporte completo, con fotos y notas.
  Future<Map<String, dynamic>> detalle(int id) => _mapa(() => _api.dio.get('/reportes/$id', options: _conFotos));

  /// PUT /reportes/{id}: corregir domicilio, ubicación o descripción (solo en las primeras horas).
  Future<Map<String, dynamic>> editar(int id, Map<String, dynamic> datos) =>
      _mapa(() => _api.dio.put('/reportes/$id', data: datos, options: _conFotos));

  static Future<Map<String, dynamic>> _mapa(Future<Response<dynamic>> Function() peticion) => _llamar(() async {
        final datos = (await peticion()).data;
        return datos is Map ? datos.cast<String, dynamic>() : <String, dynamic>{};
      });

  static Future<T> _llamar<T>(Future<T> Function() peticion) async {
    try {
      return await peticion();
    } on DioException catch (e) {
      throw ApiError.de(e); // 400 con el mensaje de validación, 403 si ya pasó el plazo, etc.
    }
  }
}
