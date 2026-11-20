import 'package:flutter/material.dart';

import '../core/api.dart';
import 'pantalla_requisitos.dart' show reglasPassword;

enum _Paso { pedir, codigo, listo }

/// "¿Olvidaste tu contraseña?" (sin sesión): 1) usuario o correo → llega un código de 6 dígitos al
/// correo de la cuenta; 2) código + contraseña nueva. El backend nunca dice si la cuenta existe.
class PantallaRecuperarPassword extends StatefulWidget {
  const PantallaRecuperarPassword({super.key, required this.api, this.usuario = ''});

  final Api api;

  /// Lo que ya había escrito en el login.
  final String usuario;

  static const llaveUsuario = Key('rec-usuario');
  static const llavePedir = Key('rec-pedir');
  static const llaveCodigo = Key('rec-codigo');
  static const llaveNueva = Key('rec-nueva');
  static const llaveConfirmar = Key('rec-confirmar');
  static const llaveCambiar = Key('rec-cambiar');

  @override
  State<PantallaRecuperarPassword> createState() => _PantallaRecuperarPasswordState();
}

class _PantallaRecuperarPasswordState extends State<PantallaRecuperarPassword> {
  late final _usuario = TextEditingController(text: widget.usuario);
  final _codigo = TextEditingController();
  final _nueva = TextEditingController();
  final _confirmar = TextEditingController();
  var _paso = _Paso.pedir;
  var _enviando = false;
  var _ver = false;
  var _reenviado = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_usuario, _codigo, _nueva, _confirmar]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _ejecutar(Future<void> Function() accion) async {
    setState(() {
      _enviando = true;
      _error = null;
    });
    try {
      await accion();
    } catch (e) {
      if (mounted) setState(() => _error = ApiError.de(e).mensaje);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  Future<void> _pedirCodigo() => _ejecutar(() async {
        await widget.api.dio.post('/auth/password/olvide', data: {'usuario': _usuario.text.trim()});
        if (!mounted) return;
        setState(() {
          _reenviado = _paso == _Paso.codigo;
          _paso = _Paso.codigo;
        });
      });

  Future<void> _cambiar() => _ejecutar(() async {
        await widget.api.dio.post('/auth/password/restablecer', data: {
          'usuario': _usuario.text.trim(),
          'codigo': _codigo.text,
          'nueva': _nueva.text,
        });
        if (mounted) setState(() => _paso = _Paso.listo);
      });

  @override
  Widget build(BuildContext context) {
    final colores = Theme.of(context).colorScheme;
    final reglas = reglasPassword(_nueva.text, _confirmar.text);
    final listoParaCambiar = RegExp(r'^\d{6}$').hasMatch(_codigo.text) && reglas.every((r) => r.$2);

    return Scaffold(
      appBar: AppBar(title: const Text('Restablecer contraseña')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            if (_paso == _Paso.pedir) ...[
              const Text('Escribe tu usuario o tu correo. Te mandaremos un código de 6 dígitos al correo registrado en tu cuenta.'),
              const SizedBox(height: 16),
              TextField(
                key: PantallaRecuperarPassword.llaveUsuario,
                controller: _usuario,
                autocorrect: false,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(labelText: 'Usuario o correo', border: OutlineInputBorder()),
              ),
            ],
            if (_paso == _Paso.codigo) ...[
              Text(
                '${_reenviado ? 'Te mandamos otro código. ' : ''}Si «${_usuario.text.trim()}» tiene un correo registrado, '
                'le llegó un código que vence en 15 minutos. Revisa también la carpeta de spam.',
              ),
              const SizedBox(height: 16),
              TextField(
                key: PantallaRecuperarPassword.llaveCodigo,
                controller: _codigo,
                keyboardType: TextInputType.number,
                maxLength: 6,
                autofillHints: const [AutofillHints.oneTimeCode],
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(labelText: 'Código de 6 dígitos', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 8),
              TextField(
                key: PantallaRecuperarPassword.llaveNueva,
                controller: _nueva,
                obscureText: !_ver,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  labelText: 'Nueva contraseña',
                  border: const OutlineInputBorder(),
                  suffixIcon: IconButton(
                    tooltip: _ver ? 'Ocultar contraseña' : 'Mostrar contraseña',
                    icon: Icon(_ver ? Icons.visibility_off : Icons.visibility),
                    onPressed: () => setState(() => _ver = !_ver),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                key: PantallaRecuperarPassword.llaveConfirmar,
                controller: _confirmar,
                obscureText: !_ver,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(labelText: 'Repite la nueva contraseña', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              for (final (texto, ok) in reglas)
                Row(children: [
                  Icon(ok ? Icons.check_circle : Icons.radio_button_unchecked, size: 18, color: ok ? Colors.green.shade700 : null),
                  const SizedBox(width: 6),
                  Text(texto),
                ]),
            ],
            if (_paso == _Paso.listo) ...[
              Row(children: [
                Icon(Icons.check_circle, color: Colors.green.shade700),
                const SizedBox(width: 8),
                const Expanded(child: Text('Tu contraseña se cambió. Ya puedes entrar con ella.')),
              ]),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(),
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
                child: const Text('Ir a iniciar sesión'),
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(_error!, style: TextStyle(color: colores.error)),
            ],
            const SizedBox(height: 24),
            if (_paso == _Paso.pedir)
              FilledButton.icon(
                key: PantallaRecuperarPassword.llavePedir,
                onPressed: _enviando || _usuario.text.trim().isEmpty ? null : _pedirCodigo,
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
                icon: const Icon(Icons.mail_outline),
                label: const Text('Enviarme un código'),
              ),
            if (_paso == _Paso.codigo) ...[
              FilledButton(
                key: PantallaRecuperarPassword.llaveCambiar,
                onPressed: _enviando || !listoParaCambiar ? null : _cambiar,
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
                child: const Text('Cambiar contraseña'),
              ),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                TextButton(onPressed: _enviando ? null : _pedirCodigo, child: const Text('Mandar otro código')),
                TextButton(
                  onPressed: () => setState(() {
                    _paso = _Paso.pedir;
                    _error = null;
                    _codigo.clear();
                  }),
                  child: const Text('Cambiar usuario'),
                ),
              ]),
            ],
          ],
        ),
      ),
    );
  }
}
