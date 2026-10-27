import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../auth/sesion.dart';
import '../core/api.dart';
import '../core/config.dart';

/// Prueba rápida de la conexión con el backend, paso por paso.
/// Sirve para saber si el problema es la URL, el certificado, la red o la sesión.
class PantallaDiagnostico extends StatefulWidget {
  const PantallaDiagnostico({super.key, required this.sesion});

  final Sesion sesion;

  @override
  State<PantallaDiagnostico> createState() => _PantallaDiagnosticoState();
}

class _Paso {
  _Paso(this.nombre);

  final String nombre;
  bool? ok; // null = corriendo
  String detalle = '';
}

class _PantallaDiagnosticoState extends State<PantallaDiagnostico> {
  final List<_Paso> _pasos = [];
  bool _corriendo = false;

  @override
  void initState() {
    super.initState();
    _correr();
  }

  Future<void> _paso(String nombre, Future<String> Function() prueba) async {
    final p = _Paso(nombre);
    setState(() => _pasos.add(p));
    final reloj = Stopwatch()..start();
    try {
      p.detalle = await prueba();
      p.ok = true;
    } catch (e) {
      p.detalle = ApiError.de(e).mensaje;
      p.ok = false;
    }
    p.detalle += '  (${reloj.elapsedMilliseconds} ms)';
    if (mounted) setState(() {});
  }

  Future<void> _correr() async {
    setState(() {
      _pasos.clear();
      _corriendo = true;
    });
    final dio = widget.sesion.api.dio;

    await _paso('Configuración', () async {
      if (!Config.apiUrl.startsWith('https://')) {
        throw ApiError('API_URL debe empezar con https:// (RNF-03): ${Config.apiUrl}');
      }
      final cert = kDebugMode && Config.certDev
          ? (Api.avisoCertificado ?? 'certificado de desarrollo cargado')
          : 'usa los certificados del sistema';
      return '${Config.apiUrl}\n$cert';
    });

    await _paso('El servidor responde por HTTPS', () async {
      try {
        // Login vacío: el backend debe contestar 400 "Escribe tu usuario y contraseña".
        await dio.post('/auth/login', data: {'username': '', 'password': ''});
        return 'Respondió 200 (raro: un login vacío debería dar 400)';
      } on DioException catch (e) {
        final status = e.response?.statusCode;
        if (status == null) rethrow; // ni siquiera llegó: red, URL o certificado
        if (status == 429) return 'Respondió 429: el rate limit está activo (espera un minuto)';
        return 'Respondió $status: ${ApiError.de(e).mensaje}';
      }
    });

    if (widget.sesion.conSesion) {
      await _paso('Token válido (GET /usuarios/yo)', () async {
        final r = await dio.get('/usuarios/yo');
        return 'Hola, ${r.data['nombre']} · rol ${r.data['rol']}';
      });
      await _paso('Latido de disponibilidad (2.4)', () async {
        final r = await dio.post('/usuarios/yo/conexion');
        return 'Respondió ${r.statusCode}: el admin te ve "En línea"';
      });
    } else {
      setState(() => _pasos.add(_Paso('Sesión')
        ..ok = true
        ..detalle = 'Inicia sesión para probar el token y el latido'));
    }

    if (mounted) setState(() => _corriendo = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Probar conexión'),
        actions: [
          IconButton(
            tooltip: 'Repetir',
            icon: const Icon(Icons.refresh),
            onPressed: _corriendo ? null : _correr,
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          for (final p in _pasos)
            Card(
              child: ListTile(
                leading: p.ok == null
                    ? const SizedBox.square(dimension: 24, child: CircularProgressIndicator(strokeWidth: 2.5))
                    : Icon(p.ok! ? Icons.check_circle : Icons.cancel, color: p.ok! ? Colors.green : Colors.red),
                title: Text(p.nombre),
                subtitle: Text(p.detalle),
              ),
            ),
        ],
      ),
    );
  }
}
