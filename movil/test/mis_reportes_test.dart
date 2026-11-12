// Mis reportes: la lista del notificador, el detalle y la corrección en las primeras horas.
//   flutter test test/mis_reportes_test.dart
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:movil/core/api.dart';
import 'package:movil/reportes/api_reportes.dart';
import 'package:movil/reportes/pantalla_editar_reporte.dart';
import 'package:movil/reportes/pantalla_mis_reportes.dart';

/// El backend simulado: un reporte, que se puede corregir si [aTiempo].
class ApiReportesFalsa implements ApiReportes {
  ApiReportesFalsa({this.aTiempo = true, this.errorAlEditar});

  bool aTiempo;
  ApiError? errorAlEditar;
  Map<String, dynamic>? ultimaEdicion;
  String? ultimaNota;

  late Map<String, dynamic> reporte = {
    'id': 7,
    'folio': 'R-2026-000007',
    'calle': 'Madero',
    'numeroExterior': '120',
    'numeroInterior': null,
    'colonia': 'Zona Centro',
    'codigoPostal': '20000',
    'municipio': 'Aguascalientes',
    'referencias': null,
    'numeroContrato': null,
    'tipoPredio': 'HABITACIONAL',
    'claveCatastral': '01-001-0001',
    'latitud': null,
    'longitud': null,
    'descripcion': 'Medidor sin sello en la entrada',
    'fechaCreacion': '2026-10-28T10:15:00',
    'fechaEdicion': null,
    'fotos': <dynamic>[],
    'notas': <dynamic>[],
    'puedeEditar': true,
    'puedeAnotar': true,
    'puedeModificar': aTiempo,
    'modificableHasta': '2026-10-29T10:15:00',
  };

  @override
  Future<List<Map<String, dynamic>>> mios() async => [
        {
          'id': reporte['id'],
          'folio': reporte['folio'],
          'domicilio': '${reporte['calle']} ${reporte['numeroExterior']}',
          'colonia': reporte['colonia'],
          'municipio': reporte['municipio'],
          'fechaCreacion': reporte['fechaCreacion'],
          'totalFotos': 2,
          'editado': reporte['fechaEdicion'] != null,
        },
      ];

  @override
  Future<Map<String, dynamic>> detalle(int id) async => {...reporte, 'puedeModificar': aTiempo};

  @override
  Future<Map<String, dynamic>> editar(int id, Map<String, dynamic> datos) async {
    final e = errorAlEditar;
    if (e != null) throw e;
    ultimaEdicion = datos;
    reporte = {...reporte, ...datos, 'fechaEdicion': '2026-10-28T11:00:00'};
    return detalle(id);
  }

  @override
  Future<Map<String, dynamic>> agregarNota(int id, String texto) async {
    ultimaNota = texto;
    final nota = {'id': 2, 'texto': texto, 'autor': 'Juan Pérez', 'autorRol': 'NOTIFICADOR', 'fechaCreacion': '2026-10-29T09:00:00'};
    reporte = {...reporte, 'notas': [...reporte['notas'] as List, nota]};
    return nota;
  }

  @override
  Future<Map<String, dynamic>> sincronizar(List<Map<String, dynamic>> reportes, Map<String, Uint8List> archivos) =>
      throw UnimplementedError();
}

