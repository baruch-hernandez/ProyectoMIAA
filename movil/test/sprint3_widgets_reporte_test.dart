import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:movil/reportes/almacen_borrador.dart';
import 'package:movil/reportes/borrador_reporte.dart';
import 'package:movil/reportes/pantalla_nuevo_reporte.dart';

void main() {
  testWidgets('3.4 El formulario solo ofrece Cámara y Galería, y bloquea el envío sin fotos', (tester) async {
    // Configurar ventana suficientemente alta para renderizar el formulario sin cortes
    await tester.binding.setSurfaceSize(const Size(800, 2400));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final almacen = AlmacenBorradorEnMemoria();
    final borrador = BorradorReporte.nuevo(almacen);

    await tester.pumpWidget(
      MaterialApp(
        home: PantallaNuevoReporte(
          borrador: borrador,
          enviar: (_) async {},
          ubicarAlAbrir: false,
          conMosaicos: false,
        ),
      ),
    );
    await tester.pumpAndSettle();

    // 1. Selector exclusivo: Cámara y Galería
    expect(find.byKey(PantallaNuevoReporte.llaveCamara), findsOneWidget);
    expect(find.byKey(PantallaNuevoReporte.llaveGaleria), findsOneWidget);

    // 2. Sin acceso a explorador de archivos
    expect(find.text('Archivos'), findsNothing);
    expect(find.text('Explorador'), findsNothing);
    expect(find.text('Seleccionar archivo'), findsNothing);

    // 3. Advertencia de foto obligatoria
    expect(find.byKey(PantallaNuevoReporte.llaveAvisoFoto), findsOneWidget);
    expect(
      find.text('Agrega al menos una foto para poder enviar el reporte.'),
      findsOneWidget,
    );

    // 4. Botón de envío deshabilitado mientras no haya fotos
    final botonEnviar = tester.widget<FilledButton>(find.byKey(PantallaNuevoReporte.llaveEnviar));
    expect(botonEnviar.onPressed, isNull);

    borrador.dispose();
  });
}