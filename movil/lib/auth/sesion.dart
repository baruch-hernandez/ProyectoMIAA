import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../core/api.dart';

/// Lo que regresa POST /api/v1/auth/login en "user".
class Usuario {
  const Usuario({
    required this.id,
    required this.username,
    required this.nombre,
    required this.rol,
    required this.debeCambiarPassword,
    required this.avisoPendiente,
  });

  final int id;
  final String username;
  final String nombre;
  final String rol;
  final bool debeCambiarPassword;
  final bool avisoPendiente;

  bool get tieneRequisitos => debeCambiarPassword || avisoPendiente;

  factory Usuario.desdeLogin(Map<String, dynamic> u) => Usuario(
        id: (u['id'] as num).toInt(),
        username: u['username']?.toString() ?? '',
        nombre: (u['nombre'] ?? u['username'] ?? '').toString(),
        rol: (u['role'] ?? u['rol'] ?? '').toString().toUpperCase(),
        debeCambiarPassword: u['tieneQueCambiarPassword'] == true,
        avisoPendiente: u['avisoPendiente'] == true,
      );

  Map<String, dynamic> aJson() => {
        'id': id,
        'username': username,
        'role': rol,
        'nombre': nombre,
        'tieneQueCambiarPassword': debeCambiarPassword,
        'avisoPendiente': avisoPendiente,
      };
}

/// ¿El JWT ya venció? Lee "exp" del payload (sin verificar la firma: eso lo hace el backend).
bool tokenVencido(String token, {DateTime? ahora}) {
  try {
    final partes = token.split('.');
    final payload = jsonDecode(utf8.decode(base64Url.decode(base64Url.normalize(partes[1]))));
    final exp = (payload['exp'] as num).toInt();
    return DateTime.fromMillisecondsSinceEpoch(exp * 1000).isBefore(ahora ?? DateTime.now());
  } catch (_) {
    return true; // si no se puede leer, mejor tratarlo como vencido
  }
}

/// La sesión de la app: token + usuario, guardados CIFRADOS (Keystore de Android).
/// Es un ChangeNotifier: la app cambia sola entre Login e Inicio cuando esto cambia.
class Sesion extends ChangeNotifier {
  Sesion._(this._almacen);

  static const _llaveToken = 'token';
  static const _llaveUsuario = 'usuario';

  final FlutterSecureStorage _almacen;
  late final Api api;

  String? _token;
  Usuario? usuario;

  /// Mensaje para mostrar en el login (p. ej. "tu sesión expiró").
  String? avisoLogin;

  bool get conSesion => _token != null && usuario != null;

  static Future<Sesion> iniciar() async {
    final sesion = Sesion._(const FlutterSecureStorage());
    sesion.api = await Api.crear(token: () => sesion._token, alExpirar: sesion._expirada);
    await sesion._restaurar();
    return sesion;
  }

  Future<void> _restaurar() async {
    try {
      final token = await _almacen.read(key: _llaveToken);
      final crudo = await _almacen.read(key: _llaveUsuario);
      if (token == null || crudo == null || tokenVencido(token)) {
        await _borrar();
        return;
      }
      _token = token;
      usuario = Usuario.desdeLogin(jsonDecode(crudo) as Map<String, dynamic>);
    } catch (_) {
      await _borrar(); // almacenamiento dañado: empezar de cero
    }
  }

  /// POST /auth/login. Lanza ApiError con el mensaje del backend si algo sale mal.
  Future<void> entrar(String username, String password) async {
    final Response<dynamic> respuesta;
    try {
      respuesta = await api.dio.post('/auth/login', data: {'username': username.trim(), 'password': password});
    } on DioException catch (e) {
      throw ApiError.de(e); // 401, 423, 429… con el mensaje del backend
    }
    final datos = respuesta.data as Map<String, dynamic>;
    final token = datos['token'] as String;
    final u = Usuario.desdeLogin(datos['user'] as Map<String, dynamic>);

    if (u.rol != 'NOTIFICADOR') {
      // El admin usa el panel web. Se cierra en el servidor la sesión que se acaba de abrir.
      unawaited(_logoutSilencioso(token));
      throw ApiError('Esta app es solo para notificadores. El administrador usa el panel web.');
    }

    _token = token;
    usuario = u;
    avisoLogin = null;
    await _almacen.write(key: _llaveToken, value: token);
    await _almacen.write(key: _llaveUsuario, value: jsonEncode(u.aJson()));
    notifyListeners();
  }

  /// POST /auth/logout (sale DESCONECTADO al instante) y borra el token del celular.
  /// Si no hay red, no se espera más de 2 s: se sale de todos modos.
  Future<void> salir() async {
    try {
      await api.dio.post('/auth/logout').timeout(const Duration(seconds: 2));
    } catch (_) {
      // sin red: el backend lo dará por desconectado al dejar de recibir latidos
    }
    await _borrar();
    notifyListeners();
  }

  Future<void> _logoutSilencioso(String token) async {
    try {
      await api.dio.post('/auth/logout', options: Options(headers: {'Authorization': 'Bearer $token'}));
    } catch (_) {
      // no importa: el backend lo marcará desconectado solo
    }
  }

  void _expirada(ApiError error) {
    if (!conSesion) return;
    avisoLogin = error.codigo == 'CUENTA_DESHABILITADA'
        ? error.mensaje
        : 'Tu sesión expiró. Inicia sesión de nuevo.';
    unawaited(_borrar().then((_) => notifyListeners()));
  }

  Future<void> _borrar() async {
    _token = null;
    usuario = null;
    await _almacen.delete(key: _llaveToken);
    await _almacen.delete(key: _llaveUsuario);
  }
}
