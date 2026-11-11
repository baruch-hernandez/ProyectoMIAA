// Contraseña temporal y aviso de privacidad antes de usar la app.
//   flutter test test/requisitos_cuenta_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:movil/auth/api_cuenta.dart';
import 'package:movil/auth/aviso_privacidad.dart';
import 'package:movil/auth/pantalla_requisitos.dart';
import 'package:movil/core/api.dart';

/// El backend simulado: le falta cambiar la contraseña y aceptar el aviso.
class ApiCuentaFalsa implements ApiCuenta {
  ApiCuentaFalsa({this.password = true, this.aviso = true, this.passwordCorrecta = 'MIAA-1234-abcd'});

  bool password;
  bool aviso;
  final String passwordCorrecta;
  String? nuevaRecibida;
  String? versionRecibida;

  Map<String, dynamic> get _cuenta =>
      {'nombre': 'Juan Pérez', 'debeCambiarPassword': password, 'avisoPrivacidadPendiente': aviso};

  @override
  Future<Map<String, dynamic>> yo() async => _cuenta;

  @override
  Future<Map<String, dynamic>> cambiarPassword(String actual, String nueva) async {
    if (actual != passwordCorrecta) throw ApiError('La contraseña actual no es correcta.', status: 400);
    nuevaRecibida = nueva;
    password = false;
    return _cuenta;
  }

  @override
  Future<Map<String, dynamic>> aceptarAviso(String version) async {
    versionRecibida = version;
    aviso = false;
    return _cuenta;
  }
}

Future<void> abrir(WidgetTester tester, ApiCuentaFalsa api, {VoidCallback? alTerminar}) async {
  await tester.binding.setSurfaceSize(const Size(800, 2400));
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(MaterialApp(
    home: PantallaRequisitos(api: api, nombre: 'Juan Pérez', alTerminar: alTerminar ?? () {}, alSalir: () {}),
  ));
  await tester.pumpAndSettle();
}

bool habilitado(WidgetTester tester, Key llave) => tester.widget<FilledButton>(find.byKey(llave)).onPressed != null;

void main() {
  test('las reglas son las del backend (PoliticaPassword)', () {
    bool cumple(String n) => reglasPassword(n, n).every((r) => r.$2);
    expect(cumple('abc12'), isFalse, reason: 'menos de 6');
    expect(cumple('abcdef'), isFalse, reason: 'sin número');
    expect(cumple('123456'), isFalse, reason: 'sin letra');
    expect(cumple('ñandú7'), isTrue, reason: 'letras con acento cuentan');
    expect(reglasPassword('abc123', 'abc124').last.$2, isFalse, reason: 'no coinciden');
  });

  testWidgets('cambia la contraseña temporal, acepta el aviso y entra', (tester) async {
    final api = ApiCuentaFalsa();
    var termino = false;
    await abrir(tester, api, alTerminar: () => termino = true);

    expect(find.text('Paso 1 de 2'), findsOneWidget);
    expect(find.text('Crea tu contraseña'), findsOneWidget);

    await tester.enterText(find.byKey(PantallaRequisitos.llaveActual), 'MIAA-1234-abcd');
    await tester.enterText(find.byKey(PantallaRequisitos.llaveNueva), 'secreta1');
    await tester.enterText(find.byKey(PantallaRequisitos.llaveConfirmar), 'secreta2');
    await tester.pump();
    expect(habilitado(tester, PantallaRequisitos.llaveGuardar), isFalse, reason: 'no coinciden');

    await tester.enterText(find.byKey(PantallaRequisitos.llaveConfirmar), 'secreta1');
    await tester.pump();
    await tester.tap(find.byKey(PantallaRequisitos.llaveGuardar));
    await tester.pumpAndSettle();
    expect(api.nuevaRecibida, 'secreta1');

    expect(find.text('Aviso de privacidad'), findsOneWidget);
    expect(habilitado(tester, PantallaRequisitos.llaveAceptar), isFalse, reason: 'sin marcar que lo leyó');
    await tester.tap(find.byKey(PantallaRequisitos.llaveLeido));
    await tester.pump();
    await tester.tap(find.byKey(PantallaRequisitos.llaveAceptar));
    await tester.pumpAndSettle();

    expect(api.versionRecibida, versionAviso);
    expect(termino, isTrue);
  });

  testWidgets('si la temporal está mal, muestra el mensaje del backend y no avanza', (tester) async {
    final api = ApiCuentaFalsa(aviso: false);
    await abrir(tester, api);

    await tester.enterText(find.byKey(PantallaRequisitos.llaveActual), 'equivocada');
    await tester.enterText(find.byKey(PantallaRequisitos.llaveNueva), 'secreta1');
    await tester.enterText(find.byKey(PantallaRequisitos.llaveConfirmar), 'secreta1');
    await tester.pump();
    await tester.tap(find.byKey(PantallaRequisitos.llaveGuardar));
    await tester.pumpAndSettle();

    expect(find.text('La contraseña actual no es correcta.'), findsOneWidget);
    expect(find.text('Crea tu contraseña'), findsOneWidget);
    expect(find.text('Paso 1 de 2'), findsNothing, reason: 'solo le falta un paso');
  });

  testWidgets('si el backend dice que ya no falta nada, entra directo', (tester) async {
    var termino = false;
    await tester.pumpWidget(MaterialApp(
      home: PantallaRequisitos(
        api: ApiCuentaFalsa(password: false, aviso: false),
        nombre: 'Juan',
        alTerminar: () => termino = true,
        alSalir: () {},
      ),
    ));
    await tester.pump(); // en la app, alTerminar cambia de pantalla; aquí se queda el indicador de carga
    expect(termino, isTrue);
  });
}
