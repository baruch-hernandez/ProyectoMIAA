import 'package:flutter/material.dart';

import 'servicio_permisos.dart';

/// Lo que eligió el notificador en el modal.
enum DecisionPermiso { cancelar, reintentar, abrirAjustes }

/// Tarea 2.1: explica por qué se necesita el permiso, cómo activarlo y lleva directo a Ajustes.
class DialogoPermiso extends StatelessWidget {
  const DialogoPermiso({super.key, required this.tipo, required this.estado});

  final TipoPermiso tipo;
  final EstadoPermiso estado;

  static const llave = Key('dialogo-permiso');
  static const llaveAjustes = Key('btn-abrir-ajustes');
  static const llaveReintentar = Key('btn-reintentar-permiso');
  static const llaveCancelar = Key('btn-cancelar-permiso');

  bool get _esCamara => tipo == TipoPermiso.camara;

  /// Si Android ya no va a preguntar, la única salida es Ajustes.
  bool get _soloAjustes => estado == EstadoPermiso.denegadoPermanente || estado == EstadoPermiso.restringido;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final titulo = _esCamara ? 'Se necesita la cámara' : 'Se necesita acceso a tus fotos';
    final para = _esCamara
        ? 'Con la cámara tomas la foto de evidencia del domicilio o del medidor. '
            'Sin ella no se puede adjuntar la foto al reporte.'
        : 'Con este permiso eliges una foto que ya tienes guardada en el celular.';
    final nombrePermiso = _esCamara ? 'Cámara' : 'Fotos y videos';
    final opcion = _esCamara ? 'Permitir solo mientras se usa la app' : 'Permitir';

    return AlertDialog(
      key: llave,
      icon: Icon(_esCamara ? Icons.no_photography : Icons.hide_image, size: 36),
      title: Text(titulo),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(para),
            const SizedBox(height: 12),
            if (estado == EstadoPermiso.restringido)
              const Text('Una política de este celular bloquea el permiso. '
                  'Si es un equipo de MIAA, pide a soporte que lo habilite.')
            else if (_soloAjustes) ...[
              Text('El permiso quedó negado y Android ya no lo vuelve a preguntar. Para activarlo:',
                  style: tema.textTheme.bodyMedium),
              const SizedBox(height: 8),
              const _Paso(numero: 1, texto: 'Toca «Abrir ajustes».'),
              const _Paso(numero: 2, texto: 'Entra a «Permisos».'),
              _Paso(numero: 3, texto: 'Elige «$nombrePermiso» y marca «$opcion».'),
              const _Paso(numero: 4, texto: 'Regresa a la app: se revisa sola.'),
            ] else
              Text('Toca «Intentar de nuevo» y, cuando Android pregunte, elige «$opcion». '
                  'También puedes activarlo tú en Ajustes → Permisos → $nombrePermiso.'),
          ],
        ),
      ),
      actions: [
        TextButton(
          key: llaveCancelar,
          onPressed: () => Navigator.of(context).pop(DecisionPermiso.cancelar),
          child: const Text('Ahora no'),
        ),
        if (!_soloAjustes)
          TextButton(
            key: llaveReintentar,
            onPressed: () => Navigator.of(context).pop(DecisionPermiso.reintentar),
            child: const Text('Intentar de nuevo'),
          ),
        FilledButton.icon(
          key: llaveAjustes,
          onPressed: () => Navigator.of(context).pop(DecisionPermiso.abrirAjustes),
          icon: const Icon(Icons.settings_outlined),
          label: const Text('Abrir ajustes'),
        ),
      ],
    );
  }
}

class _Paso extends StatelessWidget {
  const _Paso({required this.numero, required this.texto});

  final int numero;
  final String texto;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(radius: 11, child: Text('$numero', style: const TextStyle(fontSize: 12))),
          const SizedBox(width: 8),
          Expanded(child: Text(texto)),
        ],
      ),
    );
  }
}

/// Muestra el modal y regresa lo que se eligió (cerrarlo tocando afuera = cancelar).
Future<DecisionPermiso> mostrarDialogoPermiso(
  BuildContext context, {
  required TipoPermiso tipo,
  required EstadoPermiso estado,
}) async {
  final decision = await showDialog<DecisionPermiso>(
    context: context,
    builder: (_) => DialogoPermiso(tipo: tipo, estado: estado),
  );
  return decision ?? DecisionPermiso.cancelar;
}

/// El flujo completo de un permiso antes de abrir la cámara o la galería (tareas 1.4 y 2.1).
///
/// Sigue la regla de permission_handler 13 para Android:
///  - `consultar` solo sirve para saltarse la pregunta si ya está concedido;
///  - "denegado para siempre" solo se sabe por el resultado de `solicitar`;
///  - nunca se guarda ese veredicto: al regresar de Ajustes se vuelve a consultar.
///
/// Regresa true si al final hay permiso.
Future<bool> asegurarPermiso(BuildContext context, ServicioPermisos servicio, TipoPermiso tipo) async {
  var estado = await servicio.consultar(tipo);
  if (estado.permitido) return true;

  estado = await servicio.solicitar(tipo);
  if (estado.permitido) return true;

  // Se ofrece el modal unas cuantas veces como máximo, para no encerrar al usuario en un ciclo.
  for (var intento = 0; intento < 3; intento++) {
    if (!context.mounted) return false;
    final decision = await mostrarDialogoPermiso(context, tipo: tipo, estado: estado);
    switch (decision) {
      case DecisionPermiso.cancelar:
        return false;
      case DecisionPermiso.reintentar:
        estado = await servicio.solicitar(tipo);
      case DecisionPermiso.abrirAjustes:
        final abrio = await servicio.abrirAjustes();
        if (!abrio) return false;
        estado = await servicio.consultar(tipo);
    }
    if (estado.permitido) return true;
  }
  return false;
}
