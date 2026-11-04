import 'dart:async';
import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../core/plataforma.dart';
import '../core/reloj.dart';
import '../ubicacion/fuente_gps.dart';
import '../ubicacion/reglas_gps.dart';
import '../ubicacion/ubicacion.dart';
import 'foto_evidencia.dart';

/// Tarea 3.1: cámara integrada en la app (no la app de cámara del sistema).
///
/// - Cámara trasera a 1080p (ResolutionPreset.veryHigh): sobra para el mínimo HD del backend y
///   para leer un medidor; la compresión final la hace ProcesadorFotos.
/// - Tocar la imagen enfoca en ese punto (los medidores suelen estar cerca y en sombra).
/// - Flash: apagado → automático → linterna (útil dentro de un nicho oscuro).
/// - El archivo temporal que crea la cámara se borra en cuanto se leen sus bytes.
/// - Historia 3: semáforo del GPS y obturador bloqueado hasta tener el punto exacto
///   (ReglasGps); cada foto sale con su lectura GPS y la hora del servidor. Bajo techo, pasada
///   la espera máxima se suman wifi/antenas y la foto se puede tomar aunque sea sin coordenadas.
class PantallaCamara extends StatefulWidget {
  const PantallaCamara({super.key, this.gps = const FuenteGpsDispositivo()});

  final FuenteGps gps;

  /// Abre la cámara y regresa la foto tomada, o null si se cerró sin tomar.
  static Future<FotoCruda?> abrir(BuildContext context) => Navigator.of(context).push<FotoCruda>(
        MaterialPageRoute(fullscreenDialog: true, builder: (_) => const PantallaCamara()),
      );

  @override
  State<PantallaCamara> createState() => _PantallaCamaraState();
}

class _PantallaCamaraState extends State<PantallaCamara> with WidgetsBindingObserver {
  static const _modosFlash = [FlashMode.off, FlashMode.auto, FlashMode.torch];

  CameraController? _control;
  String? _error;
  bool _tomando = false;
  bool _iniciando = false;
  int _flash = 0;
  Offset? _puntoEnfoque;

  StreamSubscription<LecturaGps>? _subGps;
  LecturaGps? _lectura;
  DateTime? _lecturaEn;
  DateTime _esperandoDesde = DateTime.now();
  final _ventana = VentanaGps();
  bool _gpsApagado = false;
  bool _gpsAproximado = false;
  bool _ahorro = false;
  bool _revisando = false;

  /// Wifi y antenas, además del chip GPS, que sigue afinando (el chip no dio el punto a tiempo).
  StreamSubscription<LecturaGps>? _subRespaldo;

