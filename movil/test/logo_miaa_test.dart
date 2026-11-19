import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:movil/core/logo_miaa.dart';

void main() {
  testWidgets('el logo de MIAA carga del asset y se anuncia con su nombre', (t) async {
    await t.pumpWidget(const MaterialApp(home: Scaffold(body: Center(child: LogoMiaa(alto: 88)))));
    await t.pumpAndSettle();

    expect(t.takeException(), isNull, reason: 'el asset existe y está en pubspec.yaml');
    expect(t.getSize(find.byKey(LogoMiaa.llave)).height, 88);
    expect(find.bySemanticsLabel('MIAA, Modelo Integral de Aguas de Aguascalientes'), findsOneWidget);
  });
}
