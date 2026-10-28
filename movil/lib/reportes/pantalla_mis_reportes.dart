import 'package:flutter/material.dart';

import '../core/api.dart';
import '../ubicacion/mapa_ags.dart';
import '../ubicacion/ubicacion.dart';
import 'api_reportes.dart';
import 'pantalla_editar_reporte.dart';

/// Fecha del backend (LocalDateTime, hora de Aguascalientes) → "28/10/2026 10:15".
String fechaReporte(BuildContext context, Object? valor) {
  final d = valor is String ? DateTime.tryParse(valor) : null;
  if (d == null) return '—';
  final l = MaterialLocalizations.of(context);
  return '${l.formatShortDate(d)} ${l.formatTimeOfDay(TimeOfDay.fromDateTime(d))}';
}

/// Los reportes que subió el notificador con sesión (GET /reportes/mios), como MisReportes.tsx
/// de la web. Tocar uno abre su detalle; desde ahí se corrige si todavía está a tiempo.
class PantallaMisReportes extends StatefulWidget {
  const PantallaMisReportes({super.key, required this.api, this.conMosaicos = true});

  final ApiReportes api;

  /// false en las pruebas: los mapas no descargan mosaicos.
  final bool conMosaicos;

  static Future<void> abrir(BuildContext context, ApiReportes api) => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => PantallaMisReportes(api: api)),
      );

  @override
  State<PantallaMisReportes> createState() => _PantallaMisReportesState();
}

class _PantallaMisReportesState extends State<PantallaMisReportes> {
  List<Map<String, dynamic>>? _reportes;
  String? _error;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    try {
      final r = await widget.api.mios();
      if (!mounted) return;
      setState(() {
        _reportes = r;
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = ApiError.de(e).mensaje);
    }
  }

  Future<void> _abrir(Map<String, dynamic> r) async {
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => PantallaDetalleReporte(
        api: widget.api,
        id: (r['id'] as num).toInt(),
        conMosaicos: widget.conMosaicos,
      ),
    ));
    await _cargar(); // por si lo corrigió
  }

  @override
  Widget build(BuildContext context) {
    final reportes = _reportes;
    final error = _error;
    return Scaffold(
      appBar: AppBar(title: const Text('Mis reportes')),
      body: RefreshIndicator(
        onRefresh: _cargar,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (error != null)
              Card(
                child: ListTile(
                  leading: const Icon(Icons.error_outline),
                  title: Text(error),
                  subtitle: const Text('Desliza hacia abajo para reintentar.'),
                ),
              )
            else if (reportes == null)
              const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator()))
            else if (reportes.isEmpty)
              const Padding(
                padding: EdgeInsets.all(32),
                child: Text('Todavía no has enviado reportes.', textAlign: TextAlign.center),
              ),
            for (final r in reportes ?? const <Map<String, dynamic>>[]) _TarjetaReporte(reporte: r, alTocar: () => _abrir(r)),
          ],
        ),
      ),
    );
  }
}

class _TarjetaReporte extends StatelessWidget {
  const _TarjetaReporte({required this.reporte, required this.alTocar});

