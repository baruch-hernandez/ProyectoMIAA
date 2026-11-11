import 'package:flutter/material.dart';

import '../core/api.dart';
import 'api_cuenta.dart';
import 'aviso_privacidad.dart';

/// Reglas de la contraseña: las MISMAS que PoliticaPassword.java (el backend las vuelve a revisar).
List<(String, bool)> reglasPassword(String nueva, String confirmacion) => [
      ('Al menos 6 caracteres', nueva.length >= 6 && nueva.length <= 72),
      ('Al menos una letra y un número', RegExp(r'\p{L}', unicode: true).hasMatch(nueva) && RegExp(r'\d').hasMatch(nueva)),
      ('Las dos nuevas coinciden', nueva.isNotEmpty && nueva == confirmacion),
    ];

/// Antes de usar la app, el notificador resuelve lo que le falte, en orden (como RequisitosCuenta.tsx):
///   1. cambiar la contraseña temporal que le dio el admin,
///   2. aceptar el aviso de privacidad.
/// El estado real lo dice el backend (GET /usuarios/yo), no lo guardado en el celular.
class PantallaRequisitos extends StatefulWidget {
  const PantallaRequisitos({
    super.key,
    required this.api,
    required this.nombre,
    required this.alTerminar,
    required this.alSalir,
  });

  final ApiCuenta api;
  final String nombre;

  /// Ya no falta nada: la app pasa al inicio.
  final VoidCallback alTerminar;
  final VoidCallback alSalir;

  static const llaveActual = Key('pw-actual');
  static const llaveNueva = Key('pw-nueva');
  static const llaveConfirmar = Key('pw-confirmar');
  static const llaveGuardar = Key('btn-guardar-password');
  static const llaveLeido = Key('chk-aviso-leido');
  static const llaveAceptar = Key('btn-aceptar-aviso');

  @override
  State<PantallaRequisitos> createState() => _PantallaRequisitosState();
}

class _PantallaRequisitosState extends State<PantallaRequisitos> {
  Map<String, dynamic>? _cuenta;
  String? _errorCarga;
  String? _error;
  bool _enviando = false;
  bool _ver = false;
  bool _leido = false;
  final _actual = TextEditingController();
  final _nueva = TextEditingController();
  final _confirmar = TextEditingController();

  bool get _faltaPassword => _cuenta?['debeCambiarPassword'] == true;
  bool get _faltaAviso => _cuenta?['avisoPrivacidadPendiente'] == true;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  @override
  void dispose() {
    _actual.dispose();
    _nueva.dispose();
    _confirmar.dispose();
    super.dispose();
  }

  Future<void> _cargar() async {
    setState(() => _errorCarga = null);
    try {
      _avanzar(await widget.api.yo());
    } catch (e) {
      if (mounted) setState(() => _errorCarga = ApiError.de(e).mensaje);
    }
  }

  /// Cada respuesta del backend dice qué falta; si ya nada, al inicio.
  void _avanzar(Map<String, dynamic> cuenta) {
    if (!mounted) return;
    if (cuenta['debeCambiarPassword'] != true && cuenta['avisoPrivacidadPendiente'] != true) {
      widget.alTerminar();
      return;
    }
    setState(() {
      _cuenta = cuenta;
      _error = null;
    });
  }