Future<void> abrirLista(WidgetTester tester, ApiReportesFalsa api) async {
  await tester.binding.setSurfaceSize(const Size(800, 2400));
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(MaterialApp(home: PantallaMisReportes(api: api, conMosaicos: false)));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('lista los reportes del notificador y abre el detalle', (tester) async {
    await abrirLista(tester, ApiReportesFalsa());

    expect(find.text('R-2026-000007'), findsOneWidget);
    expect(find.text('Madero 120'), findsOneWidget);

    await tester.tap(find.byKey(const Key('reporte-7')));
    await tester.pumpAndSettle();
    expect(find.text('Medidor sin sello en la entrada'), findsOneWidget);
    expect(find.text('Predio: Habitacional'), findsOneWidget);
    expect(find.text('Clave catastral: 01-001-0001'), findsOneWidget);
    expect(find.byKey(PantallaDetalleReporte.llaveCorregir), findsOneWidget);
  });

  testWidgets('corrige el reporte: manda los cambios y la lista lo marca «Editado»', (tester) async {
    final api = ApiReportesFalsa();
    await abrirLista(tester, api);
    await tester.tap(find.byKey(const Key('reporte-7')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(PantallaDetalleReporte.llaveCorregir));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('editar-calle')), 'Av. Madero');
    await tester.enterText(find.byKey(const Key('editar-referencias')), '   ');
    await tester.tap(find.byKey(PantallaEditarReporte.llaveGuardar));
    await tester.pumpAndSettle();

    expect(api.ultimaEdicion!['calle'], 'Av. Madero');
    expect(api.ultimaEdicion!['referencias'], isNull, reason: 'opcional vacío se manda null');
    expect(api.ultimaEdicion!['municipio'], 'Aguascalientes');
    expect(api.ultimaEdicion!['tipoPredio'], 'HABITACIONAL', reason: 'lo que no se toca se manda igual');
    expect(api.ultimaEdicion!['claveCatastral'], '01-001-0001');
    expect(find.text('Cambios guardados.'), findsOneWidget);

    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.text('Editado'), findsOneWidget);
  });

  testWidgets('con un campo inválido no se manda nada', (tester) async {
    final api = ApiReportesFalsa();
    await tester.pumpWidget(MaterialApp(
      home: PantallaEditarReporte(api: api, reporte: api.reporte, conMosaicos: false),
    ));
    await tester.enterText(find.byKey(const Key('editar-codigoPostal')), '12345');
    await tester.tap(find.byKey(PantallaEditarReporte.llaveGuardar));
    await tester.pumpAndSettle();

    expect(api.ultimaEdicion, isNull);
    expect(find.text('Debe ser un C.P. de Aguascalientes (20xxx)'), findsOneWidget);
  });

  testWidgets('un reporte de antes del campo pide elegir el tipo de predio', (tester) async {
    final api = ApiReportesFalsa();
    api.reporte = {...api.reporte, 'tipoPredio': null};
    await tester.binding.setSurfaceSize(const Size(800, 2400)); // que el campo se dibuje
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(MaterialApp(
      home: PantallaEditarReporte(api: api, reporte: api.reporte, conMosaicos: false),
    ));
    await tester.tap(find.byKey(PantallaEditarReporte.llaveGuardar));
    await tester.pumpAndSettle();

    expect(api.ultimaEdicion, isNull);
    expect(find.text('Elige el tipo de predio'), findsOneWidget);
  });

  testWidgets('si el backend dice que ya pasó el plazo, se muestra su mensaje', (tester) async {
    final api = ApiReportesFalsa(errorAlEditar: ApiError('Ya pasaron las 24 h para corregir', status: 403));
    await tester.pumpWidget(MaterialApp(
      home: PantallaEditarReporte(api: api, reporte: api.reporte, conMosaicos: false),
    ));
    await tester.tap(find.byKey(PantallaEditarReporte.llaveGuardar));
    await tester.pumpAndSettle();
    expect(find.text('Ya pasaron las 24 h para corregir'), findsOneWidget);
  });

  testWidgets('ve la nota del admin destacada y le responde', (tester) async {
    final api = ApiReportesFalsa(aTiempo: false); // las notas no tienen plazo
    api.reporte = {
      ...api.reporte,
      'notas': [
        {'id': 1, 'texto': '¿Puedes confirmar el número?', 'autor': 'Ana', 'autorRol': 'ADMIN', 'fechaCreacion': '2026-10-29T08:00:00'},
      ],
    };
    await abrirLista(tester, api);
    await tester.tap(find.byKey(const Key('reporte-7')));
    await tester.pumpAndSettle();

    expect(find.text('¿Puedes confirmar el número?'), findsOneWidget);
    expect(find.byIcon(Icons.admin_panel_settings), findsOneWidget);
    expect(find.text('Responder o agregar nota'), findsOneWidget);

    await tester.enterText(find.byKey(PantallaDetalleReporte.llaveNota), '  Sí, es el 120.  ');
    await tester.ensureVisible(find.byKey(PantallaDetalleReporte.llaveEnviarNota));
    await tester.tap(find.byKey(PantallaDetalleReporte.llaveEnviarNota));
    await tester.pumpAndSettle();

    expect(api.ultimaNota, 'Sí, es el 120.');
    expect(find.text('Sí, es el 120.'), findsOneWidget); // ya en la lista, y el campo quedó vacío
  });

  testWidgets('pasado el plazo no se ofrece corregir', (tester) async {
    await abrirLista(tester, ApiReportesFalsa(aTiempo: false));
    await tester.tap(find.byKey(const Key('reporte-7')));
    await tester.pumpAndSettle();
    expect(find.byKey(PantallaDetalleReporte.llaveCorregir), findsNothing);
    expect(find.textContaining('Ya pasó el plazo'), findsOneWidget);
  });
}
