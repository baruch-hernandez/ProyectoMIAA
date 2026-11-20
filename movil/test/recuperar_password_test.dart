// "¿Olvidaste tu contraseña?": pedir el código, escribirlo con la contraseña nueva y ver el error del servidor.
//   flutter test test/recuperar_password_test.dart
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:movil/auth/pantalla_recuperar_password.dart';
import 'package:movil/core/api.dart';

typedef P = PantallaRecuperarPassword;

void main() {
  // Una sola Api para todo el archivo, creada fuera de testWidgets: Api.crear carga el certificado de
  // desarrollo con rootBundle, que lo guarda en caché; desde la 2.ª prueba esa carga quedaba colgada.
  late Api api;
  final peticiones = <String>[];

  /// Servidor falso: anota cada petición y responde 204, o 400 si el código es "999999".
  setUpAll(() async {
    api = await Api.crear(token: () => null, alExpirar: (_) {});
    api.dio.interceptors.add(InterceptorsWrapper(onRequest: (o, h) {
      peticiones.add('${o.path} ${o.data}');
      if ((o.data as Map)['codigo'] == '999999') {
        h.reject(DioException(
          requestOptions: o,
          response: Response(requestOptions: o, statusCode: 400,
              data: {'status': 400, 'message': 'El código no es correcto o ya venció. Pide uno nuevo.'}),
        ));
      } else {
        h.resolve(Response(requestOptions: o, statusCode: 204));
      }
    }));
  });
  setUp(peticiones.clear);

  Future<void> llenarCodigo(WidgetTester tester, String codigo) async {
    await tester.enterText(find.byKey(P.llaveCodigo), codigo);
    await tester.enterText(find.byKey(P.llaveNueva), 'nueva456');
    await tester.enterText(find.byKey(P.llaveConfirmar), 'nueva456');
    await tester.pump();
  }

  testWidgets('pide el código con el usuario del login y cambia la contraseña', (tester) async {
    await tester.pumpWidget(MaterialApp(home: P(api: api, usuario: 'juan')));

    await tester.tap(find.byKey(P.llavePedir));
    await tester.pumpAndSettle();
    expect(peticiones, ['/auth/password/olvide {usuario: juan}']);

    expect(tester.widget<FilledButton>(find.byKey(P.llaveCambiar)).onPressed, isNull, reason: 'sin código no se puede');
    await llenarCodigo(tester, '123456');
    await tester.tap(find.byKey(P.llaveCambiar));
    await tester.pumpAndSettle();

    expect(peticiones.last, '/auth/password/restablecer {usuario: juan, codigo: 123456, nueva: nueva456}');
    expect(find.text('Tu contraseña se cambió. Ya puedes entrar con ella.'), findsOneWidget);
  });

  testWidgets('un código equivocado muestra el mensaje del servidor y deja intentarlo otra vez', (tester) async {
    await tester.pumpWidget(MaterialApp(home: P(api: api, usuario: 'juan')));
    await tester.tap(find.byKey(P.llavePedir));
    await tester.pumpAndSettle();

    await llenarCodigo(tester, '999999');
    await tester.tap(find.byKey(P.llaveCambiar));
    await tester.pumpAndSettle();

    expect(find.text('El código no es correcto o ya venció. Pide uno nuevo.'), findsOneWidget);
    expect(find.byKey(P.llaveCambiar), findsOneWidget, reason: 'sigue en el paso del código');
  });
}
