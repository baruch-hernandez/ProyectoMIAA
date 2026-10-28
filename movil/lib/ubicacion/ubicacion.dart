/// De dónde salió el punto del domicilio.
enum FuenteUbicacion {
  gps,
  mapa;

  static FuenteUbicacion desdeNombre(String? n) =>
      FuenteUbicacion.values.firstWhere((f) => f.name == n, orElse: () => FuenteUbicacion.mapa);
}

/// El punto del domicilio que se manda en el reporte (latitud/longitud del backend).
class Ubicacion {
  const Ubicacion({required this.lat, required this.lng, this.precision, this.fuente = FuenteUbicacion.mapa});

  final double lat;
  final double lng;

  /// Radio de error del GPS en metros (±). null si se eligió a mano en el mapa.
  final double? precision;
  final FuenteUbicacion fuente;

  Map<String, dynamic> aJson() => {
        'lat': lat,
        'lng': lng,
        if (precision != null) 'precision': precision,
        'fuente': fuente.name,
      };

  factory Ubicacion.desdeJson(Map<String, dynamic> j) => Ubicacion(
        lat: (j['lat'] as num).toDouble(),
        lng: (j['lng'] as num).toDouble(),
        precision: (j['precision'] as num?)?.toDouble(),
        fuente: FuenteUbicacion.desdeNombre(j['fuente'] as String?),
      );

  @override
  String toString() => '${lat.toStringAsFixed(6)}, ${lng.toStringAsFixed(6)}';
}

/// Una lectura del GPS.
class LecturaGps {
  const LecturaGps({required this.lat, required this.lng, required this.precision});

  final double lat;
  final double lng;

  /// Radio de error en metros (±). Entre más chico, mejor.
  final double precision;
}
