import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/api.dart';
import '../fotos/foto_evidencia.dart';
import '../fotos/fuentes_fotos.dart';
import '../fotos/pantalla_camara.dart';
import '../fotos/pantalla_vista_previa.dart';
import '../fotos/procesador_fotos.dart';
import '../permisos/dialogo_permiso.dart';
import '../permisos/servicio_permisos.dart';
import '../ubicacion/afinador_gps.dart';
import '../ubicacion/direccion_gps.dart';
import '../ubicacion/fuente_gps.dart';
import '../ubicacion/geocodificador.dart';
import '../ubicacion/mapa_ags.dart';
import '../ubicacion/pantalla_elegir_ubicacion.dart';
import '../ubicacion/ubicacion.dart';
import 'almacen_borrador.dart';
import 'borrador_reporte.dart';

/// Manda el reporte al backend (en la app real: ApiReportes.crear).
typedef EnviarReporte = Future<void> Function(Map<String, dynamic> solicitud);

/// Abre la cámara y regresa la foto tomada (en la app real: PantallaCamara.abrir).
typedef AbrirCamara = Future<FotoCruda?> Function(BuildContext context);

/// Formulario del reporte de domicilio con sus fotos de evidencia.
///
/// Todo lo que viene "de afuera" (permisos, cámara, galería, procesamiento, GPS, mapa, envío)
/// entra por el constructor: así las pruebas usan versiones falsas sin celular ni backend.
class PantallaNuevoReporte extends StatefulWidget {
  const PantallaNuevoReporte({
    super.key,
    required this.borrador,
    required this.enviar,
    this.permisos = const ServicioPermisosAndroid(),
    this.fuente,
    this.procesador = const ProcesadorFotos(),
    this.abrirCamara = PantallaCamara.abrir,
    this.gps,
    this.geocodificador,
    this.ubicarAlAbrir = true,
    this.conMosaicos = true,
  });

  final BorradorReporte borrador;
  final EnviarReporte enviar;
  final ServicioPermisos permisos;

  /// null = galería y explorador reales del celular.
  final FuenteFotos? fuente;
  final ProcesadorFotos procesador;
  final AbrirCamara abrirCamara;

  /// null = GPS real (geolocator).
  final FuenteGps? gps;

  /// null = Nominatim (OpenStreetMap).
  final Geocodificador? geocodificador;

  /// Como la web: al abrir, si ya hay permiso de ubicación y no hay punto, se ubica solo.
  final bool ubicarAlAbrir;

  /// false en las pruebas: los mapas no descargan mosaicos.
  final bool conMosaicos;

  static const llaveGpsFormulario = Key('btn-ubicar-gps');
  static const llaveMapaFormulario = Key('btn-elegir-mapa');
  static const llaveEnviar = Key('btn-enviar-reporte');
  static const llaveAvisoFoto = Key('aviso-falta-foto');
  static const llaveCamara = Key('btn-foto-camara');
  static const llaveGaleria = Key('btn-foto-galeria');
  static const llaveArchivos = Key('btn-foto-archivos');

  /// Carga el borrador guardado en el celular y abre la pantalla. Regresa true si se envió.
  static Future<bool?> abrir(BuildContext context, {required EnviarReporte enviar}) async {
    final borrador = await BorradorReporte.cargar(AlmacenBorradorArchivos());
    if (!context.mounted) {
      borrador.dispose();
      return null;
    }
    final enviado = await Navigator.of(context).push<bool>(MaterialPageRoute(
      builder: (_) => PantallaNuevoReporte(borrador: borrador, enviar: enviar),
    ));
    borrador.dispose();
    return enviado;
  }

  @override
  State<PantallaNuevoReporte> createState() => _PantallaNuevoReporteState();
}

class _PantallaNuevoReporteState extends State<PantallaNuevoReporte> {
  final _form = GlobalKey<FormState>();
  late final Map<String, TextEditingController> _textos = {
    for (final c in CampoReporte.todos)
      if (c != CampoReporte.municipio) c: TextEditingController(text: widget.borrador.campo(c)),
  };
  late final FuenteFotos _fuente = widget.fuente ?? FuenteFotosDispositivo();
  bool _procesando = false;
  bool _enviando = false;

