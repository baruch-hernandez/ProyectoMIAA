import 'package:flutter/material.dart';

import 'auth/api_cuenta.dart';
import 'auth/pantalla_login.dart';
import 'auth/pantalla_requisitos.dart';
import 'auth/sesion.dart';
import 'inicio/pantalla_inicio.dart';
import 'presencia/barra_ubicacion.dart';

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
      // Indicador "GPS" encima de todas las pantallas mientras se comparte la ubicación
      builder: (context, navegador) => BarraUbicacion(child: navegador!),
      // La "puerta": sin sesión → Login; con contraseña temporal o aviso pendiente → Requisitos;
      // si no → Inicio. Cambia sola cuando Sesion avisa.
      home: ListenableBuilder(
        listenable: sesion,
        builder: (context, _) {
          final u = sesion.usuario;
          if (!sesion.conSesion || u == null) return PantallaLogin(sesion: sesion);
          if (u.tieneRequisitos) {
            return PantallaRequisitos(
              key: ValueKey('requisitos-${u.id}'),
              api: ApiCuenta(sesion.api),
              nombre: u.nombre,
              alTerminar: () => sesion.marcarRequisitos(pendientes: false),
              alSalir: sesion.salir,
            );
          }
          return PantallaInicio(key: ValueKey(u.id), sesion: sesion);
        },
      ),
    );
  }
}
