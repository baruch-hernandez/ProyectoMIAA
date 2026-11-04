import 'package:flutter/material.dart';

import 'foto_evidencia.dart';
import 'procesador_fotos.dart';

/// Lo que decidió el notificador al revisar la foto.
enum DecisionVistaPrevia { repetir, confirmar }

/// Tareas 2.3, 2.4 y 2.5: la foto en grande (con zoom) para revisar nitidez y que se lean
/// los dígitos del medidor, con "Repetir foto" y "Usar foto".
///
/// Muestra la foto YA COMPRIMIDA: lo que se ve aquí es exactamente lo que se enviará.
/// Regresar con la flecha atrás = descartarla sin repetir.
class PantallaVistaPrevia extends StatelessWidget {
  const PantallaVistaPrevia({super.key, required this.foto, required this.origen});

  final FotoProcesada foto;
  final OrigenFoto origen;

  static const llave = Key('vista-previa');
  static const llaveRepetir = Key('btn-repetir-foto');
  static const llaveConfirmar = Key('btn-confirmar-foto');
  static const llaveTarjetaGps = Key('tarjeta-gps');

  static Future<DecisionVistaPrevia?> abrir(BuildContext context, FotoProcesada foto, OrigenFoto origen) =>
      Navigator.of(context).push<DecisionVistaPrevia>(MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => PantallaVistaPrevia(foto: foto, origen: origen),
      ));

  @override
  Widget build(BuildContext context) {
    final esCamara = origen == OrigenFoto.camara;
    final kb = (foto.bytes.length / 1024).round();
    final hora = MaterialLocalizations.of(context).formatTimeOfDay(
      TimeOfDay.fromDateTime(foto.fechaCaptura.toLocal()),
    );

    return Scaffold(
      key: llave,
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text('Revisa la foto'),
      ),
      body: Column(
        children: [
          Expanded(
            child: Stack(
              children: [
                Positioned.fill(
                  child: InteractiveViewer(
                    minScale: 1,
                    maxScale: 6,
                    child: Center(
                      child: Image.memory(
                        foto.bytes,
                        fit: BoxFit.contain,
                        gaplessPlayback: true,
                        semanticLabel: 'Foto de evidencia para revisar',
                      ),
                    ),
                  ),
                ),
                if (esCamara || foto.gps != null)
                  Positioned(left: 12, right: 12, top: 12, child: _TarjetaGps(foto: foto)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Column(
              children: [
                const Text(
                  'Pellizca para hacer zoom: revisa que la foto no esté movida '
                  'y que los números del medidor se lean.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white),
                ),
                const SizedBox(height: 6),
                Text(
                  '${origen.etiqueta} · ${foto.ancho}×${foto.alto} · $kb KB · '
                  'tomada $hora (${foto.origenFecha.etiqueta})',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white60, fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  key: llaveRepetir,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Colors.white54),
                    minimumSize: const Size.fromHeight(52),
                  ),
                  onPressed: () => Navigator.of(context).pop(DecisionVistaPrevia.repetir),
                  icon: const Icon(Icons.refresh),
                  label: Text(esCamara ? 'Repetir foto' : 'Elegir otra'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  key: llaveConfirmar,
                  style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
                  onPressed: () => Navigator.of(context).pop(DecisionVistaPrevia.confirmar),
                  icon: const Icon(Icons.check),
                  label: const Text('Usar foto'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Tarea 3.3: lo que quedó registrado con la foto: punto, margen de error y hora (UTC y local).
/// Una foto de interior puede no traer punto: entonces se dice, y la hora se muestra igual.
class _TarjetaGps extends StatelessWidget {
  const _TarjetaGps({required this.foto});

  final FotoProcesada foto;

  @override
  Widget build(BuildContext context) {
    final gps = foto.gps;
    final utc = foto.fechaCaptura.toUtc();
    final local = foto.fechaCaptura.toLocal();
    const estilo = TextStyle(color: Colors.white, fontSize: 13);
    return IgnorePointer(
      child: DecoratedBox(
        key: PantallaVistaPrevia.llaveTarjetaGps,
        decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.7), borderRadius: BorderRadius.circular(8)),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (gps == null)
                const Text('Sin coordenadas: no hubo señal GPS utilizable.', style: estilo)
              else ...[
                Text('Lat ${gps.lat.toStringAsFixed(7)}  ·  Lng ${gps.lng.toStringAsFixed(7)}', style: estilo),
                Text('Margen de error: ±${gps.precision.toStringAsFixed(1)} m', style: estilo),
              ],
              Text('Hora: ${_hms(local)} local  ·  ${_hms(utc)} UTC', style: estilo),
              Text(origenDeLaHora(foto.desfaseRelojMs), style: const TextStyle(color: Colors.white70, fontSize: 12)),
            ],
          ),
        ),
      ),
    );
  }

  static String _hms(DateTime f) => [f.hour, f.minute, f.second].map((n) => n.toString().padLeft(2, '0')).join(':');
}

/// De dónde salió la hora, para el notificador. [desfaseMs] = servidor − celular.
String origenDeLaHora(int? desfaseMs) {
  if (desfaseMs == null) return 'Hora del celular: no se pudo verificar con el servidor.';
  if (desfaseMs == 0) return 'Hora verificada con el servidor.';
  final d = Duration(milliseconds: desfaseMs.abs());
  final cuanto = d.inMinutes >= 1 ? '${d.inMinutes} min' : '${d.inSeconds} s';
  return 'Hora del servidor: el reloj del celular iba $cuanto ${desfaseMs > 0 ? 'atrasado' : 'adelantado'}.';
}
