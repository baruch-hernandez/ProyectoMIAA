import 'package:flutter_test/flutter_test.dart';
import 'package:movil/permisos/servicio_permisos.dart';
import 'package:movil/presencia/latido.dart';
import 'package:movil/ubicacion/ubicacion.dart';

import 'apoyo/falsos.dart';

/// El latido manda la ubicación al mapa del admin SOLO si ya hay permiso y GPS, sin preguntar nada.
void main() {
  const punto = LecturaGps(lat: 21.88, lng: -102.29, precision: 8);

  test('con permiso y GPS prendido entrega las lecturas', () async {
    final lecturas = await lecturasSiHayPermiso(
      permisos: PermisosFalsos(estado: EstadoPermiso.concedido),
      gps: FuenteGpsFalsa(lecturas: [punto, punto]),
    ).toList();
    expect(lecturas, hasLength(2));
    expect(lecturas.first.lat, 21.88);
  });

  test('sin permiso no lee el GPS ni muestra el diálogo', () async {
    final permisos = PermisosFalsos();
    final lecturas = await lecturasSiHayPermiso(permisos: permisos, gps: FuenteGpsFalsa(lecturas: [punto])).toList();
    expect(lecturas, isEmpty);
    expect(permisos.solicitudes, 0);
  });

  test('con la ubicación del celular apagada no entrega nada', () async {
    final lecturas = await lecturasSiHayPermiso(
      permisos: PermisosFalsos(estado: EstadoPermiso.concedido),
      gps: FuenteGpsFalsa(lecturas: [punto], activo: false),
    ).toList();
    expect(lecturas, isEmpty);
  });
}