  final Map<String, dynamic> reporte;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    final r = reporte;
    return Card(
      key: Key('reporte-${r['id']}'),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: alTocar,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(child: Text('${r['folio']}', style: tema.textTheme.titleMedium)),
                  if (r['editado'] == true) const Chip(label: Text('Editado'), visualDensity: VisualDensity.compact),
                ],
              ),
              Text('${r['domicilio']}', style: tema.textTheme.bodyLarge),
              Text('${r['colonia']}, ${r['municipio']}'),
              const SizedBox(height: 6),
              Row(
                children: [
                  Expanded(child: Text(fechaReporte(context, r['fechaCreacion']), style: tema.textTheme.bodySmall)),
                  const Icon(Icons.photo_camera_outlined, size: 16),
                  Text(' ${r['totalFotos']}', style: tema.textTheme.bodySmall),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Un reporte completo: domicilio, ubicación, fotos y notas. Si todavía está a tiempo
/// (puedeModificar, lo decide el backend), ofrece corregirlo.
class PantallaDetalleReporte extends StatefulWidget {
  const PantallaDetalleReporte({super.key, required this.api, required this.id, this.conMosaicos = true});

  final ApiReportes api;
  final int id;
  final bool conMosaicos;

  static const llaveCorregir = Key('btn-corregir-reporte');

  @override
  State<PantallaDetalleReporte> createState() => _PantallaDetalleReporteState();
}

class _PantallaDetalleReporteState extends State<PantallaDetalleReporte> {
  Map<String, dynamic>? _reporte;
  String? _error;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    try {
      final r = await widget.api.detalle(widget.id);
      if (!mounted) return;
      setState(() {
        _reporte = r;
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = ApiError.de(e).mensaje);
    }
  }

  Future<void> _corregir(Map<String, dynamic> r) async {
    final actualizado = await Navigator.of(context).push<Map<String, dynamic>>(MaterialPageRoute(
      builder: (_) => PantallaEditarReporte(api: widget.api, reporte: r, conMosaicos: widget.conMosaicos),
    ));
    if (actualizado == null || !mounted) return;
    setState(() => _reporte = actualizado);
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(const SnackBar(content: Text('Cambios guardados.')));
  }

  @override
  Widget build(BuildContext context) {
    final r = _reporte;
    final error = _error;
    return Scaffold(
      appBar: AppBar(title: Text(r == null ? 'Reporte' : '${r['folio']}')),
      body: error != null
          ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(error, textAlign: TextAlign.center)))
          : r == null
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(onRefresh: _cargar, child: _contenido(context, r)),
    );
  }

  Widget _contenido(BuildContext context, Map<String, dynamic> r) {
    final tema = Theme.of(context);
    final lat = r['latitud'] as num?;
    final lng = r['longitud'] as num?;
    final fotos = (r['fotos'] as List? ?? const []).cast<Map>();
    final notas = (r['notas'] as List? ?? const []).cast<Map>();
    final interior = r['numeroInterior'];
    String? opcional(String campo) => (r[campo] as String?)?.isNotEmpty == true ? r[campo] as String : null;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Enviado el ${fechaReporte(context, r['fechaCreacion'])}', style: tema.textTheme.bodySmall),
        if (r['fechaEdicion'] != null)
          Text('Editado el ${fechaReporte(context, r['fechaEdicion'])}', style: tema.textTheme.bodySmall),
        const SizedBox(height: 12),
        if (r['puedeModificar'] == true) ...[
          FilledButton.icon(
            key: PantallaDetalleReporte.llaveCorregir,
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
            onPressed: () => _corregir(r),
            icon: const Icon(Icons.edit),
            label: const Text('Corregir reporte'),
          ),
          const SizedBox(height: 4),
          Text('Puedes corregirlo hasta el ${fechaReporte(context, r['modificableHasta'])}.',
              style: tema.textTheme.bodySmall),
        ] else if (r['puedeEditar'] == true)
          Text('Ya pasó el plazo para corregirlo: ahora es evidencia y no se puede cambiar.',
              style: tema.textTheme.bodySmall),
        const SizedBox(height: 16),
        Text('Domicilio', style: tema.textTheme.titleMedium),
        const SizedBox(height: 4),
        Text('${r['calle']} ${r['numeroExterior']}${interior != null ? ' int. $interior' : ''}',
            style: tema.textTheme.bodyLarge),
        Text('Col. ${r['colonia']}, C.P. ${r['codigoPostal']}, ${r['municipio']}'),
        if (opcional('referencias') case final ref?) Text('Referencias: $ref'),
        if (opcional('numeroContrato') case final contrato?) Text('Contrato: $contrato'),
        if (lat != null && lng != null) ...[
          const SizedBox(height: 12),
          VistaUbicacion(
            ubicacion: Ubicacion(lat: lat.toDouble(), lng: lng.toDouble()),
            conMosaicos: widget.conMosaicos,
          ),
        ],
        const SizedBox(height: 16),
        Text('Descripción', style: tema.textTheme.titleMedium),
        const SizedBox(height: 4),
        Text('${r['descripcion']}'),
        const SizedBox(height: 16),
        Text('Fotos (${fotos.length})', style: tema.textTheme.titleMedium),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final f in fotos)
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                // "data:image/jpeg;base64,...": UriData lo decodifica sin librerías
                child: Image.memory(UriData.parse('${f['datos']}').contentAsBytes(),
                    width: 104, height: 104, fit: BoxFit.cover, cacheWidth: 312),
              ),
          ],
        ),
        if (notas.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text('Notas', style: tema.textTheme.titleMedium),
          for (final n in notas)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text('${n['texto']}'),
              subtitle: Text('${n['autor']} · ${fechaReporte(context, n['fechaCreacion'])}'),
            ),
        ],
      ],
    );
  }
}
