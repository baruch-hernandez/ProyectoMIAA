// Tarea 4.3 (parte automática): el ciclo completo de una foto, corriendo EN EL EMULADOR o celular.
//
//   flutter test integration_test/ciclo_fotos_test.dart -d emulator-5554
//
// Aquí el procesamiento (isolate, compresión, EXIF) y el guardado en disco son los REALES del
// dispositivo. Lo que se simula son los diálogos del sistema (permisos, cámara, galería), porque
// un test de Flutter no puede tocar ventanas de Android. Esa parte se prueba a mano con el
// protocolo de LEEME_SPRINT2.md (sección "Pruebas en emulador").
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:movil/fotos/foto_evidencia.dart';
import 'package:movil/fotos/pantalla_vista_previa.dart';
import 'package:movil/permisos/dialogo_permiso.dart';
import 'package:movil/permisos/servicio_permisos.dart';
import 'package:movil/reportes/almacen_borrador.dart';
import 'package:movil/reportes/borrador_reporte.dart';
import 'package:movil/reportes/pantalla_nuevo_reporte.dart';

import '../test/apoyo/falsos.dart';

/// Espera (en tiempo real) a que aparezca algo: el procesamiento corre en otro isolate.
Future<void> esperarA(WidgetTester tester, Finder buscado, {Duration limite = const Duration(seconds: 40)}) async {
  final fin = DateTime.now().add(limite);
  while (DateTime.now().isBefore(fin)) {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    await tester.pump();
    if (buscado.evaluate().isNotEmpty) {
      await tester.pumpAndSettle();
      return;
    }
  }
  fail('No apareció: $buscado');
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('negar permiso → Ajustes → cámara → repetir → confirmar → galería → archivo inválido', (tester) async {
    final almacen = AlmacenBorradorArchivos();
    await almacen.limpiar();
    final borrador = BorradorReporte.nuevo(almacen);

    // 1º "No permitir" (denegado), 2º "No permitir" (Android ya no pregunta), luego lo activa en Ajustes
    final permisos = PermisosFalsos(
      respuestas: [EstadoPermiso.denegado, EstadoPermiso.denegadoPermanente],
      alAbrirAjustes: () => EstadoPermiso.concedido,
    );
    final camara = CamaraFalsa(
      foto: FotoCruda(bytes: jpgDePrueba(2560, 1920), nombre: 'camara.jpg', momentoObturador: DateTime.now()),
    );
    final fuente = FuenteFalsa(
      galeria: [
        FotoCruda(
          bytes: jpgDePrueba(1600, 1200, fechaExif: '2026:10:20 10:00:00', zona: '-06:00'),
          nombre: 'galeria.jpg',
        ),
      ],
      archivos: [FotoCruda(bytes: jpgDePrueba(800, 600), nombre: 'chica.jpg')],
    );

    final navegador = GlobalKey<NavigatorState>();
    await tester.pumpWidget(MaterialApp(
      navigatorKey: navegador,
      home: const Scaffold(body: Center(child: Text('Inicio'))),
    ));
    navegador.currentState!.push(MaterialPageRoute<bool>(
      builder: (_) => PantallaNuevoReporte(
        borrador: borrador,
        enviar: (_) async {},
        permisos: permisos,
        fuente: fuente,
        abrirCamara: camara.abrir, // procesador = el real (isolate)
      ),
    ));
    await tester.pumpAndSettle();
    expect(botonEnviarHabilitado(tester), isFalse);

    // --- Denegación y recuperación del permiso ---
    await tester.tap(find.byKey(PantallaNuevoReporte.llaveCamara));
    await tester.pumpAndSettle();
    expect(find.byKey(DialogoPermiso.llaveReintentar), findsOneWidget);
    await tester.tap(find.byKey(DialogoPermiso.llaveReintentar));
    await tester.pumpAndSettle();
    expect(find.byKey(DialogoPermiso.llaveReintentar), findsNothing, reason: 'ya solo queda ir a Ajustes');
    await tester.tap(find.byKey(DialogoPermiso.llaveAjustes));

    // --- Captura, descarte por falta de nitidez y repetición ---
    await esperarA(tester, find.byKey(PantallaVistaPrevia.llave));
    expect(camara.veces, 1);
    await tester.tap(find.byKey(PantallaVistaPrevia.llaveRepetir));
    await esperarA(tester, find.byKey(PantallaVistaPrevia.llave));
    expect(camara.veces, 2);
    await tester.tap(find.byKey(PantallaVistaPrevia.llaveConfirmar));
    await tester.pumpAndSettle();
    expect(borrador.fotos, hasLength(1));
    expect(borrador.fotos.single.origen, OrigenFoto.camara);
    expect(borrador.fotos.single.ancho, 1920, reason: 'se redujo a 1920 de lado largo');
    expect(botonEnviarHabilitado(tester), isTrue);

    // --- Galería: la hora sale del EXIF ---
    await tester.tap(find.byKey(PantallaNuevoReporte.llaveGaleria));
    await esperarA(tester, find.byKey(PantallaVistaPrevia.llave));
    await tester.tap(find.byKey(PantallaVistaPrevia.llaveConfirmar));
    await tester.pumpAndSettle();
    expect(borrador.fotos, hasLength(2));
    expect(borrador.fotos.last.origen, OrigenFoto.galeria);
    expect(borrador.fotos.last.origenFecha, OrigenFechaFoto.exif);
    expect(borrador.fotos.last.fechaCaptura, DateTime.utc(2026, 10, 20, 16, 0));

    // --- Archivo de baja resolución: no se adjunta ---
    await tester.tap(find.byKey(PantallaNuevoReporte.llaveArchivos));
    await esperarA(tester, find.textContaining('800×600'));
    expect(borrador.fotos, hasLength(2));

    // --- Quedó guardado en el disco del celular con sus metadatos ---
    final reabierto = await BorradorReporte.cargar(AlmacenBorradorArchivos());
    expect(reabierto.fotos, hasLength(2));
    expect(reabierto.fotos.map((f) => f.origen), [OrigenFoto.camara, OrigenFoto.galeria]);
    expect(reabierto.fotos.last.origenFecha, OrigenFechaFoto.exif);

    reabierto.dispose();
    await almacen.limpiar();
  });
}
