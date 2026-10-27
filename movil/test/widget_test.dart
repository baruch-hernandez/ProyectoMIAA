// Pruebas unitarias rápidas (sin celular ni backend): flutter test
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:movil/auth/sesion.dart';
import 'package:movil/core/api.dart';

String _jwtCon(Map<String, dynamic> payload) {
  String parte(Map<String, dynamic> m) => base64Url.encode(utf8.encode(jsonEncode(m))).replaceAll('=', '');
  return '${parte({'alg': 'HS256'})}.${parte(payload)}.firma';
}

void main() {
  test('lee el usuario que regresa POST /auth/login', () {
    final u = Usuario.desdeLogin({
      'id': 7,
      'username': 'notificador1',
      'role': 'NOTIFICADOR',
      'nombre': 'Juan Pérez',
      'tieneQueCambiarPassword': false,
      'avisoPendiente': true,
    });
    expect(u.id, 7);
    expect(u.rol, 'NOTIFICADOR');
    expect(u.tieneRequisitos, isTrue);
  });

  test('detecta un token vencido por su "exp"', () {
    final ahora = DateTime(2026, 10, 20, 12);
    final segundos = ahora.millisecondsSinceEpoch ~/ 1000;
    expect(tokenVencido(_jwtCon({'exp': segundos + 3600}), ahora: ahora), isFalse);
    expect(tokenVencido(_jwtCon({'exp': segundos - 1}), ahora: ahora), isTrue);
    expect(tokenVencido('basura'), isTrue);
  });

  test('traduce el error del backend (cuenta bloqueada)', () {
    final opciones = RequestOptions(path: '/auth/login');
    final error = ApiError.de(DioException(
      requestOptions: opciones,
      type: DioExceptionType.badResponse,
      response: Response(requestOptions: opciones, statusCode: 423, data: {
        'status': 423,
        'message': 'Tu cuenta se bloqueó por demasiados intentos fallidos.',
        'codigo': 'CUENTA_BLOQUEADA',
        'segundos': 900,
      }),
    ));
    expect(error.status, 423);
    expect(error.codigo, 'CUENTA_BLOQUEADA');
    expect(error.segundos, 900);
  });
}
