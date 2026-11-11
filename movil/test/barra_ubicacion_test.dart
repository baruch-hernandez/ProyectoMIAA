import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:movil/presencia/barra_ubicacion.dart';
import 'package:movil/presencia/latido.dart';

/// El indicador "GPS" del aviso de privacidad: visible solo mientras se comparte la ubicación.
void main() {
  tearDown(() => Latido.compartiendo.value = false);

  testWidgets('aparece al compartir, se quita al dejar de compartir y no reinicia la pantalla', (tester) async {
    await tester.pumpWidget(MaterialApp(
      builder: (context, navegador) => BarraUbicacion(child: navegador!),
      home: const Scaffold(body: TextField(key: Key('campo'))),
    ));
    await tester.enterText(find.byKey(const Key('campo')), 'lo que escribió');
    expect(find.byKey(BarraUbicacion.llave), findsNothing);

    Latido.compartiendo.value = true;
    await tester.pump();
    expect(find.text('GPS · Compartiendo tu ubicación con MIAA'), findsOneWidget);
    expect(find.text('lo que escribió'), findsOneWidget, reason: 'la pantalla de abajo no se reconstruye');

    Latido.compartiendo.value = false;
    await tester.pump();
    expect(find.byKey(BarraUbicacion.llave), findsNothing);
    expect(find.text('lo que escribió'), findsOneWidget);
  });
}
