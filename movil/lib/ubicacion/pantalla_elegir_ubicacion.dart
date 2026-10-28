import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart' show LatLng;

import '../permisos/dialogo_permiso.dart';
import '../permisos/servicio_permisos.dart';
import 'afinador_gps.dart';
import 'direccion_gps.dart';
import 'fuente_gps.dart';
import 'geocodificador.dart';
import 'limite_ags.dart';
import 'mapa_ags.dart';
import 'ubicacion.dart';

/// Lo que regresa la pantalla: el punto y, si se encontró, la dirección de ese punto.
class ResultadoUbicacion {
  const ResultadoUbicacion({required this.ubicacion, this.direccion});

  final Ubicacion ubicacion;
  final DireccionGps? direccion;
}

/// Con esta precisión (m) o peor, se avisa que puede ser otra casa de la cuadra (igual que la web).
const precisionBajaM = 60.0;

/// Pide permiso, revisa que la ubicación del celular esté prendida y afina el GPS.
/// Regresa la mejor lectura DENTRO del estado, o null (y ya avisó por qué).
/// Con [silencioso] (al abrir el formulario) no sale el diálogo de «ubicación apagada» ni el aviso
/// de «aproximada»: solo se intenta si todo está listo.
Future<LecturaGps?> ubicarConGps(
  BuildContext context, {
  required ServicioPermisos permisos,
  required FuenteGps gps,
  required AfinadorGps afinador,
  void Function(LecturaGps lectura)? alMejorar,
  bool silencioso = false,
}) async {
  void avisar(String texto) {
    if (context.mounted) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(texto)));
    }
  }

  // Todo va dentro del try: si un plugin truena, quien llama no se queda "ubicando" para siempre.
  try {
    if (!await asegurarPermiso(context, permisos, TipoPermiso.ubicacion)) return null;

    if (!await gps.servicioActivo()) {
      if (silencioso || !context.mounted) return null;
      final abrir = await showDialog<bool>(
        context: context,
        builder: (contexto) => AlertDialog(
          icon: const Icon(Icons.location_disabled, size: 36),
          title: const Text('La ubicación está apagada'),
          content: const Text('Prende «Ubicación» en el celular para encontrar el domicilio. '
              'También puedes marcar el punto a mano en el mapa.'),
          actions: [
            TextButton(onPressed: () => Navigator.of(contexto).pop(false), child: const Text('Ahora no')),
            FilledButton(onPressed: () => Navigator.of(contexto).pop(true), child: const Text('Prender ubicación')),
          ],
        ),
      );
      if (abrir == true) await gps.abrirAjustesUbicacion();
      return null;
    }

    if (!silencioso && !await gps.esPrecisa()) {
      avisar('Tienes la ubicación «aproximada»: activa «Usar ubicación precisa» en Ajustes → Ubicación.');
    }

    // Las lecturas fuera del estado ni entran al afinador: una loca pero precisa no tapa las buenas.
    var huboFuera = false;
    final dentro = gps.lecturas().where((l) {
      final ok = dentroDeAguascalientes(l.lat, l.lng);
      if (!ok) huboFuera = true;
      return ok;
    });
    final r = await afinador.afinar(dentro, alMejorar: alMejorar);
    final mejor = r.mejor;
    if (mejor == null) {
      if (huboFuera) {
        avisar('Tu ubicación sale fuera de Aguascalientes. Marca el punto a mano en el mapa.');
      } else if (r.fin != FinAfinado.manual) {
        avisar('No se encontró tu ubicación. Toca el mapa para marcar el punto o llena la dirección a mano.');
      }
      return null;
    }
    return mejor;
  } catch (_) {
    avisar('No se pudo leer el GPS. Toca el mapa para marcar el punto o llena la dirección a mano.');
    return null;
  }
}

/// Elegir el punto del domicilio en el mapa, como en la web (MapaUbicacion.tsx), adaptado al celular:
///  - el pin se queda fijo al CENTRO y se mueve el mapa debajo (más fácil con el dedo que arrastrar
///    un marcador); tocar el mapa también lleva el pin ahí;
///  - «Mi ubicación» afina el GPS hasta ±15 m y dibuja el círculo de precisión;
///  - lo de fuera del estado se ve sombreado y no se puede confirmar;
///  - al dejar de mover el mapa se busca la dirección del punto (Nominatim, 1 por segundo).
class PantallaElegirUbicacion extends StatefulWidget {
  const PantallaElegirUbicacion({
    super.key,
    this.inicial,
    required this.permisos,
    required this.gps,
    required this.geocodificador,
    this.conMosaicos = true,
  });

  final Ubicacion? inicial;
  final ServicioPermisos permisos;
  final FuenteGps gps;
  final Geocodificador geocodificador;
  final bool conMosaicos;

  static const llaveUsar = Key('btn-usar-punto');
  static const llaveGps = Key('btn-mi-ubicacion');
  static const llaveMapa = Key('mapa-elegir');

