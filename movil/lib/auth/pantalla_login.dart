import 'dart:async';

import 'package:flutter/material.dart';

import '../core/api.dart';
import '../diagnostico/pantalla_diagnostico.dart';
import 'sesion.dart';

class PantallaLogin extends StatefulWidget {
  const PantallaLogin({super.key, required this.sesion});

  final Sesion sesion;

  @override
  State<PantallaLogin> createState() => _PantallaLoginState();
}

class _PantallaLoginState extends State<PantallaLogin> {
  final _usuario = TextEditingController();
  final _password = TextEditingController();
  bool _cargando = false;
  bool _verPassword = false;
  ApiError? _error;

  // Rate limit (429): el botón se bloquea con cuenta regresiva
  Timer? _reloj;
  int _espera = 0;

  @override
  void initState() {
    super.initState();
    final aviso = widget.sesion.avisoLogin;
    if (aviso != null) _error = ApiError(aviso);
  }

  @override
  void dispose() {
    _reloj?.cancel();
    _usuario.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _entrar() async {
    if (_usuario.text.trim().isEmpty || _password.text.isEmpty) {
      setState(() => _error = ApiError('Escribe tu usuario y contraseña.'));
      return;
    }
    setState(() {
      _cargando = true;
      _error = null;
    });
    try {
      await widget.sesion.entrar(_usuario.text, _password.text);
      // Si entró, la app cambia sola a Inicio (Sesion avisa con notifyListeners)
    } catch (e) {
      if (!mounted) return;
      final error = ApiError.de(e);
      setState(() => _error = error);
      final segundos = error.segundos ?? 0;
      if (error.codigo == 'DEMASIADOS_INTENTOS' && segundos > 0) _contarHacia(segundos);
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  void _contarHacia(int segundos) {
    _reloj?.cancel();
    setState(() => _espera = segundos);
    _reloj = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      setState(() => _espera--);
      if (_espera <= 0) t.cancel();
    });
  }

  @override
  Widget build(BuildContext context) {
    final colores = Theme.of(context).colorScheme;
    final bloqueado = _cargando || _espera > 0;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('MIAA', style: Theme.of(context).textTheme.displaySmall?.copyWith(
                        color: colores.primary,
                        fontWeight: FontWeight.w800,
                      )),
                  const Text('App de campo para notificadores'),
                  const SizedBox(height: 32),
                  if (_error != null) ...[
                    _AvisoError(error: _error!),
                    const SizedBox(height: 16),
                  ],
                  TextField(
                    controller: _usuario,
                    autocorrect: false,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(labelText: 'Usuario o correo', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _password,
                    obscureText: !_verPassword,
                    onSubmitted: (_) {
                      if (!bloqueado) _entrar();
                    },
                    decoration: InputDecoration(
                      labelText: 'Contraseña',
                      border: const OutlineInputBorder(),
                      suffixIcon: IconButton(
                        tooltip: _verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña',
                        icon: Icon(_verPassword ? Icons.visibility_off : Icons.visibility),
                        onPressed: () => setState(() => _verPassword = !_verPassword),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: bloqueado ? null : _entrar,
                    style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
                    child: _cargando
                        ? const SizedBox.square(dimension: 22, child: CircularProgressIndicator(strokeWidth: 2.5))
                        : Text(_espera > 0 ? 'Espera $_espera s' : 'Entrar'),
                  ),
                  const SizedBox(height: 12),
                  TextButton.icon(
                    onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => PantallaDiagnostico(sesion: widget.sesion),
                    )),
                    icon: const Icon(Icons.network_check),
                    label: const Text('Probar conexión con el servidor'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _AvisoError extends StatelessWidget {
  const _AvisoError({required this.error});

  final ApiError error;

  @override
  Widget build(BuildContext context) {
    final (titulo, icono) = switch (error.codigo) {
      'CUENTA_BLOQUEADA' => ('Cuenta bloqueada', Icons.lock_clock),
      'DEMASIADOS_INTENTOS' => ('Demasiados intentos', Icons.timer),
      _ => (null, Icons.error_outline),
    };
    final colores = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colores.errorContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icono, color: colores.onErrorContainer),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (titulo != null)
                  Text(titulo, style: TextStyle(fontWeight: FontWeight.bold, color: colores.onErrorContainer)),
                Text(error.mensaje, style: TextStyle(color: colores.onErrorContainer)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
