// Tareas 2.2–2.5, 3.4 y 4.1: bloqueo del envío sin foto, vista previa, repetir/confirmar
// y metadatos persistidos en el borrador.
//   flutter test test/formulario_reporte_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:movil/fotos/foto_evidencia.dart';
import 'package:movil/fotos/pantalla_vista_previa.dart';
import 'package:movil/fotos/procesador_fotos.dart';
import 'package:movil/reportes/almacen_borrador.dart';
import 'package:movil/reportes/borrador_reporte.dart';
import 'package:movil/reportes/pantalla_nuevo_reporte.dart';

import 'apoyo/falsos.dart';

void main() {
  group('BorradorReporte (2.2 / 3.4)', () {
    test('sin fotos no se puede enviar; con una sí; al quitarla, otra vez no', () async {
      final b = BorradorReporte.nuevo(AlmacenBorradorEnMemoria());
      expect(b.puedeEnviar, isFalse);

      final foto = await b.agregarFoto(fotoProcesada(), OrigenFoto.camara);
      expect(b.puedeEnviar, isTrue);

      await b.quitarFoto(foto.id);
      expect(b.puedeEnviar, isFalse);
    });

    test('máximo 3 fotos, como el backend', () async {
      final b = BorradorReporte.nuevo(AlmacenBorradorEnMemoria());
      for (var i = 0; i < ReglasFoto.maxFotos; i++) {
        await b.agregarFoto(fotoProcesada(), OrigenFoto.galeria);
      }
      expect(b.completoDeFotos, isTrue);
      await expectLater(b.agregarFoto(fotoProcesada(), OrigenFoto.galeria), throwsA(isA<FotoInvalida>()));
    });

    test('persiste origen_fecha_foto (origen + hora de captura) y lo recupera al reabrir', () async {
      final almacen = AlmacenBorradorEnMemoria();
      final b = BorradorReporte.nuevo(almacen)..ponerCampo(CampoReporte.calle, 'Av. Convención');
      await b.agregarFoto(fotoProcesada(origenFecha: OrigenFechaFoto.exif), OrigenFoto.camara,
          ahora: DateTime.utc(2026, 10, 27, 18, 31));

      final guardado = almacen.datos!;
      final meta = (guardado['fotos'] as List).single['origen_fecha_foto'] as Map;
      expect(meta['origen_foto'], 'CAMARA');
      expect(meta['origen_fecha'], 'EXIF');
      expect(meta['fecha_captura'], '2026-10-27T18:30:00.000Z');
      expect(meta['fecha_adjunta'], '2026-10-27T18:31:00.000Z');

      final reabierto = await BorradorReporte.cargar(almacen);
      expect(reabierto.campo(CampoReporte.calle), 'Av. Convención');
      expect(reabierto.clienteId, b.clienteId);
      expect(reabierto.fotos.single.origen, OrigenFoto.camara);
      expect(reabierto.fotos.single.origenFecha, OrigenFechaFoto.exif);
      expect(reabierto.fotos.single.fechaCaptura, DateTime.utc(2026, 10, 27, 18, 30));
    });

    test('la solicitud lleva las fotos como el backend las espera', () async {
      final b = BorradorReporte.nuevo(AlmacenBorradorEnMemoria())
        ..ponerCampo(CampoReporte.calle, '  Madero ')
        ..ponerCampo(CampoReporte.numeroInterior, '   ');
      await b.agregarFoto(fotoProcesada(origenFecha: OrigenFechaFoto.subida), OrigenFoto.archivos);

      final s = b.aSolicitud();
      expect(s['calle'], 'Madero');
      expect(s['numeroInterior'], isNull, reason: 'opcional vacío = null');
      expect(s['municipio'], 'Aguascalientes');
      expect(s['clienteId'], matches(RegExp(r'^[0-9a-f-]{36}$')));
      final foto = (s['fotos'] as List).single as Map;
      expect(foto['datos'], startsWith('data:image/jpeg;base64,'));
      expect(foto['origenFecha'], 'SUBIDA');
      expect(foto['origenFoto'], 'ARCHIVOS');
      expect(foto['fechaCaptura'], '2026-10-27T18:30:00.000Z');
    });
  });

  group('formulario (2.2–2.5 / 4.1)', () {
    testWidgets('el botón Enviar está DESHABILITADO mientras no haya foto', (tester) async {
      await abrirFormulario(tester);

      expect(botonEnviarHabilitado(tester), isFalse);
      expect(find.byKey(PantallaNuevoReporte.llaveAvisoFoto), findsOneWidget);

      // Llenar todo el formulario no basta: sin foto sigue bloqueado.
      await tester.enterText(find.byKey(const Key('campo-calle')), 'Av. Convención');
      await tester.enterText(find.byKey(const Key('campo-descripcion')), 'Medidor con fuga en la toma.');
      await tester.pump();
      expect(botonEnviarHabilitado(tester), isFalse);
    });

    testWidgets('con una foto confirmada el botón se habilita; al quitarla se bloquea otra vez', (tester) async {
      final fuente = FuenteFalsa(galeria: [fotoCruda()]);
      final b = await abrirFormulario(tester, fuente: fuente);

      await tester.tap(find.byKey(PantallaNuevoReporte.llaveGaleria));
      await tester.pumpAndSettle();
      expect(find.byKey(PantallaVistaPrevia.llave), findsOneWidget, reason: '2.3: vista previa grande');

      await tester.tap(find.byKey(PantallaVistaPrevia.llaveConfirmar));
      await tester.pumpAndSettle();

      expect(b.fotos, hasLength(1));
      expect(botonEnviarHabilitado(tester), isTrue);
      expect(find.byKey(PantallaNuevoReporte.llaveAvisoFoto), findsNothing);

      await tester.tap(find.byTooltip('Quitar foto'));
      await tester.pumpAndSettle();
      expect(b.fotos, isEmpty);
      expect(botonEnviarHabilitado(tester), isFalse);
    });

    testWidgets('"Repetir foto" descarta la foto y vuelve a abrir la cámara (2.4)', (tester) async {
      final camara = CamaraFalsa();
      final b = await abrirFormulario(tester, camara: camara);

      await tester.tap(find.byKey(PantallaNuevoReporte.llaveCamara));
      await tester.pumpAndSettle();
      expect(find.text('Repetir foto'), findsOneWidget);

      await tester.tap(find.byKey(PantallaVistaPrevia.llaveRepetir));
      await tester.pumpAndSettle();

      expect(camara.veces, 2, reason: 'se reabrió el obturador');
      expect(b.fotos, isEmpty, reason: 'la foto descartada no se adjunta');
      expect(find.byKey(PantallaVistaPrevia.llave), findsOneWidget);

      await tester.tap(find.byKey(PantallaVistaPrevia.llaveConfirmar));
      await tester.pumpAndSettle();
      expect(b.fotos, hasLength(1));
      expect(b.fotos.single.origen, OrigenFoto.camara);
    });

    testWidgets('en galería el botón dice "Elegir otra" y reabre el selector', (tester) async {
      final fuente = FuenteFalsa(galeria: [fotoCruda(), fotoCruda()]);
      await abrirFormulario(tester, fuente: fuente);

      await tester.tap(find.byKey(PantallaNuevoReporte.llaveGaleria));
      await tester.pumpAndSettle();
      expect(find.text('Elegir otra'), findsOneWidget);

      await tester.tap(find.byKey(PantallaVistaPrevia.llaveRepetir));
      await tester.pumpAndSettle();
      expect(fuente.vecesGaleria, 2);
    });

    testWidgets('una foto que no sirve (baja resolución) no se adjunta y se explica por qué', (tester) async {
      final b = await abrirFormulario(
        tester,
        fuente: FuenteFalsa(archivos: [fotoCruda()]),
        procesador: ProcesadorFalso(error: const FotoInvalida('La foto mide 800×600 y se necesita mínimo 1280×720')),
      );

      await tester.tap(find.byKey(PantallaNuevoReporte.llaveArchivos));
      await tester.pumpAndSettle();

      expect(find.byKey(PantallaVistaPrevia.llave), findsNothing);
      expect(find.textContaining('800×600'), findsOneWidget);
      expect(b.fotos, isEmpty);
      expect(botonEnviarHabilitado(tester), isFalse);
    });

    testWidgets('con foto, valida los campos y manda la solicitud completa', (tester) async {
      Map<String, dynamic>? enviada;
      final fuente = FuenteFalsa(galeria: [fotoCruda()]);
      final b = await abrirFormulario(tester, fuente: fuente, enviar: (s) async => enviada = s);

      await tester.tap(find.byKey(PantallaNuevoReporte.llaveGaleria));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(PantallaVistaPrevia.llaveConfirmar));
      await tester.pumpAndSettle();

      // Campos vacíos: no se envía
      await tester.tap(find.byKey(PantallaNuevoReporte.llaveEnviar));
      await tester.pumpAndSettle();
      expect(enviada, isNull);
      expect(find.text('La calle es obligatoria'), findsOneWidget);

      await tester.enterText(find.byKey(const Key('campo-calle')), 'Av. Convención');
      await tester.enterText(find.byKey(const Key('campo-numeroExterior')), '120');
      await tester.enterText(find.byKey(const Key('campo-colonia')), 'Centro');
      await tester.enterText(find.byKey(const Key('campo-codigoPostal')), '20000');
      await tester.enterText(find.byKey(const Key('campo-descripcion')), 'Medidor con fuga visible en la toma.');
      await tester.tap(find.byKey(PantallaNuevoReporte.llaveEnviar));
      await tester.pumpAndSettle();

      expect(enviada, isNotNull);
      expect(enviada!['codigoPostal'], '20000');
      expect((enviada!['fotos'] as List), hasLength(1));
      expect(b.fotos, isEmpty, reason: 'después de enviar, el borrador queda limpio');
      expect(find.text('Inicio'), findsOneWidget, reason: 'regresa a la pantalla anterior');
    });
  });
}