  static Future<ResultadoUbicacion?> abrir(
    BuildContext context, {
    Ubicacion? inicial,
    required ServicioPermisos permisos,
    required FuenteGps gps,
    required Geocodificador geocodificador,
    bool conMosaicos = true,
  }) =>
      Navigator.of(context).push<ResultadoUbicacion>(MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => PantallaElegirUbicacion(
          inicial: inicial,
          permisos: permisos,
          gps: gps,
          geocodificador: geocodificador,
          conMosaicos: conMosaicos,
        ),
      ));

  @override
  State<PantallaElegirUbicacion> createState() => _PantallaElegirUbicacionState();
}

class _PantallaElegirUbicacionState extends State<PantallaElegirUbicacion> {
  final _mapa = MapController();
  final _afinador = AfinadorGps();
  late LatLng _centro = widget.inicial == null ? centroAgs : LatLng(widget.inicial!.lat, widget.inicial!.lng);
  late double? _precision = widget.inicial?.precision;
  late FuenteUbicacion _fuente = widget.inicial?.fuente ?? FuenteUbicacion.mapa;
  CapaMapa _capa = CapaMapa.calles;
  bool _afinando = false;
  double? _precisionAfinando;

  /// Sin punto inicial, el centro de la ciudad NO es un punto elegido: hay que mover el mapa,
  /// tocarlo o usar el GPS antes de poder confirmarlo.
  late bool _elegido = widget.inicial != null;

  Timer? _espera;
  int _turno = 0;
  bool _buscando = false;
  ResultadoGeocodificacion? _direccion;
  LatLng? _puntoDireccion;
  String? _errorDireccion;

  bool get _dentro => dentroDeAguascalientes(_centro.latitude, _centro.longitude);

  @override
  void initState() {
    super.initState();
    if (widget.inicial != null) {
      _buscando = true;
      _espera = Timer(const Duration(milliseconds: 800), _buscar);
    }
  }

  @override
  void dispose() {
    _espera?.cancel();
    _afinador.cancelar();
    _mapa.dispose();
    super.dispose();
  }

  // ------------------------------------------------------------------ mover el pin

