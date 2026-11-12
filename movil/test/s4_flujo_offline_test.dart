// Sprint 4 — tarea 3.2: flujo completo en modo avión. Se llena el formulario, "Enviar" lo guarda en
// la base del celular (SQLite) con el aviso "Guardado en dispositivo (sin conexión)", se "reinicia"
// la app (se cierra y se vuelve a abrir la base) y el reporte sigue ahí; al volver la red, se manda.
//   flutter test test/s4_flujo_offline_test.dart
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:movil/fotos/pantalla_vista_previa.dart';
import 'package:movil/reportes/almacen_borrador.dart';
import 'package:movil/reportes/borrador_reporte.dart';
import 'package:movil/reportes/campo_tipo_predio.dart';
import 'package:movil/reportes/pantalla_nuevo_reporte.dart';
import 'package:movil/sincronizacion/reportes_offline_dao.dart';
import 'package:movil/sincronizacion/tarjeta_pendientes.dart';
import 'package:movil/ubicacion/ubicacion.dart';

import 'apoyo/falsos.dart';
import 'apoyo/sync_falsos.dart';

void main() {
  testWidgets('modo avión: se guarda en el celular, sobrevive al reinicio y se manda al volver la red', (tester) async {
    final entorno = (await tester.runAsync(EntornoOffline.crear))!;
    await tester.runAsync(entorno.abrir);
    final red = RedFalsa(conRed: false);
    final servidor = ServidorFalso(red);
    final sync = entorno.sync(usuarioId: 7, red: red, enviar: servidor.enviar);
    addTearDown(sync.dispose);
    await tester.runAsync(sync.iniciar); // como Inicio al abrir la app

    final b =BorradorReporte.nuevo(AlmacenBorradorEnMemoria())
      ..ponerUbicacion(const Ubicacion(lat: 21.8818, lng: -102.2916, precision: 4, fuente: FuenteUbicacion.gps));
    await abrirFormulario(tester, borrador: b, fuente: FuenteFalsa(galeria: [fotoCruda()]), enviar: sync.guardarYEnviar);

    // Llenado: foto, predio, domicilio y descripción
    await tester.tap(find.byKey(PantallaNuevoReporte.llaveGaleria));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(PantallaVistaPrevia.llaveConfirmar));
    await tester.pumpAndSettle();
    final bytesFoto = b.fotos.single.bytes;
    await tester.ensureVisible(find.byKey(CampoTipoPredio.llave));
    await tester.tap(find.byKey(CampoTipoPredio.llave));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Habitacional').last);
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('campo-calle')), 'Av. Convención');
    await tester.enterText(find.byKey(const Key('campo-numeroExterior')), '120');
    await tester.enterText(find.byKey(const Key('campo-colonia')), 'Centro');
    await tester.enterText(find.byKey(const Key('campo-codigoPostal')), '20000');
    await tester.enterText(find.byKey(const Key('campo-descripcion')), 'Medidor con fuga, sin señal en la zona.');

    // "Enviar" sin red: el guardado es real (SQLite + archivos), por eso corre fuera del reloj falso
    await tester.tap(find.byKey(PantallaNuevoReporte.llaveEnviar));
    for (var i = 0; i < 200 && find.text('Inicio').evaluate().isEmpty; i++) {
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 10))); // disco real
      await tester.pump(); // y lo que sigue después de cada escritura
    }
    await tester.pumpAndSettle();

    expect(find.byKey(PantallaNuevoReporte.llaveGuardadoOffline), findsOneWidget);
    expect(find.text('Guardado en dispositivo (sin conexión). Se enviará solo al volver la señal.'), findsOneWidget);
    expect(find.text('Inicio'), findsOneWidget, reason: 'regresa al inicio; el borrador queda limpio');
    expect(b.fotos, isEmpty);
    expect(servidor.peticiones, 0);

    // El contador del inicio
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: TarjetaPendientes(sync: sync))));
    expect(find.text('Reportes pendientes por sincronizar: 1'), findsOneWidget);
    expect(find.text('Sin conexión: se enviarán solos al volver la señal.'), findsOneWidget);

    // "Reinicio" de la app: se cierra la base y se abre de nuevo desde el archivo
    final uuid = sync.enCola.single.uuidCliente;
    await tester.runAsync(() async {
      await entorno.cerrar();
      final bd = await entorno.abrir();
      final otraVez = ReportesOfflineDao(Future.value(bd));
      final guardado = (await otraVez.buscar(uuid))!;
      expect(guardado.estado, EstadoSync.pendiente);
      expect(guardado.usuarioId, 7);
      expect(guardado.descripcion, 'Medidor con fuga, sin señal en la zona.');
      expect(guardado.datos['calle'], 'Av. Convención');
      expect(guardado.datos['tipoPredio'], 'HABITACIONAL');
      expect(guardado.latitud, 21.8818);
      expect(guardado.precisionGps, 4);
      final foto = (guardado.datos['fotos'] as List).single as Map;
      expect(await File('${guardado.fotoPath}${Platform.pathSeparator}${foto['archivo']}').readAsBytes(), bytesFoto,
          reason: 'la foto está en la carpeta privada, completa');

      // Vuelve la red con la app "reiniciada": se manda solo
      final despues = entorno.sync(usuarioId: 7, red: red, enviar: servidor.enviar, bd: bd);
      red.conRed = true;
      await despues.iniciar();
      despues.dispose();
      expect(servidor.recibidos.keys, [uuid]);
      expect(servidor.fotos['$uuid-0'], bytesFoto);
      expect((await otraVez.buscar(uuid))!.estado, EstadoSync.sincronizado);
    });
  });
}
