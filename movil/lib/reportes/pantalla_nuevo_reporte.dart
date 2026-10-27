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
import 'almacen_borrador.dart';
import 'borrador_reporte.dart';

/// Manda el reporte al backend (en la app real: ApiReportes.crear).
typedef EnviarReporte = Future<void> Function(Map<String, dynamic> solicitud);

/// Abre la cámara y regresa la foto tomada (en la app real: PantallaCamara.abrir).
typedef AbrirCamara = Future<FotoCruda?> Function(BuildContext context);

/// Formulario del reporte de domicilio con sus fotos de evidencia.
///
/// Todo lo que viene "de afuera" (permisos, cámara, galería, procesamiento, envío) entra por
/// el constructor: así las pruebas usan versiones falsas sin celular ni backend.
class PantallaNuevoReporte extends StatefulWidget {
  const PantallaNuevoReporte({
    super.key,
    required this.borrador,
    required this.enviar,
    this.permisos = const ServicioPermisosAndroid(),
    this.fuente,
    this.procesador = const ProcesadorFotos(),
    this.abrirCamara = PantallaCamara.abrir,
  });

  final BorradorReporte borrador;
  final EnviarReporte enviar;
  final ServicioPermisos permisos;

  /// null = galería y explorador reales del celular.
  final FuenteFotos? fuente;
  final ProcesadorFotos procesador;
  final AbrirCamara abrirCamara;

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

  BorradorReporte get _b => widget.borrador;

  @override
  void dispose() {
    for (final c in _textos.values) {
      c.dispose();
    }
    super.dispose();
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
        onChanged: (v) => _b.ponerCampo(campo, v),
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
                      key: const Key('campo-municipio'),
                      initialValue: municipiosAguascalientes.contains(municipio) ? municipio : municipiosAguascalientes.first,
                      decoration: const InputDecoration(labelText: 'Municipio', border: OutlineInputBorder()),
                      items: [
                        for (final m in municipiosAguascalientes) DropdownMenuItem(value: m, child: Text(m)),
                      ],
                      onChanged: (m) {
                        if (m != null) _b.ponerCampo(CampoReporte.municipio, m);
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
