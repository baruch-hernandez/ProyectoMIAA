import 'package:flutter/material.dart';

import 'auth/pantalla_login.dart';
import 'auth/sesion.dart';
import 'inicio/pantalla_inicio.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Antes de dibujar: leer el token guardado (si sigue vigente, entra directo a Inicio)
  final sesion = await Sesion.iniciar();
  runApp(AppMiaa(sesion: sesion));
}

/// Colores de la web (frontend/src/index.css): marino #074376, azul #4476AB.
const _marino = Color(0xFF074376);

class AppMiaa extends StatelessWidget {
  const AppMiaa({super.key, required this.sesion});

  final Sesion sesion;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MIAA Notificador',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: _marino, primary: _marino),
        useMaterial3: true,
      ),
      // La "puerta": con sesión → Inicio; sin sesión → Login. Cambia sola cuando Sesion avisa.
      home: ListenableBuilder(
        listenable: sesion,
        builder: (context, _) => sesion.conSesion
            ? PantallaInicio(key: ValueKey(sesion.usuario?.id), sesion: sesion)
            : PantallaLogin(sesion: sesion),
      ),
    );
  }
}
