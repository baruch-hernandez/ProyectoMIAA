import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:dio/io.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;

import 'config.dart';

/// Error de la API ya "traducido": el mensaje es el mismo que manda el backend
/// ({ status, message, codigo, segundos }), o uno claro si ni siquiera hubo respuesta.
class ApiError implements Exception {
  ApiError(this.mensaje, {this.status, this.codigo, this.segundos});

  final String mensaje;
  final int? status;

  /// CUENTA_BLOQUEADA, DEMASIADOS_INTENTOS, REQUISITO_PENDIENTE, TOKEN_INVALIDO…
  final String? codigo;

  /// Cuánto esperar antes de reintentar (423 y 429).
  final int? segundos;

  factory ApiError.de(Object error) {
    if (error is ApiError) return error;
    if (error is DioException) {
      final respuesta = error.response;
      final datos = respuesta?.data;
      if (datos is Map) {
        return ApiError(
          datos['message']?.toString() ?? 'Error ${respuesta?.statusCode}',
          status: respuesta?.statusCode,
          codigo: datos['codigo']?.toString(),
          segundos: (datos['segundos'] as num?)?.toInt(),
        );
      }
      if (respuesta != null) {
        return ApiError('El servidor respondió ${respuesta.statusCode}', status: respuesta.statusCode);
      }
      if (error.type == DioExceptionType.connectionTimeout ||
          error.type == DioExceptionType.sendTimeout ||
          error.type == DioExceptionType.receiveTimeout) {
        return ApiError('El servidor no contestó a tiempo (${Config.apiUrl}).');
      }
      final causa = error.error ?? error.message;
      if (error.type == DioExceptionType.badCertificate || causa is HandshakeException) {
        return ApiError('Falló el HTTPS: el certificado del servidor no es de confianza. '
            'Revisa assets/dev/miaa-dev.pem (y que sea el certificado actual del backend).');
      }
      return ApiError('Sin conexión con ${Config.apiUrl} ($causa).');
    }
    return ApiError(error.toString());
  }

  @override
  String toString() => mensaje;
}

/// Cliente HTTP de la app (Dio) con los interceptores, igual que api.ts del front web:
///  - agrega "Authorization: Bearer <token>" a todo, menos al login;
///  - si el backend responde 401 (token vencido o cuenta dada de baja), avisa para cerrar sesión.
class Api {
  Api._(this.dio);

  final Dio dio;

  /// null = todo bien con el certificado; si no, el motivo (se muestra en Diagnóstico).
  static String? avisoCertificado;

  static Future<Api> crear({
    required String? Function() token,
    required void Function(ApiError error) alExpirar,
  }) async {
    final dio = Dio(BaseOptions(
      baseUrl: Config.apiUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 20),
      contentType: Headers.jsonContentType,
      responseType: ResponseType.json,
    ));

    if (kDebugMode && Config.certDev) {
      await _confiarEnCertificadoDev(dio);
    }

    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        final t = token();
        final esLogin = options.path.contains('/auth/login');
        if (t != null && !esLogin && !options.headers.containsKey('Authorization')) {
          options.headers['Authorization'] = 'Bearer $t';
        }
        handler.next(options);
      },
      onError: (error, handler) {
        final esLogin = error.requestOptions.path.contains('/auth/login');
        if (error.response?.statusCode == 401 && !esLogin) {
          alExpirar(ApiError.de(error));
        }
        handler.next(error);
      },
    ));
    return Api._(dio);
  }

  /// Solo en DEBUG: confía en el certificado autofirmado del backend y en NINGÚN otro.
  /// Se compara el certificado completo (no el nombre del host), así funciona igual con
  /// 10.0.2.2 (emulador) que con la IP de la PC, aunque esa IP cambie.
  /// En release no se llama: ahí el servidor debe tener un certificado real (Let's Encrypt).
  static Future<void> _confiarEnCertificadoDev(Dio dio) async {
    try {
      final pem = await rootBundle.loadString('assets/dev/miaa-dev.pem');
      final der = base64.decode(pem.replaceAll(RegExp(r'-----[A-Z ]+-----|\s'), ''));
      (dio.httpClientAdapter as IOHttpClientAdapter).createHttpClient = () {
        final cliente = HttpClient();
        cliente.badCertificateCallback = (cert, host, port) => listEquals(cert.der, der);
        return cliente;
      };
      avisoCertificado = null;
    } catch (e) {
      avisoCertificado = 'No se cargó assets/dev/miaa-dev.pem ($e). '
          'Sin él, el certificado autofirmado del backend se rechaza.';
    }
  }
}
