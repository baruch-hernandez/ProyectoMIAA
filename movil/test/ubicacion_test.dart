// Ubicación del domicilio: límite del estado, dirección desde el mapa, afinado del GPS,
// el borrador y las pantallas.
//   flutter test test/ubicacion_test.dart
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:movil/permisos/dialogo_permiso.dart';
import 'package:movil/permisos/servicio_permisos.dart';
import 'package:movil/reportes/almacen_borrador.dart';
import 'package:movil/reportes/borrador_reporte.dart';
import 'package:movil/reportes/pantalla_nuevo_reporte.dart';
import 'package:movil/ubicacion/afinador_gps.dart';
import 'package:movil/ubicacion/direccion_gps.dart';
import 'package:movil/ubicacion/geocodificador.dart';
import 'package:movil/ubicacion/limite_ags.dart';
import 'package:movil/ubicacion/pantalla_elegir_ubicacion.dart';
import 'package:movil/ubicacion/ubicacion.dart';

import 'apoyo/falsos.dart';

/// Respuesta típica de Nominatim para el centro de Aguascalientes.
const _nominatimCentro = {
  'road': 'Avenida Francisco I. Madero',
  'house_number': '120',
  'neighbourhood': 'Zona Centro',
  'postcode': '20000',
  'city': 'Aguascalientes',
  'state': 'Aguascalientes',
  'ISO3166-2-lvl4': 'MX-AGU',
};

