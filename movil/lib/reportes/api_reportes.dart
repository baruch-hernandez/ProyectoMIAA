import 'package:dio/dio.dart';

import '../core/api.dart';

/// POST /reportes (ReporteController.java). Con fotos el cuerpo puede pesar varios MB,
/// por eso se da más tiempo que a las demás llamadas.
class ApiReportes {
  ApiReportes(this._api);

  final Api _api;

  Future<Map<String, dynamic>> crear(Map<String, dynamic> solicitud) async {
    try {
      final respuesta = await _api.dio.post(
        '/reportes',
        data: solicitud,
        options: Options(
          sendTimeout: const Duration(seconds: 90),
          receiveTimeout: const Duration(seconds: 60),
        ),
      );
      final datos = respuesta.data;
      return datos is Map ? datos.cast<String, dynamic>() : <String, dynamic>{};
    } on DioException catch (e) {
      throw ApiError.de(e); // 400 con el mensaje de validación, 403 si falta el aviso, etc.
    }
  }
}
