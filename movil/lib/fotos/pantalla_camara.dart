import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import 'foto_evidencia.dart';

/// Tarea 3.1: cámara integrada en la app (no la app de cámara del sistema).
///
/// - Cámara trasera a 1080p (ResolutionPreset.veryHigh): sobra para el mínimo HD del backend y
///   para leer un medidor; la compresión final la hace ProcesadorFotos.
/// - Tocar la imagen enfoca en ese punto (los medidores suelen estar cerca y en sombra).
/// - Flash: apagado → automático → linterna (útil dentro de un nicho oscuro).
/// - El archivo temporal que crea la cámara se borra en cuanto se leen sus bytes.
class PantallaCamara extends StatefulWidget {
  const PantallaCamara({super.key});

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

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _iniciar();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
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
    } else if (estado == AppLifecycleState.resumed && control == null) {
      _iniciar();
    }
  }

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
    setState(() => _tomando = true);
    try {
      final momento = DateTime.now();
      final archivo = await control.takePicture();
      final bytes = await archivo.readAsBytes();
      // Limpiar el temporal: la foto ya está en memoria y, si se confirma, se guarda aparte.
      try {
        await File(archivo.path).delete();
      } catch (_) {
        // si no se pudo borrar, Android limpia la caché solo
      }
      if (!mounted) return;
      Navigator.of(context).pop(FotoCruda(bytes: bytes, nombre: archivo.name, momentoObturador: momento));
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
              const Text(
                'Encuadra el domicilio o el medidor. Toca la imagen para enfocar.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white70),
              ),
              const SizedBox(height: 12),
              Semantics(
                button: true,
                label: 'Tomar foto',
                child: GestureDetector(
                  key: const Key('btn-obturador'),
                  onTap: _disparar,
                  child: Container(
                    width: 76,
                    height: 76,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 4),
                    ),
                    padding: const EdgeInsets.all(5),
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: _tomando ? Colors.white54 : Colors.white,
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