  late final FuenteGps _gps = widget.gps ?? const FuenteGpsDispositivo();
  late final Geocodificador _geocodificador = widget.geocodificador ?? GeocodificadorNominatim();
  final _afinador = AfinadorGps();
  bool _ubicando = false;
  double? _precisionUbicando;

  /// La última dirección que dio el mapa (para "Volver a llenar").
  DireccionGps? _sugerencia;

  BorradorReporte get _b => widget.borrador;

  @override
  void initState() {
    super.initState();
    if (widget.ubicarAlAbrir && _b.ubicacion == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _ubicarSiYaHayPermiso());
    }
  }

  @override
  void dispose() {
    _afinador.cancelar();
    for (final c in _textos.values) {
      c.dispose();
    }
    super.dispose();
  }

  // ------------------------------------------------------------------ ubicación del domicilio

  /// Al abrir: solo si el permiso YA está dado (no se interrumpe con un diálogo al entrar).
  Future<void> _ubicarSiYaHayPermiso() async {
    final estado = await widget.permisos.consultar(TipoPermiso.ubicacion);
    if (mounted && estado.permitido) await _ubicarConGps();
  }

  /// «Mi ubicación»: afina el GPS, pone el punto y llena la dirección sin pisar lo escrito a mano.
  Future<void> _ubicarConGps() async {
    if (_ubicando) {
      _afinador.terminar(); // "usar ya" la mejor lectura
      return;
    }
    setState(() {
      _ubicando = true;
      _precisionUbicando = null;
    });
    final mejor = await ubicarConGps(
      context,
      permisos: widget.permisos,
      gps: _gps,
      afinador: _afinador,
      alMejorar: (l) {
        if (mounted) setState(() => _precisionUbicando = l.precision);
      },
    );
    if (!mounted) return;
    setState(() => _ubicando = false);
    if (mejor == null) return;
    _b.ponerUbicacion(Ubicacion(lat: mejor.lat, lng: mejor.lng, precision: mejor.precision, fuente: FuenteUbicacion.gps));
    await _llenarDireccion(mejor.lat, mejor.lng);
  }

  Future<void> _elegirEnMapa() async {
    _afinador.cancelar();
    final r = await PantallaElegirUbicacion.abrir(
      context,
      inicial: _b.ubicacion,
      permisos: widget.permisos,
      gps: _gps,
      geocodificador: _geocodificador,
      conMosaicos: widget.conMosaicos,
    );
    if (r == null || !mounted) return;
    _b.ponerUbicacion(r.ubicacion);
    final direccion = r.direccion;
    if (direccion != null) {
      _aplicarDireccion(direccion);
    } else {
      await _llenarDireccion(r.ubicacion.lat, r.ubicacion.lng);
    }
  }

  Future<void> _llenarDireccion(double lat, double lng) async {
    try {
      final r = await _geocodificador.direccionDe(lat, lng);
      if (!mounted) return;
      switch (r) {
        case DireccionEncontrada(:final direccion):
          _aplicarDireccion(direccion);
        case SinDireccion():
          _avisar('El mapa no tiene la dirección de este punto: escríbela a mano.');
        case FueraDeAgs():
          _avisar('Según el mapa el punto no es de Aguascalientes: revisa que sea la casa correcta.');
      }
    } catch (_) {
      _avisar('No se pudo obtener la dirección (¿sin internet?). Llénala a mano.');
    }
  }

  /// Llena los campos que el notificador NO ha escrito a mano. Con [forzar] los llena todos.
  void _aplicarDireccion(DireccionGps direccion, {bool forzar = false}) {
    final cambios = cambiosPorDireccion(direccion, _b.editadosGps, forzar: forzar);
    cambios.forEach((campo, valor) {
      _textos[campo]?.text = valor; // el municipio no tiene controlador: es la lista
      _b.ponerCampo(campo, valor);
    });
    if (forzar) _b.olvidarEditados();
    setState(() => _sugerencia = direccion);
    final llenos = cambios.values.where((v) => v.isNotEmpty).length;
    if (llenos > 0) {
      _avisar(cambios[CampoReporte.numeroExterior]?.isEmpty ?? false
          ? 'Dirección llenada con el mapa. Escribe el número exterior.'
          : 'Dirección llenada con el mapa. Revísala.');
    }
  }

  void _quitarUbicacion() {
    _afinador.cancelar();
    _b.ponerUbicacion(null);
  }

  void _avisar(String texto) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(texto)));
  }

  /// Tareas 3.1–3.3 + 2.3–2.5: permiso → cámara/galería/archivos → procesar → vista previa →
  /// repetir (vuelve a abrir la misma fuente) o confirmar (se fija al borrador).
  Future<void> _agregarFoto(OrigenFoto origen) async {
    if (_procesando || _enviando) return;
    if (_b.completoDeFotos) {
      _avisar('Ya tienes ${ReglasFoto.maxFotos} fotos. Quita una para agregar otra.');
      return;
    }

    // El explorador de archivos (Storage Access Framework) no necesita permiso:
    // el notificador elige el archivo y Android solo le da acceso a ese.
    if (origen != OrigenFoto.archivos) {
      final tipo = origen == OrigenFoto.camara ? TipoPermiso.camara : TipoPermiso.galeria;
      final hayPermiso = await asegurarPermiso(context, widget.permisos, tipo);
      if (!hayPermiso) return;
    }

    while (true) {
      if (!mounted) return;
      final momento = DateTime.now();

      FotoCruda? cruda;
      try {
        cruda = switch (origen) {
          OrigenFoto.camara => await widget.abrirCamara(context),
          OrigenFoto.galeria => await _fuente.desdeGaleria(),
          OrigenFoto.archivos => await _fuente.desdeArchivos(),
        };
      } on FotoInvalida catch (e) {
        _avisar(e.mensaje);
        return;
      } catch (e) {
        _avisar('No se pudo abrir ${origen.etiqueta.toLowerCase()} ($e).');
        return;
      }
      if (cruda == null || !mounted) return; // canceló

      setState(() => _procesando = true);
      FotoProcesada? procesada;
      String? problema;
      try {
        procesada = await widget.procesador.procesar(EntradaFoto.desde(cruda, momentoSeleccion: momento));
      } on FotoInvalida catch (e) {
        problema = e.mensaje;
      } catch (e) {
        problema = 'No se pudo preparar la foto ($e).';
      }
      if (!mounted) return;
      setState(() => _procesando = false);
      if (procesada == null) {
        _avisar(problema ?? 'No se pudo preparar la foto.');
        return;
      }

      final decision = await PantallaVistaPrevia.abrir(context, procesada, origen);
      if (!mounted) return;
      if (decision == DecisionVistaPrevia.repetir) continue; // 2.4: se descarta y se reabre
      if (decision != DecisionVistaPrevia.confirmar) return; // regresó sin decidir: se descarta

      try {
        await _b.agregarFoto(procesada, origen); // 2.5
        _avisar('Foto agregada (${_b.fotos.length}/${ReglasFoto.maxFotos}).');
      } on FotoInvalida catch (e) {
        _avisar(e.mensaje);
      }
      return;
    }
  }

  Future<void> _quitarFoto(FotoEvidencia foto) async {
    await _b.quitarFoto(foto.id);
    _avisar('Foto quitada.');
  }

  Future<void> _enviar() async {
    if (!_b.puedeEnviar || _enviando) return;
    if (!(_form.currentState?.validate() ?? false)) {
      _avisar('Revisa los campos marcados en rojo.');
      return;
    }
    setState(() => _enviando = true);
    try {
      await widget.enviar(_b.aSolicitud());
      await _b.limpiar();
      if (!mounted) return;
      _avisar('Reporte enviado.');
      Navigator.of(context).pop(true);
    } catch (e) {
      _avisar(ApiError.de(e).mensaje);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  // ------------------------------------------------------------------ validaciones

  static String? Function(String) _obligatorio(String mensaje) => (v) => v.isEmpty ? mensaje : null;

  static String? _codigoPostal(String v) =>
      RegExp(r'^20\d{3}$').hasMatch(v) ? null : 'Debe ser un C.P. de Aguascalientes (20xxx)';

  static String? _descripcion(String v) =>
      v.length < 10 ? 'Describe el reporte (mínimo 10 caracteres)' : null;

  Widget _texto(
    String campo,
    String etiqueta, {
    String? Function(String)? validar,
    TextInputType? teclado,
    int largoMaximo = 150,
    bool multilinea = false,
    List<TextInputFormatter> formatos = const [],
    String? ayuda,
  }) {
    final regla = validar;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        key: Key('campo-$campo'),
        controller: _textos[campo],
        decoration: InputDecoration(
          labelText: etiqueta,
          helperText: ayuda,
          border: const OutlineInputBorder(),
        ),
        keyboardType: multilinea ? TextInputType.multiline : teclado,
        textInputAction: multilinea ? TextInputAction.newline : TextInputAction.next,
        minLines: multilinea ? 4 : 1,
        maxLines: multilinea ? 8 : 1,
        maxLength: multilinea ? largoMaximo : null,
        inputFormatters: [LengthLimitingTextInputFormatter(largoMaximo), ...formatos],
        onChanged: (v) {
          if (camposGps.contains(campo)) _b.marcarEditado(campo); // ya no lo pisa el GPS
          _b.ponerCampo(campo, v);
        },
        validator: regla == null ? null : (v) => regla((v ?? '').trim()),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _b,
      builder: (context, _) {
        final municipio = _b.campo(CampoReporte.municipio);
        return Scaffold(
          appBar: AppBar(title: const Text('Nuevo reporte')),
          body: AbsorbPointer(
            absorbing: _enviando,
            child: Form(
              key: _form,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                children: [
                  _SeccionFotos(
                    fotos: _b.fotos,
                    procesando: _procesando,
                    completo: _b.completoDeFotos,
                    alAgregar: _agregarFoto,
                    alQuitar: _quitarFoto,
                  ),
                  const SizedBox(height: 12),
                  _SeccionUbicacion(
                    ubicacion: _b.ubicacion,
                    ubicando: _ubicando,
                    precisionUbicando: _precisionUbicando,
                    haySugerencia: _sugerencia != null,
                    conMosaicos: widget.conMosaicos,
                    alGps: _ubicarConGps,
                    alMapa: _elegirEnMapa,
                    alQuitar: _quitarUbicacion,
                    alRellenar: () => _aplicarDireccion(_sugerencia!, forzar: true),
                  ),
                  const SizedBox(height: 20),
                  Text('Domicilio', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),
                  _texto(CampoReporte.calle, 'Calle', validar: _obligatorio('La calle es obligatoria')),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: _texto(CampoReporte.numeroExterior, 'Núm. exterior',
                            largoMaximo: 20, validar: _obligatorio('Obligatorio')),
                      ),
                      const SizedBox(width: 12),
                      Expanded(child: _texto(CampoReporte.numeroInterior, 'Núm. interior', largoMaximo: 20)),
                    ],
                  ),
                  _texto(CampoReporte.colonia, 'Colonia',
                      largoMaximo: 100, validar: _obligatorio('La colonia es obligatoria')),
                  _texto(
                    CampoReporte.codigoPostal,
                    'Código postal',
                    largoMaximo: 5,
                    teclado: TextInputType.number,
                    formatos: [FilteringTextInputFormatter.digitsOnly],
                    validar: _codigoPostal,
                  ),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: DropdownButtonFormField<String>(
                      // La llave cambia con el valor: así la lista se redibuja cuando el GPS lo llena
                      key: ValueKey('campo-municipio-$municipio'),
                      initialValue: municipiosAguascalientes.contains(municipio) ? municipio : municipiosAguascalientes.first,
                      decoration: const InputDecoration(labelText: 'Municipio', border: OutlineInputBorder()),
                      items: [
                        for (final m in municipiosAguascalientes) DropdownMenuItem(value: m, child: Text(m)),
                      ],
                      onChanged: (m) {
                        if (m == null) return;
                        _b.marcarEditado(CampoReporte.municipio);
                        _b.ponerCampo(CampoReporte.municipio, m);
                      },
                    ),
                  ),
                  _texto(CampoReporte.referencias, 'Referencias', largoMaximo: 255, ayuda: 'Opcional: entre qué calles, color de la casa…'),
                  _texto(CampoReporte.numeroContrato, 'Número de contrato', largoMaximo: 30, ayuda: 'Opcional'),
                  const SizedBox(height: 8),
                  Text('Descripción', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),
                  _texto(CampoReporte.descripcion, 'Qué se encontró', largoMaximo: 2000, multilinea: true, validar: _descripcion),
                ],
              ),
            ),
          ),
          bottomNavigationBar: SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (!_b.puedeEnviar)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        children: [
                          Icon(Icons.info_outline, size: 18, color: Theme.of(context).colorScheme.error),
                          const SizedBox(width: 6),
                          const Expanded(
                            child: Text(
                              'Agrega al menos una foto para poder enviar el reporte.',
                              key: PantallaNuevoReporte.llaveAvisoFoto,
                            ),
                          ),
                        ],
                      ),
                    ),
                  // Tarea 2.2: deshabilitado (onPressed: null) mientras no haya foto.
                  FilledButton.icon(
                    key: PantallaNuevoReporte.llaveEnviar,
                    style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
                    onPressed: _b.puedeEnviar && !_enviando && !_procesando ? _enviar : null,
                    icon: _enviando
                        ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.send),
                    label: Text(_enviando ? 'Enviando…' : 'Enviar reporte'),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _SeccionFotos extends StatelessWidget {
  const _SeccionFotos({
    required this.fotos,
    required this.procesando,
    required this.completo,
    required this.alAgregar,
    required this.alQuitar,
  });

  final List<FotoEvidencia> fotos;
  final bool procesando;
  final bool completo;
  final void Function(OrigenFoto origen) alAgregar;
  final void Function(FotoEvidencia foto) alQuitar;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final bloqueado = completo || procesando;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.photo_camera),
                const SizedBox(width: 8),
                Expanded(child: Text('Fotos de evidencia', style: tema.textTheme.titleMedium)),
                Text('${fotos.length}/${ReglasFoto.maxFotos}', style: tema.textTheme.labelLarge),
              ],
            ),
            const SizedBox(height: 8),
            if (fotos.isEmpty)
              const Text('Toma al menos una foto del domicilio o del medidor. Es obligatoria para enviar.')
            else
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [for (final f in fotos) _Miniatura(foto: f, alQuitar: () => alQuitar(f))],
              ),
            if (procesando) ...[
              const SizedBox(height: 12),
              const LinearProgressIndicator(),
              const SizedBox(height: 4),
              const Text('Preparando la foto…'),
            ],
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilledButton.icon(
                  key: PantallaNuevoReporte.llaveCamara,
                  onPressed: bloqueado ? null : () => alAgregar(OrigenFoto.camara),
                  icon: const Icon(Icons.photo_camera),
                  label: const Text('Cámara'),
                ),
                OutlinedButton.icon(
                  key: PantallaNuevoReporte.llaveGaleria,
                  onPressed: bloqueado ? null : () => alAgregar(OrigenFoto.galeria),
                  icon: const Icon(Icons.photo_library),
                  label: const Text('Galería'),
                ),
                OutlinedButton.icon(
                  key: PantallaNuevoReporte.llaveArchivos,
                  onPressed: bloqueado ? null : () => alAgregar(OrigenFoto.archivos),
                  icon: const Icon(Icons.folder_open),
                  label: const Text('Archivos'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Miniatura extends StatelessWidget {
  const _Miniatura({required this.foto, required this.alQuitar});

  final FotoEvidencia foto;
  final VoidCallback alQuitar;

  @override
  Widget build(BuildContext context) {
    final hora = MaterialLocalizations.of(context).formatTimeOfDay(
      TimeOfDay.fromDateTime(foto.fechaCaptura.toLocal()),
    );
    final estilo = Theme.of(context).textTheme.bodySmall;
    return SizedBox(
      key: Key('miniatura-${foto.id}'),
      width: 104,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.memory(foto.bytes, width: 104, height: 104, fit: BoxFit.cover, cacheWidth: 312),
              ),
              Positioned(
                top: 2,
                right: 2,
                child: Material(
                  color: Colors.black54,
                  shape: const CircleBorder(),
                  child: IconButton(
                    tooltip: 'Quitar foto',
                    visualDensity: VisualDensity.compact,
                    icon: const Icon(Icons.close, color: Colors.white, size: 18),
                    onPressed: alQuitar,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text('${foto.origen.etiqueta} · $hora', style: estilo, maxLines: 1, overflow: TextOverflow.ellipsis),
          Text('Hora: ${foto.origenFecha.clave}', style: estilo, maxLines: 1, overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }
}

class _SeccionUbicacion extends StatelessWidget {
  const _SeccionUbicacion({
    required this.ubicacion,
    required this.ubicando,
    required this.precisionUbicando,
    required this.haySugerencia,
    required this.conMosaicos,
    required this.alGps,
    required this.alMapa,
    required this.alQuitar,
    required this.alRellenar,
  });

  final Ubicacion? ubicacion;
  final bool ubicando;
  final double? precisionUbicando;
  final bool haySugerencia;
  final bool conMosaicos;
  final VoidCallback alGps;
  final VoidCallback alMapa;
  final VoidCallback alQuitar;
  final VoidCallback alRellenar;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final u = ubicacion;
    final precision = u?.precision;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.place),
                const SizedBox(width: 8),
                Expanded(child: Text('Ubicación del domicilio', style: tema.textTheme.titleMedium)),
                Text('Opcional', style: tema.textTheme.labelSmall),
              ],
            ),
            const SizedBox(height: 8),
            if (u == null)
              const Text('Ubica el domicilio: el administrador lo verá en el mapa y la dirección se llena sola.')
            else ...[
              VistaUbicacion(ubicacion: u, conMosaicos: conMosaicos),
              const SizedBox(height: 6),
              Text(
                u.fuente == FuenteUbicacion.gps && precision != null
                    ? 'Con GPS, ±${precision.round()} m'
                    : 'Marcado a mano en el mapa',
                style: tema.textTheme.bodySmall,
              ),
              if (precision != null && precision > precisionBajaM)
                Text(
                  'Precisión baja: puede ser otra casa de la cuadra. Ajústalo en el mapa.',
                  style: tema.textTheme.bodySmall?.copyWith(color: tema.colorScheme.error),
                ),
            ],
            if (ubicando) ...[
              const SizedBox(height: 12),
              const LinearProgressIndicator(),
              const SizedBox(height: 4),
              Text(precisionUbicando == null
                  ? 'Buscando tu ubicación…'
                  : 'Afinando tu ubicación: ±${precisionUbicando!.round()} m'),
            ],
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilledButton.tonalIcon(
                  key: PantallaNuevoReporte.llaveGpsFormulario,
                  onPressed: alGps,
                  icon: const Icon(Icons.my_location),
                  label: Text(ubicando ? 'Usar ya' : 'Mi ubicación'),
                ),
                OutlinedButton.icon(
                  key: PantallaNuevoReporte.llaveMapaFormulario,
                  onPressed: alMapa,
                  icon: const Icon(Icons.map),
                  label: Text(u == null ? 'Elegir en el mapa' : 'Ajustar en el mapa'),
                ),
                if (u != null)
                  TextButton.icon(onPressed: alQuitar, icon: const Icon(Icons.close), label: const Text('Quitar')),
                if (haySugerencia)
                  TextButton.icon(
                    onPressed: alRellenar,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Volver a llenar la dirección'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
