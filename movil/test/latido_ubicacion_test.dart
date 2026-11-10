import 'package:flutter_test/flutter_test.dart';
import 'package:movil/permisos/servicio_permisos.dart';
import 'package:movil/presencia/latido.dart';
import 'package:movil/ubicacion/ubicacion.dart';

import 'apoyo/falsos.dart';

/// El latido manda la ubicación al mapa del admin SOLO si ya hay permiso y GPS, sin preguntar nada.
void main() {
  const punto = LecturaGps(lat: 21.88, lng: -102.29, precision: 8);

  test('con permiso y GPS prendido regresa la lectura', () async {
    final l = await posicionSiHayPermiso(
      permisos: PermisosFalsos(estado: EstadoPermiso.concedido),
      gps: FuenteGpsFalsa(lecturas: [punto]),
    );
    expect(l?.lat, 21.88);
  });

  test('sin permiso no lee el GPS ni muestra el diálogo', () async {
    final permisos = PermisosFalsos();
    final l = await posicionSiHayPermiso(permisos: permisos, gps: FuenteGpsFalsa(lecturas: [punto]));
    expect(l, isNull);
    expect(permisos.solicitudes, 0);
  });

  test('con la ubicación del celular apagada o sin lecturas regresa null', () async {
    final permisos = PermisosFalsos(estado: EstadoPermiso.concedido);
    expect(await posicionSiHayPermiso(permisos: permisos, gps: FuenteGpsFalsa(lecturas: [punto], activo: false)), isNull);
    expect(await posicionSiHayPermiso(permisos: permisos, gps: FuenteGpsFalsa()), isNull);
  });
}