  void _alMover(MapCamera camara, bool porGesto) {
    // El mapa puede avisar mientras se está dibujando (al medir su tamaño): ahí no se puede
    // llamar setState, así que se deja para justo después del cuadro.
    if (SchedulerBinding.instance.schedulerPhase == SchedulerPhase.persistentCallbacks) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _aplicarMovimiento(camara.center, porGesto);
      });
    } else {
      _aplicarMovimiento(camara.center, porGesto);
    }
  }

  void _aplicarMovimiento(LatLng centro, bool porGesto) {
    if (centro == _centro && !porGesto) return;
    setState(() {
      _centro = centro;
      if (porGesto) {
        _elegido = true;
        _soltarGps(); // lo movieron con el dedo: ya no es el punto del GPS
      }
    });
    _programarBusqueda();
  }

  void _alTocar(TapPosition _, LatLng punto) {
    setState(() {
      _elegido = true;
      _soltarGps();
    });
    _mapa.move(punto, math.max(_mapa.camera.zoom, 17));
  }

  void _soltarGps() {
    _precision = null;
    _fuente = FuenteUbicacion.mapa;
    if (_afinando) _afinador.cancelar();
  }

  void _moverAGps(LecturaGps l) {
    final punto = LatLng(l.lat, l.lng);
    _mapa.move(punto, l.precision <= 30 ? 18 : 17);
    setState(() {
      _centro = punto;
      _elegido = true;
      _precision = l.precision;
      _fuente = FuenteUbicacion.gps;
      _precisionAfinando = l.precision;
    });
  }

  Future<void> _miUbicacion() async {
    if (_afinando) {
      _afinador.terminar(); // "Usar ya": se queda con la mejor lectura hasta ahora
      return;
    }
    setState(() {
      _afinando = true;
      _precisionAfinando = null;
    });
    final mejor = await ubicarConGps(
      context,
      permisos: widget.permisos,
      gps: widget.gps,
      afinador: _afinador,
      alMejorar: (l) {
        if (mounted) _moverAGps(l);
      },
    );
    if (!mounted) return;
    setState(() => _afinando = false);
    if (mejor != null) _moverAGps(mejor);
  }

  // ------------------------------------------------------------------ dirección del punto

  /// Espera a que dejen de mover el mapa antes de buscar (Nominatim permite 1 petición por segundo).
  void _programarBusqueda() {
    _espera?.cancel();
    _turno++;
    if (!_buscando || _direccion != null) {
      setState(() {
        _buscando = true;
        _errorDireccion = null;
      });
    }
    _espera = Timer(const Duration(milliseconds: 800), _buscar);
  }

  Future<void> _buscar() async {
    final turno = _turno;
    final punto = _centro;
    if (!dentroDeAguascalientes(punto.latitude, punto.longitude)) {
      setState(() {
        _buscando = false;
        _direccion = null;
        _puntoDireccion = null;
      });
      return;
    }
    try {
      final r = await widget.geocodificador.direccionDe(punto.latitude, punto.longitude);
      if (!mounted || turno != _turno) return; // ya movieron el mapa otra vez
      setState(() {
        _direccion = r;
        _puntoDireccion = punto;
        _buscando = false;
      });
    } catch (_) {
      if (!mounted || turno != _turno) return;
      setState(() {
        _buscando = false;
        _direccion = null;
        _errorDireccion = 'No se pudo obtener la dirección (¿sin internet?). '
            'Puedes usar el punto y escribirla a mano.';
      });
    }
  }

  void _confirmar() {
    final d = _direccion;
    Navigator.of(context).pop(ResultadoUbicacion(
      ubicacion: Ubicacion(
        lat: _centro.latitude,
        lng: _centro.longitude,
        precision: _precision,
        fuente: _fuente,
      ),
      // Solo si la dirección es de ESTE punto (no de uno anterior)
      direccion: d is DireccionEncontrada && _puntoDireccion == _centro ? d.direccion : null,
    ));
  }

  // ------------------------------------------------------------------ pantalla

  @override
  Widget build(BuildContext context) {
    final inicial = widget.inicial;
    final precision = _precision;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Ubicación del domicilio'),
        actions: [
          IconButton(
            tooltip: _capa == CapaMapa.calles ? 'Ver satélite' : 'Ver calles',
            icon: Icon(_capa == CapaMapa.calles ? Icons.satellite_alt : Icons.map),
            onPressed: () => setState(
              () => _capa = _capa == CapaMapa.calles ? CapaMapa.satelite : CapaMapa.calles,
            ),
          ),
        ],
      ),
      body: Stack(
        children: [
          FlutterMap(
            key: PantallaElegirUbicacion.llaveMapa,
            mapController: _mapa,
            options: MapOptions(
              initialCenter: _centro,
              initialZoom: inicial == null ? 13 : 17,
              minZoom: 9,
              maxZoom: 19,
              cameraConstraint: CameraConstraint.contain(bounds: limitesMapaAgs),
              interactionOptions: const InteractionOptions(flags: InteractiveFlag.all & ~InteractiveFlag.rotate),
              onTap: _alTocar,
              onPositionChanged: _alMover,
            ),
            children: [
              ...capasBaseAgs(_capa, conMosaicos: widget.conMosaicos),
              if (precision != null) circuloPrecision(_centro, precision),
              if (widget.conMosaicos) atribucionMapa(_capa),
            ],
          ),
          // El pin fijo al centro: su PUNTA marca el punto (por eso se sube medio tamaño)
          IgnorePointer(
            child: Center(
              child: Transform.translate(offset: const Offset(0, -22), child: const PinUbicacion()),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        key: PantallaElegirUbicacion.llaveGps,
        onPressed: _miUbicacion,
        icon: _afinando
            ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2))
            : const Icon(Icons.my_location),
        label: Text(_afinando
            ? (_precisionAfinando == null ? 'Buscando… (tocar = usar)' : '±${_precisionAfinando!.round()} m · usar ya')
            : 'Mi ubicación'),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _LineaDireccion(
                dentro: _dentro,
                buscando: _buscando,
                direccion: _direccion,
                error: _errorDireccion,
              ),
              const SizedBox(height: 4),
              Text(
                precision == null
                    ? 'Mueve el mapa o tócalo para poner el pin en la casa. En satélite se ven los techos.'
                    : 'GPS ±${precision.round()} m'
                        '${precision > precisionBajaM ? ' · precisión baja: puede ser otra casa de la cuadra' : ''}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                key: PantallaElegirUbicacion.llaveUsar,
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
                onPressed: _dentro && _elegido ? _confirmar : null,
                icon: const Icon(Icons.check),
                label: const Text('Usar este punto'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LineaDireccion extends StatelessWidget {
  const _LineaDireccion({required this.dentro, required this.buscando, required this.direccion, required this.error});

  final bool dentro;
  final bool buscando;
  final ResultadoGeocodificacion? direccion;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    if (!dentro) {
      return Row(children: [
        Icon(Icons.block, color: tema.colorScheme.error),
        const SizedBox(width: 8),
        const Expanded(child: Text('Este punto está fuera de Aguascalientes.')),
      ]);
    }
    if (buscando) {
      return const Row(children: [
        SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2)),
        SizedBox(width: 8),
        Expanded(child: Text('Buscando la dirección…')),
      ]);
    }
    final e = error;
    if (e != null) return Text(e);
    final d = direccion;
    final texto = switch (d) {
      DireccionEncontrada(:final direccion) when resumenDireccion(direccion).isNotEmpty => resumenDireccion(direccion),
      DireccionEncontrada() => 'El mapa no tiene la calle de este punto: escríbela a mano.',
      SinDireccion() => 'Aquí no hay calles en el mapa: escribe la dirección a mano.',
      FueraDeAgs() => 'Según el mapa este punto no es de Aguascalientes; revisa que sea la casa correcta.',
      null => 'Mueve el mapa para elegir el punto.',
    };
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(Icons.place_outlined),
        const SizedBox(width: 8),
        Expanded(child: Text(texto, style: tema.textTheme.bodyLarge)),
      ],
    );
  }
}
