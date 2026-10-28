import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart' show LatLng;

import 'limite_ags.dart';
import 'ubicacion.dart';

/// Igual que el botón de capas de la web: calles (OpenStreetMap) o satélite (Esri).
/// En satélite se ven los techos: lo más útil para poner el pin en la casa exacta.
enum CapaMapa { calles, satelite }

const _marino = Color(0xFF074376);
const _agenteMosaicos = 'mx.gob.miaa.movil'; // la política de OpenStreetMap pide identificarse

final centroAgs = LatLng(centroAgsLat, centroAgsLng);

final _contorno = [for (final p in contornoAgs) LatLng(p[0], p[1])];

/// Hasta dónde se puede mover el mapa: el estado + ~13 km de margen (como LIMITES_MAPA_AGS).
final limitesMapaAgs = LatLngBounds(
  LatLng(surAgs - 0.12, oesteAgs - 0.12),
  LatLng(norteAgs + 0.12, esteAgs + 0.12),
);

/// "Máscara": un rectángulo grande con el estado como HUECO; lo de fuera se ve sombreado.
final _mascara = [
  LatLng(surAgs - 2, oesteAgs - 2),
  LatLng(surAgs - 2, esteAgs + 2),
  LatLng(norteAgs + 2, esteAgs + 2),
  LatLng(norteAgs + 2, oesteAgs - 2),
];

/// Las capas de fondo de todos los mapas de la app: mosaicos + límite del estado.
/// [conMosaicos] = false en las pruebas (así no se descargan imágenes).
List<Widget> capasBaseAgs(CapaMapa capa, {bool conMosaicos = true}) => [
      if (conMosaicos && capa == CapaMapa.calles)
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: _agenteMosaicos,
          maxNativeZoom: 19,
        ),
      if (conMosaicos && capa == CapaMapa.satelite) ...[
        TileLayer(
          urlTemplate: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          userAgentPackageName: _agenteMosaicos,
          maxNativeZoom: 19,
        ),
        // Nombres de calles encima de la foto
        TileLayer(
          urlTemplate:
              'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
          userAgentPackageName: _agenteMosaicos,
          maxNativeZoom: 19,
        ),
      ],
      PolygonLayer(
        polygons: [
          Polygon(points: _mascara, holePointsList: [_contorno], color: _marino.withValues(alpha: 0.22)),
          Polygon(
            points: _contorno,
            borderColor: _marino,
            borderStrokeWidth: 2,
            pattern: StrokePattern.dashed(segments: [6, 6]),
          ),
        ],
      ),
    ];

/// Crédito de los mosaicos (obligatorio por licencia).
Widget atribucionMapa(CapaMapa capa) => SimpleAttributionWidget(
      source: Text(capa == CapaMapa.calles ? 'OpenStreetMap' : 'Esri, Maxar, Earthstar Geographics'),
    );

/// Círculo de precisión del GPS (el domicilio debería estar dentro).
Widget circuloPrecision(LatLng punto, double metros) => CircleLayer(
      circles: [
        CircleMarker(
          point: punto,
          radius: metros,
          useRadiusInMeter: true,
          color: const Color(0x2622BCFF),
          borderColor: const Color(0xFF1D6FB8),
          borderStrokeWidth: 1,
        ),
      ],
    );

/// El pin rojo, con la punta en el punto.
class PinUbicacion extends StatelessWidget {
  const PinUbicacion({super.key, this.tamano = 44});

  final double tamano;

  @override
  Widget build(BuildContext context) => Icon(
        Icons.location_on,
        size: tamano,
        color: const Color(0xFFD32F2F),
        shadows: const [Shadow(blurRadius: 4, color: Colors.black38, offset: Offset(0, 1))],
      );
}

/// Mapa chiquito de solo lectura para el formulario (como el detalle de la web).
class VistaUbicacion extends StatelessWidget {
  const VistaUbicacion({super.key, required this.ubicacion, this.alto = 170, this.conMosaicos = true});

  final Ubicacion ubicacion;
  final double alto;
  final bool conMosaicos;

  @override
  Widget build(BuildContext context) {
    final punto = LatLng(ubicacion.lat, ubicacion.lng);
    final precision = ubicacion.precision;
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: SizedBox(
        height: alto,
        child: FlutterMap(
          // Si cambia el punto, se arma un mapa nuevo centrado en él
          key: ValueKey('vista-${ubicacion.lat}-${ubicacion.lng}'),
          options: MapOptions(
            initialCenter: punto,
            initialZoom: 17,
            interactionOptions: const InteractionOptions(flags: InteractiveFlag.none),
          ),
          children: [
            ...capasBaseAgs(CapaMapa.calles, conMosaicos: conMosaicos),
            if (precision != null) circuloPrecision(punto, precision),
            MarkerLayer(markers: [
              Marker(
                point: punto,
                width: 36,
                height: 36,
                alignment: Alignment.topCenter,
                child: const PinUbicacion(tamano: 36),
              ),
            ]),
            if (conMosaicos) atribucionMapa(CapaMapa.calles),
          ],
        ),
      ),
    );
  }
}
