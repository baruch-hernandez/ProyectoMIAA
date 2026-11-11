import 'package:dio/dio.dart';

import '../core/api.dart';

/// La cuenta de quien tiene la sesión (CuentaController.java). El backend permite estas rutas
/// aunque falte cambiar la contraseña o aceptar el aviso: son justo para resolverlo.
class ApiCuenta {
  ApiCuenta(this._api);

  final Api _api;

  /// GET /usuarios/yo → CuentaDTO { nombre, debeCambiarPassword, avisoPrivacidadPendiente, … }
  Future<Map<String, dynamic>> yo() => _mapa(() => _api.dio.get('/usuarios/yo'));

  /// PUT /usuarios/yo/password: 400 con el motivo si la actual no es o la nueva no cumple.
  Future<Map<String, dynamic>> cambiarPassword(String actual, String nueva) =>
      _mapa(() => _api.dio.put('/usuarios/yo/password', data: {'actual': actual, 'nueva': nueva}));

  /// POST /usuarios/yo/aviso-privacidad: 409 si la versión ya no es la vigente.
  Future<Map<String, dynamic>> aceptarAviso(String version) =>
      _mapa(() => _api.dio.post('/usuarios/yo/aviso-privacidad', data: {'version': version}));

  static Future<Map<String, dynamic>> _mapa(Future<Response<dynamic>> Function() peticion) async {
    try {
      final datos = (await peticion()).data;
      return datos is Map ? datos.cast<String, dynamic>() : <String, dynamic>{};
    } on DioException catch (e) {
      throw ApiError.de(e);
    }
  }
}