  /// Redibuja cada segundo: la lectura "envejece" y la espera máxima se cumple sin eventos.
  Timer? _tic;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _iniciar();
    _revisarGps();
    _tic = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {});
      if (WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed) _revisarGps();
      // Interiores: el chip GPS no ve satélites; wifi y antenas sí dan un punto (menos preciso)
      final esperando = DateTime.now().difference(_esperandoDesde);
      if (_subRespaldo == null && _subGps != null && esperando >= ReglasGps.esperaMaxima && _gpsParaFoto() == null) {
        _subRespaldo = _escuchar(satelital: false);
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _tic?.cancel();
    _detenerGps();
    _control?.dispose();
    super.dispose();
  }

  /// Android libera la cámara cuando la app se va al fondo: se suelta y se vuelve a abrir.
  @override
  void didChangeAppLifecycleState(AppLifecycleState estado) {
    final control = _control;
    if (estado == AppLifecycleState.inactive && control != null) {
      setState(() => _control = null);
      control.dispose();
      _detenerGps();
    } else if (estado == AppLifecycleState.resumed && control == null) {
      _iniciar();
      _revisarGps();
    }
  }

  /// Tareas 1.3 y 1.4: revisa el GPS del celular al abrir, al volver de Ajustes y cada segundo
  /// (la ubicación y el ahorro de batería se cambian desde la barra, sin salir de la app).
  /// Con todo en orden escucha el chip satelital; si algo falla, deja de escuchar y bloquea.
  Future<void> _revisarGps() async {
    if (_revisando) return;
    _revisando = true;
    final gps = widget.gps;
    var activo = false;
    var precisa = true;
    var ahorro = false;
    try {
      activo = await gps.servicioActivo();
      if (activo) {
        precisa = await gps.esPrecisa();
        ahorro = await gps.ahorroEnergia();
      }
    } catch (_) {
      activo = false;
    }
    _revisando = false;
    if (!mounted) return;
    final listo = activo && precisa && !ahorro;
    final arrancar = listo && _subGps == null;
    if (!listo) _detenerGps();
    setState(() {
      _gpsApagado = !activo;
      _gpsAproximado = !precisa;
      _ahorro = ahorro;
      if (arrancar) {
        _lectura = null;
        _ventana.limpiar();
        _esperandoDesde = DateTime.now();
      }
    });
    if (arrancar) _subGps = _escuchar(satelital: true);
  }

  StreamSubscription<LecturaGps> _escuchar({required bool satelital}) => widget.gps.lecturas(satelital: satelital).listen(
        (l) {
          if (!l.precision.isFinite || l.precision <= 0) return; // Android manda 0 si no sabe la precisión
          if (mounted) {
            setState(() {
              final ahora = DateTime.now();
              _lectura = l;
              _lecturaEn = ahora;
              _ventana.agregar(l, ahora);
            });
          }
        },
        onError: (Object _) {
          if (mounted) setState(() => _gpsApagado = true); // p. ej. apagaron la ubicación
        },
      );

  void _detenerGps() {
    unawaited(_subGps?.cancel());
    unawaited(_subRespaldo?.cancel());
    _subGps = null;
    _subRespaldo = null;
  }

  Duration get _edadLectura => _lecturaEn == null ? Duration.zero : DateTime.now().difference(_lecturaEn!);

  /// Lo que se graba con la foto (null = va sin coordenadas).
  LecturaGps? _gpsParaFoto() => lecturaParaFoto(_mejorLectura(), edad: _edadLectura);

  LecturaGps? _mejorLectura() => _ventana.mejor(DateTime.now()) ?? _lectura;

  /// null = ya se puede tomar la foto. Con la ubicación apagada nunca: si no, apagarla sería el atajo.
  String? _motivoGps() =>
      bloqueoDeHardware(gpsApagado: _gpsApagado, aproximada: _gpsAproximado, ahorro: _ahorro) ??
      motivoParaEsperar(
        _mejorLectura(),
        edad: _edadLectura,
        esperando: DateTime.now().difference(_esperandoDesde),
      );

  Future<void> _iniciar() async {
    if (_iniciando) return;
    _iniciando = true;
    if (_error != null) setState(() => _error = null);
    try {
      final camaras = await availableCameras();
      if (camaras.isEmpty) {
        if (mounted) setState(() => _error = 'Este dispositivo no tiene cámara.');
        return;
      }
      final trasera = camaras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
        orElse: () => camaras.first,
      );
      final control = CameraController(
        trasera,
        ResolutionPreset.veryHigh,
        enableAudio: false,
        imageFormatGroup: ImageFormatGroup.jpeg,
      );
      await control.initialize();
      if (!mounted) {
        await control.dispose();
        return;
      }
      try {
        await control.setFlashMode(_modosFlash[_flash]);
      } on CameraException {
        // sin flash: no pasa nada
      }
      setState(() => _control = control);
    } on CameraException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.code == 'CameraAccessDenied'
          ? 'La app no tiene permiso de cámara.'
          : 'No se pudo abrir la cámara (${e.description ?? e.code}).');
    } finally {
      _iniciando = false;
    }
  }

  Future<void> _cambiarFlash() async {
    final control = _control;
    if (control == null) return;
    final siguiente = (_flash + 1) % _modosFlash.length;
    try {
      await control.setFlashMode(_modosFlash[siguiente]);
      setState(() => _flash = siguiente);
    } on CameraException {
      _avisar('Esta cámara no tiene flash.');
    }
  }

  Future<void> _enfocar(TapUpDetails toque, BoxConstraints area) async {
    final control = _control;
    if (control == null) return;
    final punto = Offset(
      (toque.localPosition.dx / area.maxWidth).clamp(0.0, 1.0).toDouble(),
      (toque.localPosition.dy / area.maxHeight).clamp(0.0, 1.0).toDouble(),
    );
    setState(() => _puntoEnfoque = toque.localPosition);
    try {
      await control.setFocusPoint(punto);
      await control.setExposurePoint(punto);
    } on CameraException {
      // algunas cámaras no soportan enfoque por punto
    }
  }

  Future<void> _disparar() async {
    final control = _control;
    if (control == null || !control.value.isInitialized || _tomando || control.value.isTakingPicture) return;
    if (_motivoGps() != null) return; // 3.2: sin el punto exacto no hay foto
    // 2.1: el punto y la hora se fijan al tocar el botón, no cuando la cámara termina de guardar
    final lectura = _gpsParaFoto();
    setState(() => _tomando = true);
    try {
      final momento = RelojServidor.ahora(arranqueMs: await Plataforma.arranqueMs());
      final desfase = RelojServidor.desfaseDe(momento)?.inMilliseconds;
      final archivo = await control.takePicture();
      final bytes = await archivo.readAsBytes();
      // Limpiar el temporal: la foto ya está en memoria y, si se confirma, se guarda aparte.
      try {
        await File(archivo.path).delete();
      } catch (_) {
        // si no se pudo borrar, Android limpia la caché solo
      }
      if (!mounted) return;
      Navigator.of(context).pop(FotoCruda(
        bytes: bytes,
        nombre: archivo.name,
        momentoObturador: momento,
        gps: lectura,
        desfaseRelojMs: desfase,
      ));
    } on CameraException catch (e) {
      _avisar('No se pudo tomar la foto (${e.description ?? e.code}).');
    } finally {
      if (mounted) setState(() => _tomando = false);
    }
  }

  void _avisar(String texto) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(texto)));
  }

  @override
  Widget build(BuildContext context) {
    final control = _control;
    final motivo = _motivoGps();
    final listo = motivo == null && control != null;
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text('Tomar foto'),
        actions: [
          IconButton(
            tooltip: 'Flash',
            onPressed: control == null ? null : _cambiarFlash,
            icon: Icon(switch (_modosFlash[_flash]) {
              FlashMode.auto => Icons.flash_auto,
              FlashMode.torch => Icons.highlight,
              _ => Icons.flash_off,
            }),
          ),
        ],
      ),
      body: _error != null
          ? _Error(texto: _error!, alReintentar: _iniciar)
          : control == null || !control.value.isInitialized
              ? const Center(child: CircularProgressIndicator(color: Colors.white))
              : Center(
                  child: CameraPreview(
                    control,
                    child: LayoutBuilder(
                      builder: (context, area) => GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTapUp: (toque) => _enfocar(toque, area),
                        child: Stack(
                          children: [
                            const _GuiaEncuadre(),
                            if (_puntoEnfoque != null)
                              Positioned(
                                left: _puntoEnfoque!.dx - 28,
                                top: _puntoEnfoque!.dy - 28,
                                child: const IgnorePointer(child: _MarcaEnfoque()),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _IndicadorGps(
                lectura: _edadLectura <= ReglasGps.lecturaVieja ? _mejorLectura() : null,
                paraFoto: _gpsParaFoto(),
                motivo: motivo,
                alAjustar: _gpsApagado || _gpsAproximado
                    ? () => widget.gps.abrirAjustesUbicacion()
                    : _ahorro
                        ? () => widget.gps.abrirAjustesAhorro()
                        : null,
              ),
              const SizedBox(height: 8),
              const Text(
                'Encuadra el domicilio o el medidor. Toca la imagen para enfocar.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white70),
              ),
              const SizedBox(height: 12),
              Semantics(
                button: true,
                enabled: listo,
                label: 'Tomar foto',
                child: GestureDetector(
                  key: const Key('btn-obturador'),
                  onTap: listo ? _disparar : null,
                  child: Container(
                    width: 76,
                    height: 76,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: listo ? Colors.white : Colors.white38, width: 4),
                    ),
                    padding: const EdgeInsets.all(5),
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: !listo || _tomando ? Colors.white38 : Colors.white,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Tarea 3.1: semáforo de precisión (verde ≤ 1 m, amarillo 1–5 m, rojo > 5 m) + qué falta.
/// El color nunca va solo: el texto dice lo mismo para quien no distingue colores.
class _IndicadorGps extends StatelessWidget {
  const _IndicadorGps({required this.lectura, required this.paraFoto, required this.motivo, this.alAjustar});

  /// La última lectura, si es reciente (para el color).
  final LecturaGps? lectura;

  /// La que se grabaría con la foto.
  final LecturaGps? paraFoto;
  final String? motivo;
  final VoidCallback? alAjustar;

  @override
  Widget build(BuildContext context) {
    final p = lectura?.precision;
    final color = p == null
        ? Colors.grey
        : switch (semaforoDe(p)) {
            Semaforo.verde => Colors.green,
            Semaforo.amarillo => Colors.amber,
            Semaforo.rojo => Colors.red,
          };
    return Semantics(
      liveRegion: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: [
            Icon(Icons.circle, color: color, size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                motivo ??
                    (paraFoto != null
                        ? 'GPS listo: ±${paraFoto!.precision.toStringAsFixed(1)} m'
                        : 'Sin señal precisa (¿interior?): la foto se guardará sin coordenadas.'),
                style: const TextStyle(color: Colors.white),
              ),
            ),
            if (alAjustar != null) TextButton(onPressed: alAjustar, child: const Text('Abrir ajustes')),
          ],
        ),
      ),
    );
  }
}

/// Marco al centro para que el medidor quede grande y derecho.
class _GuiaEncuadre extends StatelessWidget {
  const _GuiaEncuadre();

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Center(
        child: FractionallySizedBox(
          widthFactor: 0.8,
          child: AspectRatio(
            aspectRatio: 4 / 3,
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white.withValues(alpha: 0.8), width: 2),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MarcaEnfoque extends StatelessWidget {
  const _MarcaEnfoque();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 56,
      height: 56,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: Colors.amber, width: 2),
      ),
    );
  }
}

class _Error extends StatelessWidget {
  const _Error({required this.texto, required this.alReintentar});

  final String texto;
  final VoidCallback alReintentar;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.no_photography, color: Colors.white70, size: 48),
            const SizedBox(height: 12),
            Text(texto, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white)),
            const SizedBox(height: 16),
            OutlinedButton(onPressed: alReintentar, child: const Text('Reintentar')),
          ],
        ),
      ),
    );
  }
}
