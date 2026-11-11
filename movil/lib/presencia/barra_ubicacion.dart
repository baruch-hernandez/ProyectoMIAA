import 'package:flutter/material.dart';

import 'latido.dart';

/// El indicador "GPS" que promete el aviso de privacidad: una franja verde arriba de TODAS las
/// pantallas mientras el administrador está recibiendo la ubicación (Latido.compartiendo).
/// Va en MaterialApp.builder, envolviendo al Navigator.
class BarraUbicacion extends StatelessWidget {
  const BarraUbicacion({super.key, required this.child});

  final Widget child;

  static const llave = Key('barra-ubicacion');

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<bool>(
      valueListenable: Latido.compartiendo,
      builder: (context, activo, _) => Column(
        // Siempre la misma estructura (franja o nada + la app) para no reconstruir el Navigator
        children: [
          if (activo) _Franja(arriba: MediaQuery.paddingOf(context).top) else const SizedBox.shrink(),
          Expanded(
            // Con la franja, la barra de estado ya quedó cubierta: las pantallas no la vuelven a sumar
            child: MediaQuery.removePadding(context: context, removeTop: activo, child: child),
          ),
        ],
      ),
    );
  }
}

class _Franja extends StatelessWidget {
  const _Franja({required this.arriba});

  final double arriba;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      key: BarraUbicacion.llave,
      container: true,
      liveRegion: true,
      label: 'GPS activo: estás compartiendo tu ubicación con el administrador de MIAA',
      child: ExcludeSemantics(
        child: Material(
          color: const Color(0xFF0B6B58), // el mismo verde de "En línea" en el panel web
          child: Padding(
            padding: EdgeInsets.only(top: arriba),
            child: const SizedBox(
              height: 26,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.my_location, size: 14, color: Colors.white),
                  SizedBox(width: 6),
                  Text(
                    'GPS · Compartiendo tu ubicación con MIAA',
                    style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
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