  Future<void> _enviar(Future<Map<String, dynamic>> Function() peticion) async {
    setState(() {
      _enviando = true;
      _error = null;
    });
    try {
      _avanzar(await peticion());
    } catch (e) {
      if (mounted) setState(() => _error = ApiError.de(e).mensaje);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final cuenta = _cuenta;
    final Widget cuerpo;
    if (_errorCarga != null) {
      cuerpo = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('No se pudo cargar tu cuenta.', style: tema.textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(_errorCarga!),
          const SizedBox(height: 12),
          FilledButton(onPressed: _cargar, child: const Text('Reintentar')),
        ],
      );
    } else if (cuenta == null) {
      cuerpo = const Padding(
        padding: EdgeInsets.symmetric(vertical: 48),
        child: Center(child: CircularProgressIndicator()),
      );
    } else {
      final total = (_faltaPassword ? 1 : 0) + (_faltaAviso ? 1 : 0);
      cuerpo = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (total > 1)
            Text('Paso ${_faltaPassword ? 1 : 2} de $total',
                style: tema.textTheme.labelMedium?.copyWith(color: tema.colorScheme.primary)),
          if (_faltaPassword) ..._pasoPassword(tema) else ..._pasoAviso(tema),
        ],
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Tu cuenta'),
        automaticallyImplyLeading: false,
        actions: [
          TextButton.icon(onPressed: widget.alSalir, icon: const Icon(Icons.logout), label: const Text('Salir')),
        ],
      ),
      body: AbsorbPointer(
        absorbing: _enviando,
        child: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 32), children: [cuerpo]),
      ),
    );
  }

  List<Widget> _pasoPassword(ThemeData tema) {
    final reglas = reglasPassword(_nueva.text, _confirmar.text);
    final listo = _actual.text.isNotEmpty && reglas.every((r) => r.$2);
    Widget campo(Key llave, TextEditingController c, String etiqueta, {bool nueva = true}) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: TextField(
            key: llave,
            controller: c,
            obscureText: !_ver,
            maxLength: 72,
            autofillHints: [nueva ? AutofillHints.newPassword : AutofillHints.password],
            decoration: InputDecoration(labelText: etiqueta, border: const OutlineInputBorder(), counterText: ''),
            onChanged: (_) => setState(() {}),
          ),
        );
    return [
      Text('Crea tu contraseña', style: tema.textTheme.headlineSmall),
      const SizedBox(height: 4),
      Text('Hola, ${widget.nombre.split(' ').first}. Entraste con una contraseña temporal; '
          'crea una nueva que solo tú conozcas.'),
      const SizedBox(height: 16),
      campo(PantallaRequisitos.llaveActual, _actual, 'Contraseña temporal', nueva: false),
      campo(PantallaRequisitos.llaveNueva, _nueva, 'Nueva contraseña'),
      campo(PantallaRequisitos.llaveConfirmar, _confirmar, 'Repite la nueva contraseña'),
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final (texto, ok) in reglas)
                  Row(
                    children: [
                      Icon(ok ? Icons.check_circle : Icons.radio_button_unchecked,
                          size: 18, color: ok ? Colors.green.shade700 : tema.disabledColor),
                      const SizedBox(width: 6),
                      Flexible(child: Text(texto)),
                    ],
                  ),
              ],
            ),
          ),
          TextButton.icon(
            onPressed: () => setState(() => _ver = !_ver),
            icon: Icon(_ver ? Icons.visibility_off : Icons.visibility),
            label: Text(_ver ? 'Ocultar' : 'Mostrar'),
          ),
        ],
      ),
      ..._errorYBoton(
        tema,
        llave: PantallaRequisitos.llaveGuardar,
        texto: 'Guardar nueva contraseña',
        habilitado: listo,
        alTocar: () => _enviar(() => widget.api.cambiarPassword(_actual.text, _nueva.text)),
      ),
    ];
  }

  List<Widget> _pasoAviso(ThemeData tema) => [
        Text('Aviso de privacidad', style: tema.textTheme.headlineSmall),
        const SizedBox(height: 4),
        const Text('Antes de usar la aplicación, lee cómo se usan tus datos.'),
        if (avisoEsBorrador) ...[
          const SizedBox(height: 8),
          Text('Borrador pendiente de revisión por el área jurídica de MIAA.',
              style: tema.textTheme.bodySmall?.copyWith(color: Colors.orange.shade900)),
        ],
        const SizedBox(height: 12),
        DecoratedBox(
          decoration: BoxDecoration(
            border: Border.all(color: tema.dividerColor),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final (titulo, parrafos) in avisoPrivacidad) ...[
                  Text(titulo, style: tema.textTheme.titleSmall),
                  for (final p in parrafos) Padding(padding: const EdgeInsets.only(top: 4), child: Text(p)),
                  const SizedBox(height: 12),
                ],
                Text('Versión $versionAviso', style: tema.textTheme.bodySmall),
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),
        CheckboxListTile(
          key: PantallaRequisitos.llaveLeido,
          value: _leido,
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          title: const Text('Leí el aviso de privacidad y acepto el uso de mis datos para las finalidades descritas.'),
          onChanged: (v) => setState(() => _leido = v ?? false),
        ),
        ..._errorYBoton(
          tema,
          llave: PantallaRequisitos.llaveAceptar,
          texto: 'Aceptar y continuar',
          habilitado: _leido,
          alTocar: () => _enviar(() => widget.api.aceptarAviso(versionAviso)),
        ),
      ];

  List<Widget> _errorYBoton(
    ThemeData tema, {
    required Key llave,
    required String texto,
    required bool habilitado,
    required VoidCallback alTocar,
  }) =>
      [
        if (_error != null) ...[
          const SizedBox(height: 12),
          Text(_error!, style: TextStyle(color: tema.colorScheme.error)),
        ],
        const SizedBox(height: 16),
        FilledButton(
          key: llave,
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
          onPressed: habilitado && !_enviando ? alTocar : null,
          child: _enviando
              ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2))
              : Text(texto),
        ),
      ];
}
