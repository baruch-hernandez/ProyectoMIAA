import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'carga.dart';

/// Pantalla de carga de MIAA: una gota que se llena de agua mientras el notificador espera al
/// servidor (Carga.pendientes > 0). Es la misma que la web (GotaCarga.tsx).
///  - No aparece si la respuesta llega antes de [retraso] (no parpadea con lo rápido).
///  - Mientras espera, el agua sube poco a poco sin llegar arriba (no sabemos cuánto falta);
///    al terminar se llena y se desvanece.
///  - Tapa la pantalla para que no se mande dos veces lo mismo.
/// Va en MaterialApp.builder, encima de todas las pantallas.
class CapaCarga extends StatefulWidget {
  const CapaCarga({super.key, required this.child});

  final Widget child;

  static const llave = Key('gota-carga');
  static const retraso = Duration(milliseconds: 300);

  @override
  State<CapaCarga> createState() => _CapaCargaState();
}

enum _Fase { oculta, llenando, llena }

class _CapaCargaState extends State<CapaCarga> with SingleTickerProviderStateMixin {
  static const _tope = 0.9;
  static const _paso = Duration(milliseconds: 120);
  static const _llena = Duration(milliseconds: 350);
  static const _marino = Color(0xFF074376);

  late final AnimationController _ola =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1400));
  _Fase _fase = _Fase.oculta;
  double _nivel = 0;
  Timer? _espera;
  Timer? _subir;
  Timer? _salida;

  @override
  void initState() {
    super.initState();
    Carga.pendientes.addListener(_cambio);
    _cambio();
  }

  void _cambio() {
    final esperando = Carga.pendientes.value > 0;
    if (esperando && _fase == _Fase.oculta) {
      _espera ??= Timer(CapaCarga.retraso, _mostrar);
    } else if (!esperando) {
      _espera?.cancel();
      _espera = null;
      if (_fase == _Fase.llenando) _terminar();
    }
  }

  void _mostrar() {
    _espera = null;
    if (!mounted || Carga.pendientes.value == 0) return;
    setState(() {
      _fase = _Fase.llenando;
      _nivel = 0.08;
    });
    if (!MediaQuery.disableAnimationsOf(context)) _ola.repeat();
    _subir = Timer.periodic(_paso, (_) => setState(() => _nivel += (_tope - _nivel) * 0.035));
  }

  void _terminar() {
    _subir?.cancel();
    setState(() {
      _fase = _Fase.llena;
      _nivel = 1;
    });
    _salida = Timer(_llena, () {
      if (!mounted) return;
      _ola.stop();
      setState(() => _fase = _Fase.oculta);
      _cambio(); // si llegó otra petición mientras se desvanecía, vuelve a aparecer
    });
  }

  @override
  void dispose() {
    Carga.pendientes.removeListener(_cambio);
    _espera?.cancel();
    _subir?.cancel();
    _salida?.cancel();
    _ola.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        widget.child, // siempre en el mismo lugar: la gota se pone encima sin reconstruir la app
        if (_fase != _Fase.oculta)
          Positioned.fill(
            child: AnimatedOpacity(
              opacity: _fase == _Fase.llena ? 0 : 1,
              duration: const Duration(milliseconds: 300),
              child: Stack(
                children: [
                  const ModalBarrier(dismissible: false, color: Color(0xB3FFFFFF)),
                  Center(
                    child: Semantics(
                      key: CapaCarga.llave,
                      liveRegion: true,
                      label: 'Cargando',
                      child: Material(
                        type: MaterialType.transparency,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            TweenAnimationBuilder<double>(
                              tween: Tween(end: _nivel),
                              duration: const Duration(milliseconds: 300),
                              curve: Curves.easeOut,
                              builder: (context, nivel, _) => AnimatedBuilder(
                                animation: _ola,
                                builder: (context, _) => CustomPaint(
                                  size: const Size(76, 112),
                                  painter: _PintorGota(nivel: nivel, fase: _ola.value),
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            const Text('Cargando…',
                                style: TextStyle(color: _marino, fontSize: 14, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

/// La gota: punta arriba y abajo medio círculo (mismas medidas que la web: 80×118).
class _PintorGota extends CustomPainter {
  _PintorGota({required this.nivel, required this.fase});

  /// 0 = vacía, 1 = llena.
  final double nivel;

  /// 0..1: dónde va la ola (se mueve de lado).
  final double fase;

  static Path _forma(double e) => Path()
    ..moveTo(40 * e, 2 * e)
    ..cubicTo(40 * e, 20 * e, 78 * e, 52 * e, 78 * e, 78 * e)
    ..arcToPoint(Offset(2 * e, 78 * e), radius: Radius.circular(38 * e))
    ..cubicTo(2 * e, 52 * e, 40 * e, 20 * e, 40 * e, 2 * e)
    ..close();

  @override
  void paint(Canvas canvas, Size size) {
    final e = size.width / 80; // escala de las medidas de diseño
    final forma = _forma(e);
    canvas.drawPath(forma, Paint()..color = const Color(0xFFEEF6FB));

    canvas.save();
    canvas.clipPath(forma);
    final arriba = size.height * (1 - nivel);
    final agua = Path()..moveTo(0, arriba);
    for (double x = 0; x <= size.width; x += 2) {
      // Ola de 40 de largo y 3 de alto (como la de la web)
      agua.lineTo(x, arriba + 3 * e * math.sin(2 * math.pi * (x / (40 * e) - fase)));
    }
    agua
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(
      agua,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF22BCFF), Color(0xFF074376)],
        ).createShader(Offset.zero & size),
    );
    canvas.restore();

    canvas.drawPath(
      forma,
      Paint()
        ..color = const Color(0xFF074376)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3 * e
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(_PintorGota antes) => antes.nivel != nivel || antes.fase != fase;
}
