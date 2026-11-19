import 'package:flutter/material.dart';

/// Logotipo oficial de MIAA (el mismo de la web: frontend/public/logo-miaa.svg).
/// assets/imagenes/logo_miaa.png viene en 1x, 2.0x y 3.0x: Flutter toma el que va con la pantalla.
class LogoMiaa extends StatelessWidget {
  const LogoMiaa({super.key, this.alto = 48});

  final double alto;

  static const llave = Key('logo-miaa');

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      'assets/imagenes/logo_miaa.png',
      key: llave,
      height: alto,
      fit: BoxFit.contain,
      semanticLabel: 'MIAA, Modelo Integral de Aguas de Aguascalientes',
    );
  }
}
