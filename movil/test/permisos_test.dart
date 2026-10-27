// Tareas 1.4 y 4.2: estados de permiso y modal informativo cuando la cámara está denegada.
//   flutter test test/permisos_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:movil/fotos/pantalla_vista_previa.dart';
import 'package:movil/permisos/dialogo_permiso.dart';
import 'package:movil/permisos/servicio_permisos.dart';
import 'package:movil/reportes/pantalla_nuevo_reporte.dart';
import 'package:permission_handler/permission_handler.dart';

import 'apoyo/falsos.dart';

void main() {
  group('traducirEstado (1.4)', () {
    test('traduce los seis estados de permission_handler', () {
      expect(traducirEstado(PermissionStatus.granted), EstadoPermiso.concedido);
      expect(traducirEstado(PermissionStatus.limited), EstadoPermiso.concedido);
      expect(traducirEstado(PermissionStatus.provisional), EstadoPermiso.concedido);
      expect(traducirEstado(PermissionStatus.denied), EstadoPermiso.denegado);
      expect(traducirEstado(PermissionStatus.permanentlyDenied), EstadoPermiso.denegadoPermanente);
      expect(traducirEstado(PermissionStatus.restricted), EstadoPermiso.restringido);
    });

    test('solo "concedido" permite usar la cámara', () {
      expect(EstadoPermiso.concedido.permitido, isTrue);
      expect(EstadoPermiso.denegado.permitido, isFalse);
      expect(EstadoPermiso.denegadoPermanente.permitido, isFalse);
      expect(EstadoPermiso.restringido.permitido, isFalse);
    });
  });

  group('modal de permiso de cámara (2.1 / 4.2)', () {
    testWidgets('con permiso concedido NO aparece el modal y se abre la cámara', (tester) async {
      final camara = CamaraFalsa();
      await abrirFormulario(tester, permisos: PermisosFalsos(estado: EstadoPermiso.concedido), camara: camara);

      await tester.tap(find.byKey(PantallaNuevoReporte.llaveCamara));
      await tester.pumpAndSettle();

      expect(find.byKey(DialogoPermiso.llave), findsNothing);
      expect(camara.veces, 1);
      expect(find.byKey(PantallaVistaPrevia.llave), findsOneWidget);
    });

    testWidgets('denegado: muestra el modal con "Intentar de nuevo" y "Abrir ajustes"', (tester) async {
      final permisos = PermisosFalsos(respuestas: [EstadoPermiso.denegado]);
      final camara = CamaraFalsa();
      await abrirFormulario(tester, permisos: permisos, camara: camara);

      await tester.tap(find.byKey(PantallaNuevoReporte.llaveCamara));
      await tester.pumpAndSettle();

      expect(find.byKey(DialogoPermiso.llave), findsOneWidget);
      expect(find.text('Se necesita la cámara'), findsOneWidget);
      expect(find.byKey(DialogoPermiso.llaveReintentar), findsOneWidget);
      expect(find.byKey(DialogoPermiso.llaveAjustes), findsOneWidget);
      expect(camara.veces, 0, reason: 'sin permiso no se abre la cámara');
      expect(permisos.solicitudes, 1, reason: 'primero se pide con el diálogo del sistema');
    });

    testWidgets('denegado para siempre: instrucciones paso a paso y solo el botón a Ajustes', (tester) async {
      final permisos = PermisosFalsos(respuestas: [EstadoPermiso.denegadoPermanente]);
      await abrirFormulario(tester, permisos: permisos);

      await tester.tap(find.byKey(PantallaNuevoReporte.llaveCamara));
      await tester.pumpAndSettle();

      expect(find.byKey(DialogoPermiso.llave), findsOneWidget);
      expect(find.textContaining('ya no lo vuelve a preguntar'), findsOneWidget);
      expect(find.textContaining('Entra a «Permisos»'), findsOneWidget);
      expect(find.byKey(DialogoPermiso.llaveReintentar), findsNothing);
      expect(find.byKey(DialogoPermiso.llaveAjustes), findsOneWidget);
    });

    testWidgets('"Abrir ajustes" llama a openAppSettings y, si lo activó, sigue a la cámara', (tester) async {
      final permisos = PermisosFalsos(
        respuestas: [EstadoPermiso.denegadoPermanente],
        alAbrirAjustes: () => EstadoPermiso.concedido, // el usuario lo activó en Ajustes
      );
      final camara = CamaraFalsa();
      await abrirFormulario(tester, permisos: permisos, camara: camara);

      await tester.tap(find.byKey(PantallaNuevoReporte.llaveCamara));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(DialogoPermiso.llaveAjustes));
      await tester.pumpAndSettle();

      expect(permisos.ajustesAbiertos, 1);
      expect(find.byKey(DialogoPermiso.llave), findsNothing);
      expect(camara.veces, 1);
      expect(find.byKey(PantallaVistaPrevia.llave), findsOneWidget);
    });

    testWidgets('"Intentar de nuevo" vuelve a pedir el permiso', (tester) async {
      final permisos = PermisosFalsos(respuestas: [EstadoPermiso.denegado, EstadoPermiso.concedido]);
      final camara = CamaraFalsa();
      await abrirFormulario(tester, permisos: permisos, camara: camara);

      await tester.tap(find.byKey(PantallaNuevoReporte.llaveCamara));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(DialogoPermiso.llaveReintentar));
      await tester.pumpAndSettle();

      expect(permisos.solicitudes, 2);
      expect(camara.veces, 1);
    });

    testWidgets('"Ahora no" cierra el modal sin abrir la cámara', (tester) async {
      final camara = CamaraFalsa();
      await abrirFormulario(tester, permisos: PermisosFalsos(respuestas: [EstadoPermiso.denegado]), camara: camara);

      await tester.tap(find.byKey(PantallaNuevoReporte.llaveCamara));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(DialogoPermiso.llaveCancelar));
      await tester.pumpAndSettle();

      expect(find.byKey(DialogoPermiso.llave), findsNothing);
      expect(camara.veces, 0);
    });

    testWidgets('galería denegada: el modal habla de las fotos, no de la cámara', (tester) async {
      await abrirFormulario(tester, permisos: PermisosFalsos(respuestas: [EstadoPermiso.denegado]));

      await tester.tap(find.byKey(PantallaNuevoReporte.llaveGaleria));
      await tester.pumpAndSettle();

      expect(find.text('Se necesita acceso a tus fotos'), findsOneWidget);
    });
  });
}