void main() {
  group('dentroDeAguascalientes (mismo contorno que el backend)', () {
    test('puntos del estado', () {
      expect(dentroDeAguascalientes(21.8824, -102.2826), isTrue, reason: 'centro de Aguascalientes');
      expect(dentroDeAguascalientes(21.8467, -102.7186), isTrue, reason: 'Calvillo');
      expect(dentroDeAguascalientes(21.9614, -102.3436), isTrue, reason: 'Jesús María');
    });

    test('puntos de fuera, aunque estén dentro del rectángulo', () {
      expect(dentroDeAguascalientes(19.4326, -99.1332), isFalse, reason: 'CDMX');
      expect(dentroDeAguascalientes(22.7709, -102.5833), isFalse, reason: 'Zacatecas');
      expect(dentroDeAguascalientes(21.1250, -101.6860), isFalse, reason: 'León');
      expect(dentroDeAguascalientes(21.70, -101.90), isFalse, reason: 'esquina del rectángulo, fuera del estado');
    });
  });

  group('direccion_gps (igual que direccionGps.ts de la web)', () {
    test('interpreta la respuesta de Nominatim', () {
      final d = interpretarDireccion(Map<String, dynamic>.from(_nominatimCentro));
      expect(d[CampoReporte.calle], 'Avenida Francisco I. Madero');
      expect(d[CampoReporte.numeroExterior], '120');
      expect(d[CampoReporte.colonia], 'Zona Centro');
      expect(d[CampoReporte.codigoPostal], '20000');
      expect(d[CampoReporte.municipio], 'Aguascalientes');
    });

    test('municipio con prefijo y sin acentos; C.P. de otro estado se descarta', () {
      final d = interpretarDireccion({'county': 'Municipio de Jesus Maria', 'postcode': '64000'});
      expect(d[CampoReporte.municipio], 'Jesús María');
      expect(d.containsKey(CampoReporte.codigoPostal), isFalse);
    });

    test('reconoce si la dirección es de Aguascalientes', () {
      expect(estaEnAguascalientes(Map<String, dynamic>.from(_nominatimCentro)), isTrue);
      expect(estaEnAguascalientes({'state': 'Jalisco'}), isFalse);
    });

    test('no pisa lo escrito a mano; lo que no trae el punto se vacía (menos el municipio)', () {
      final sugerencia = {CampoReporte.calle: 'Madero', CampoReporte.colonia: 'Centro'};
      final cambios = cambiosPorDireccion(sugerencia, {CampoReporte.calle});
      expect(cambios.containsKey(CampoReporte.calle), isFalse, reason: 'la calle la escribió a mano');
      expect(cambios[CampoReporte.colonia], 'Centro');
      expect(cambios[CampoReporte.numeroExterior], '', reason: 'no dejar el número de la casa anterior');
      expect(cambios.containsKey(CampoReporte.municipio), isFalse);

      final forzado = cambiosPorDireccion(sugerencia, {CampoReporte.calle}, forzar: true);
      expect(forzado[CampoReporte.calle], 'Madero');
    });
  });

  group('AfinadorGps (como afinarGps.ts)', () {
    LecturaGps l(double precision) => LecturaGps(lat: 21.88, lng: -102.28, precision: precision);

    test('se queda con la más precisa y para al llegar a ±15 m', () async {
      final mejoras = <double>[];
      final r = await AfinadorGps().afinar(
        Stream.fromIterable([l(120), l(40), l(50), l(12), l(5)]),
        alMejorar: (x) => mejoras.add(x.precision),
      );
      expect(r.mejor!.precision, 12);
      expect(r.fin, FinAfinado.objetivo);
      expect(mejoras, [120, 40, 12], reason: 'la de 50 no es mejor que 40');
    });

    test('al llegar al tiempo límite usa la mejor que tenga', () async {
      final c = StreamController<LecturaGps>();
      final futuro = AfinadorGps(limite: const Duration(milliseconds: 80)).afinar(c.stream);
      c.add(l(70));
      final r = await futuro;
      expect(r.fin, FinAfinado.tiempo);
      expect(r.mejor!.precision, 70);
      await c.close();
    });

    test('si el GPS falla antes de cualquier lectura, el error sale', () async {
      final futuro = AfinadorGps().afinar(Stream<LecturaGps>.error(Exception('sin permiso')));
      await expectLater(futuro, throwsA(isA<Exception>()));
    });

    test('"usar ya" termina con la mejor hasta ese momento', () async {
      final c = StreamController<LecturaGps>();
      final afinador = AfinadorGps();
      final futuro = afinador.afinar(c.stream);
      c.add(l(35));
      await Future<void>.delayed(Duration.zero);
      afinador.terminar();
      final r = await futuro;
      expect(r.mejor!.precision, 35);
      expect(r.fin, FinAfinado.manual);
      await c.close();
    });
  });

  group('BorradorReporte con ubicación', () {
    test('la solicitud lleva latitud/longitud y se guarda en el celular', () async {
      final almacen = AlmacenBorradorEnMemoria();
      final b = BorradorReporte.nuevo(almacen)
        ..ponerUbicacion(const Ubicacion(lat: 21.8824, lng: -102.2826, precision: 9, fuente: FuenteUbicacion.gps))
        ..marcarEditado(CampoReporte.calle);
      expect(b.aSolicitud()['latitud'], 21.8824);
      expect(b.aSolicitud()['longitud'], -102.2826);

      await Future<void>.delayed(Duration.zero); // deja terminar el guardado
      final reabierto = await BorradorReporte.cargar(almacen);
      expect(reabierto.ubicacion!.precision, 9);
      expect(reabierto.ubicacion!.fuente, FuenteUbicacion.gps);
      expect(reabierto.editadosGps, contains(CampoReporte.calle));
    });

    test('sin ubicación se mandan null (el backend la acepta opcional)', () {
      final s = BorradorReporte.nuevo(AlmacenBorradorEnMemoria()).aSolicitud();
      expect(s['latitud'], isNull);
      expect(s['longitud'], isNull);
    });
  });

  group('formulario: «Mi ubicación»', () {
    testWidgets('pone el punto y llena la dirección SIN pisar lo escrito a mano', (tester) async {
      final b = await abrirFormulario(
        tester,
        gps: FuenteGpsFalsa(lecturas: [const LecturaGps(lat: 21.8824, lng: -102.2826, precision: 9)]),
        geocodificador: GeocodificadorFalso(DireccionEncontrada(interpretarDireccion(Map.of(_nominatimCentro)))),
      );

      await tester.enterText(find.byKey(const Key('campo-colonia')), 'Mi colonia');
      await tester.tap(find.byKey(PantallaNuevoReporte.llaveGpsFormulario));
      await tester.pumpAndSettle();

      expect(b.ubicacion, isNotNull);
      expect(b.ubicacion!.fuente, FuenteUbicacion.gps);
      expect(b.campo(CampoReporte.calle), 'Avenida Francisco I. Madero');
      expect(b.campo(CampoReporte.codigoPostal), '20000');
      expect(b.campo(CampoReporte.colonia), 'Mi colonia', reason: 'la escribió a mano: no se pisa');
      expect(find.text('Con GPS, ±9 m'), findsOneWidget);

      // "Volver a llenar" sí la reemplaza
      await tester.tap(find.text('Volver a llenar la dirección'));
      await tester.pumpAndSettle();
      expect(b.campo(CampoReporte.colonia), 'Zona Centro');
    });

    testWidgets('sin permiso de ubicación sale el modal y no se pone punto', (tester) async {
      final b = await abrirFormulario(tester, permisos: PermisosFalsos(respuestas: [EstadoPermiso.denegado]));

      await tester.tap(find.byKey(PantallaNuevoReporte.llaveGpsFormulario));
      await tester.pumpAndSettle();

      expect(find.text('Se necesita tu ubicación'), findsOneWidget);
      expect(find.byKey(DialogoPermiso.llaveAjustes), findsOneWidget);
      expect(b.ubicacion, isNull);
    });

    testWidgets('con la ubicación del celular apagada, ofrece prenderla', (tester) async {
      final gps = FuenteGpsFalsa(activo: false);
      await abrirFormulario(tester, gps: gps);

      await tester.tap(find.byKey(PantallaNuevoReporte.llaveGpsFormulario));
      await tester.pumpAndSettle();
      expect(find.text('La ubicación está apagada'), findsOneWidget);

      await tester.tap(find.text('Prender ubicación'));
      await tester.pumpAndSettle();
      expect(gps.ajustesAbiertos, 1);
    });

    testWidgets('al abrir, si YA hay permiso, se ubica solo (como la web)', (tester) async {
      final b = await abrirFormulario(
        tester,
        ubicarAlAbrir: true,
        gps: FuenteGpsFalsa(lecturas: [const LecturaGps(lat: 21.8824, lng: -102.2826, precision: 12)]),
      );
      await tester.pumpAndSettle();
      expect(b.ubicacion, isNotNull);
    });
  });

  group('pantalla del mapa', () {
    ResultadoUbicacion? resultado;

    Future<void> abrirMapa(WidgetTester tester, Ubicacion inicial, Geocodificador geo) async {
      resultado = null;
      await tester.pumpWidget(MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () async {
                  resultado = await PantallaElegirUbicacion.abrir(
                    context,
                    inicial: inicial,
                    permisos: PermisosFalsos(estado: EstadoPermiso.concedido),
                    gps: FuenteGpsFalsa(),
                    geocodificador: geo,
                    conMosaicos: false,
                  );
                },
                child: const Text('abrir'),
              ),
            ),
          ),
        ),
      ));
      await tester.tap(find.text('abrir'));
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 1)); // espera a que se busque la dirección
      await tester.pumpAndSettle();
    }

    testWidgets('muestra la dirección del punto y «Usar este punto» la regresa', (tester) async {
      final geo = GeocodificadorFalso(DireccionEncontrada(interpretarDireccion(Map.of(_nominatimCentro))));
      await abrirMapa(tester, const Ubicacion(lat: 21.8824, lng: -102.2826), geo);

      expect(find.textContaining('Avenida Francisco I. Madero 120'), findsOneWidget);
      expect(geo.consultas, greaterThanOrEqualTo(1));

      await tester.tap(find.byKey(PantallaElegirUbicacion.llaveUsar));
      await tester.pumpAndSettle();

      final r = resultado;
      expect(r, isNotNull);
      expect(r!.ubicacion.lat, closeTo(21.8824, 1e-4));
      expect(r.ubicacion.lng, closeTo(-102.2826, 1e-4));
      expect(r.ubicacion.fuente, FuenteUbicacion.mapa);
      expect(r.direccion?[CampoReporte.calle], 'Avenida Francisco I. Madero');
    });

    testWidgets('un punto fuera del estado no se puede confirmar', (tester) async {
      await abrirMapa(tester, const Ubicacion(lat: 21.70, lng: -101.90), GeocodificadorFalso());

      final boton = tester.widget<ButtonStyleButton>(find.byKey(PantallaElegirUbicacion.llaveUsar));
      expect(boton.onPressed, isNull);
      expect(find.text('Este punto está fuera de Aguascalientes.'), findsOneWidget);
    });
  });
}
