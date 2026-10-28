import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/api.dart';
import '../permisos/servicio_permisos.dart';
import '../ubicacion/fuente_gps.dart';
import '../ubicacion/geocodificador.dart';
import '../ubicacion/mapa_ags.dart';
import '../ubicacion/pantalla_elegir_ubicacion.dart';
import '../ubicacion/ubicacion.dart';
import 'api_reportes.dart';
import 'borrador_reporte.dart';
import 'reglas_reporte.dart' as reglas;

/// Corregir domicilio, ubicación o descripción de un reporte propio en las primeras horas
/// (PUT /reportes/{id}), como EditarReporte.tsx de la web. Las fotos no se cambian aquí.
/// Regresa el reporte ya guardado (o null si no se guardó).
class PantallaEditarReporte extends StatefulWidget {
  const PantallaEditarReporte({
    super.key,
    required this.api,
    required this.reporte,
    this.permisos = const ServicioPermisosAndroid(),
    this.gps,
    this.geocodificador,
    this.conMosaicos = true,
  });

  final ApiReportes api;

  /// El detalle (GET /reportes/{id}) con los valores actuales.
  final Map<String, dynamic> reporte;
  final ServicioPermisos permisos;

  /// null = GPS real (geolocator).
  final FuenteGps? gps;

  /// null = Nominatim (OpenStreetMap).
  final Geocodificador? geocodificador;
  final bool conMosaicos;

  static const llaveGuardar = Key('btn-guardar-correccion');

  @override
  State<PantallaEditarReporte> createState() => _PantallaEditarReporteState();
}

class _PantallaEditarReporteState extends State<PantallaEditarReporte> {
  final _form = GlobalKey<FormState>();
  late final Map<String, TextEditingController> _textos = {
    for (final c in CampoReporte.todos)
      if (c != CampoReporte.municipio) c: TextEditingController(text: '${widget.reporte[c] ?? ''}'),
  };
  late String _municipio = municipiosAguascalientes.contains(widget.reporte[CampoReporte.municipio])
      ? widget.reporte[CampoReporte.municipio] as String
      : municipiosAguascalientes.first;
  late Ubicacion? _ubicacion = switch ((widget.reporte['latitud'], widget.reporte['longitud'])) {
    (final num lat, final num lng) => Ubicacion(lat: lat.toDouble(), lng: lng.toDouble()),
    _ => null,
  };
  late final FuenteGps _gps = widget.gps ?? const FuenteGpsDispositivo();
  late final Geocodificador _geocodificador = widget.geocodificador ?? GeocodificadorNominatim();
  bool _guardando = false;

  @override
  void dispose() {
    for (final c in _textos.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _ajustarEnMapa() async {
    final r = await PantallaElegirUbicacion.abrir(
      context,
      inicial: _ubicacion,
      permisos: widget.permisos,
      gps: _gps,
      geocodificador: _geocodificador,
      conMosaicos: widget.conMosaicos,
    );
    if (r != null && mounted) setState(() => _ubicacion = r.ubicacion);
  }

  Future<void> _guardar() async {
    if (_guardando) return;
    if (!(_form.currentState?.validate() ?? false)) {
      _avisar('Revisa los campos marcados en rojo.');
      return;
    }
    // Mismo cuerpo que BorradorReporte.aSolicitud, sin fotos ni clienteId (ReporteEdicionDTO)
    final datos = <String, dynamic>{
      for (final MapEntry(key: campo, value: c) in _textos.entries)
        campo: c.text.trim().isEmpty && CampoReporte.opcionales.contains(campo) ? null : c.text.trim(),
      CampoReporte.municipio: _municipio,
      'latitud': _ubicacion?.lat,
      'longitud': _ubicacion?.lng,
    };
    setState(() => _guardando = true);
    try {
      final actualizado = await widget.api.editar((widget.reporte['id'] as num).toInt(), datos);
      if (mounted) Navigator.of(context).pop(actualizado);
    } catch (e) {
      _avisar(ApiError.de(e).mensaje); // p. ej. 403 si justo se venció el plazo
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  void _avisar(String texto) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(texto)));
  }

  Widget _texto(
    String campo,
    String etiqueta, {
    String? Function(String)? validar,
    int largoMaximo = 150,
    bool multilinea = false,
    TextInputType? teclado,
    List<TextInputFormatter> formatos = const [],
  }) {
    final regla = validar;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        key: Key('editar-$campo'),
        controller: _textos[campo],
        decoration: InputDecoration(labelText: etiqueta, border: const OutlineInputBorder()),
        keyboardType: multilinea ? TextInputType.multiline : teclado,
        minLines: multilinea ? 4 : 1,
        maxLines: multilinea ? 8 : 1,
        maxLength: multilinea ? largoMaximo : null,
        inputFormatters: [LengthLimitingTextInputFormatter(largoMaximo), ...formatos],
        validator: regla == null ? null : (v) => regla((v ?? '').trim()),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final u = _ubicacion;
    return Scaffold(
      appBar: AppBar(title: Text('Corregir ${widget.reporte['folio']}')),
      body: AbsorbPointer(
        absorbing: _guardando,
        child: Form(
          key: _form,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            children: [
              _texto(CampoReporte.calle, 'Calle', validar: reglas.obligatorio('La calle es obligatoria')),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: _texto(CampoReporte.numeroExterior, 'Núm. exterior',
                        largoMaximo: 20, validar: reglas.obligatorio('Obligatorio')),
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: _texto(CampoReporte.numeroInterior, 'Núm. interior', largoMaximo: 20)),
                ],
              ),
              _texto(CampoReporte.colonia, 'Colonia',
                  largoMaximo: 100, validar: reglas.obligatorio('La colonia es obligatoria')),
              _texto(
                CampoReporte.codigoPostal,
                'Código postal',
                largoMaximo: 5,
                teclado: TextInputType.number,
                formatos: [FilteringTextInputFormatter.digitsOnly],
                validar: reglas.codigoPostal,
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: DropdownButtonFormField<String>(
                  initialValue: _municipio,
                  decoration: const InputDecoration(labelText: 'Municipio', border: OutlineInputBorder()),
                  items: [for (final m in municipiosAguascalientes) DropdownMenuItem(value: m, child: Text(m))],
                  onChanged: (m) => _municipio = m ?? _municipio,
                ),
              ),
              _texto(CampoReporte.referencias, 'Referencias', largoMaximo: 255),
              _texto(CampoReporte.numeroContrato, 'Número de contrato', largoMaximo: 30),
              Text('Ubicación', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              if (u != null) ...[
                VistaUbicacion(ubicacion: u, conMosaicos: widget.conMosaicos),
                const SizedBox(height: 8),
              ],
              Align(
                alignment: Alignment.centerLeft,
                child: OutlinedButton.icon(
                  onPressed: _ajustarEnMapa,
                  icon: const Icon(Icons.map),
                  label: Text(u == null ? 'Elegir en el mapa' : 'Ajustar en el mapa'),
                ),
              ),
              const SizedBox(height: 20),
              _texto(CampoReporte.descripcion, 'Qué se encontró',
                  largoMaximo: 2000, multilinea: true, validar: reglas.descripcion),
            ],
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: FilledButton.icon(
            key: PantallaEditarReporte.llaveGuardar,
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
            onPressed: _guardando ? null : _guardar,
            icon: _guardando
                ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.save),
            label: Text(_guardando ? 'Guardando…' : 'Guardar cambios'),
          ),
        ),
      ),
    );
  }
}
