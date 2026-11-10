import 'package:flutter/material.dart';

import 'borrador_reporte.dart';

/// La lista del tipo de predio (obligatoria). La usan el formulario nuevo y el de corrección.
class CampoTipoPredio extends StatelessWidget {
  const CampoTipoPredio({super.key, required this.valor, required this.alCambiar});

  static const llave = Key('campo-tipoPredio');

  /// La clave actual ('' o null = todavía no elige; reportes viejos no lo tienen).
  final String? valor;
  final ValueChanged<String> alCambiar;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: DropdownButtonFormField<String>(
        key: llave,
        initialValue: tiposPredio.containsKey(valor) ? valor : null,
        decoration: const InputDecoration(labelText: 'Tipo de predio', border: OutlineInputBorder()),
        hint: const Text('Elige uno'),
        items: [
          for (final MapEntry(key: clave, value: nombre) in tiposPredio.entries)
            DropdownMenuItem(value: clave, child: Text(nombre)),
        ],
        onChanged: (t) {
          if (t != null) alCambiar(t);
        },
        validator: (t) => t == null ? 'Elige el tipo de predio' : null,
      ),
    );
  }
}
