import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';

import '../fotos/foto_evidencia.dart';
import '../fotos/procesador_fotos.dart';
import '../ubicacion/ubicacion.dart';
import 'almacen_borrador.dart';

/// Los 11 municipios de Aguascalientes (los mismos que valida ReporteService.java).
const municipiosAguascalientes = [
  'Aguascalientes',
  'Asientos',
  'Calvillo',
  'Cosío',
  'El Llano',
  'Jesús María',
  'Pabellón de Arteaga',
  'Rincón de Romos',
  'San Francisco de los Romo',
  'San José de Gracia',
  'Tepezalá',
];

/// Nombres de los campos, iguales a ReporteRequestDTO del backend.
class CampoReporte {
  CampoReporte._();

  static const calle = 'calle';
  static const numeroExterior = 'numeroExterior';
  static const numeroInterior = 'numeroInterior';
  static const colonia = 'colonia';
  static const codigoPostal = 'codigoPostal';
  static const municipio = 'municipio';
  static const referencias = 'referencias';
  static const numeroContrato = 'numeroContrato';
  static const descripcion = 'descripcion';

  static const todos = [
    calle,
    numeroExterior,
    numeroInterior,
    colonia,
    codigoPostal,
    municipio,
    referencias,
    numeroContrato,
    descripcion,
  ];

  /// Opcionales: si van vacíos se mandan como null.
  static const opcionales = {numeroInterior, referencias, numeroContrato};
}

/// UUID v4 (para "clienteId": si se reintenta el envío, el backend no duplica el reporte).
String nuevoUuid([Random? azar]) {
  final r = azar ?? Random.secure();
  final b = List<int>.generate(16, (_) => r.nextInt(256));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  final h = b.map((x) => x.toRadixString(16).padLeft(2, '0')).join();
  return '${h.substring(0, 8)}-${h.substring(8, 12)}-${h.substring(12, 16)}-'
      '${h.substring(16, 20)}-${h.substring(20)}';
}

/// El reporte que se está llenando. Cada cambio se guarda en el celular (no se pierde si
/// se cierra la app) y la pantalla se redibuja sola porque es un ChangeNotifier.
class BorradorReporte extends ChangeNotifier {
  BorradorReporte._(this._almacen, this.clienteId, Map<String, String> campos, List<FotoEvidencia> fotos)
      : _campos = campos,
        _fotos = fotos;

  /// Un borrador vacío.
  factory BorradorReporte.nuevo(AlmacenBorrador almacen) => BorradorReporte._(
        almacen,
        nuevoUuid(),
        {CampoReporte.municipio: municipiosAguascalientes.first},
        [],
      );

  /// El borrador que quedó guardado (o uno nuevo si no había).
  static Future<BorradorReporte> cargar(AlmacenBorrador almacen) async {
    final datos = await almacen.leerDatos();
    if (datos == null) return BorradorReporte.nuevo(almacen);
    try {
      final campos = (datos['campos'] as Map? ?? {}).map((k, v) => MapEntry(k.toString(), v.toString()));
      final fotos = <FotoEvidencia>[];
      for (final f in (datos['fotos'] as List? ?? const [])) {
        final json = (f as Map).cast<String, dynamic>();
        final bytes = await almacen.leerFoto(json['ruta'] as String);
        if (bytes != null) fotos.add(FotoEvidencia.desdeJson(json, bytes)); // si el archivo ya no está, se omite
      }
      final clienteId = datos['clienteId'] as String? ?? nuevoUuid();
      final borrador = BorradorReporte._(almacen, clienteId, campos, fotos);
      final u = datos['ubicacion'];
      if (u is Map) borrador._ubicacion = Ubicacion.desdeJson(u.cast<String, dynamic>());
      borrador._editadosGps.addAll((datos['editadosGps'] as List? ?? const []).map((e) => e.toString()));
      return borrador;
    } catch (_) {
      return BorradorReporte.nuevo(almacen);
    }
  }

  final AlmacenBorrador _almacen;
  final Map<String, String> _campos;
  final List<FotoEvidencia> _fotos;
  String clienteId;
  Ubicacion? _ubicacion;

  /// Campos del domicilio que el notificador escribió A MANO: el GPS ya no los toca.
  final Set<String> _editadosGps = {};
  Future<void> _cola = Future.value();
  bool _desechado = false;

  List<FotoEvidencia> get fotos => List.unmodifiable(_fotos);

  String campo(String nombre) => _campos[nombre] ?? '';

  /// El punto del domicilio (opcional para el backend).
  Ubicacion? get ubicacion => _ubicacion;

  Set<String> get editadosGps => Set.unmodifiable(_editadosGps);

  void ponerUbicacion(Ubicacion? ubicacion) {
    _ubicacion = ubicacion;
    unawaited(_guardar());
    _avisar();
  }

  /// El notificador escribió en un campo: el GPS ya no lo vuelve a llenar.
  void marcarEditado(String nombre) {
    if (_editadosGps.add(nombre)) unawaited(_guardar());
  }

  /// "Volver a llenar con el mapa": el GPS vuelve a mandar en todos los campos.
  void olvidarEditados() {
    _editadosGps.clear();
    unawaited(_guardar());
  }

  /// Tarea 2.2: el reporte NO se puede enviar mientras no tenga al menos una foto.
  /// (Los demás campos los valida el formulario al tocar "Enviar".)
  bool get puedeEnviar => _fotos.isNotEmpty;

  bool get completoDeFotos => _fotos.length >= ReglasFoto.maxFotos;

  bool get estaVacio => _fotos.isEmpty && _campos.entries.every((e) => e.key == CampoReporte.municipio || e.value.trim().isEmpty);

  void ponerCampo(String nombre, String valor) {
    if (_campos[nombre] == valor) return;
    _campos[nombre] = valor;
    unawaited(_guardar());
    _avisar();
  }

  /// Tarea 2.5: fija la foto confirmada al borrador (archivo + metadatos de auditoría).
  Future<FotoEvidencia> agregarFoto(FotoProcesada procesada, OrigenFoto origen, {DateTime? ahora}) async {
    if (completoDeFotos) {
      throw const FotoInvalida('Ya tienes ${ReglasFoto.maxFotos} fotos; quita una para agregar otra.');
    }
    final id = nuevoUuid();
    final ruta = await _almacen.guardarFoto(id, procesada.bytes);
    final foto = FotoEvidencia(
      id: id,
      ruta: ruta,
      bytes: procesada.bytes,
      ancho: procesada.ancho,
      alto: procesada.alto,
      origen: origen,
      fechaCaptura: procesada.fechaCaptura,
      origenFecha: procesada.origenFecha,
      fechaAdjunta: (ahora ?? DateTime.now()).toUtc(),
    );
    _fotos.add(foto);
    await _guardar();
    _avisar();
    return foto;
  }

  Future<void> quitarFoto(String id) async {
    final i = _fotos.indexWhere((f) => f.id == id);
    if (i < 0) return;
    final foto = _fotos.removeAt(i);
    _avisar();
    await _almacen.borrarFoto(foto.ruta);
    await _guardar();
  }

  /// Después de enviarlo: se borra todo y queda listo para el siguiente reporte.
  Future<void> limpiar() async {
    await _cola;
    _fotos.clear();
    _campos
      ..clear()
      ..[CampoReporte.municipio] = municipiosAguascalientes.first;
    clienteId = nuevoUuid();
    _ubicacion = null;
    _editadosGps.clear();
    await _almacen.limpiar();
    _avisar();
  }

  /// Lo que se persiste en el celular.
  Map<String, dynamic> aJson() => {
        'version': 1,
        'clienteId': clienteId,
        'campos': Map<String, String>.from(_campos),
        if (_ubicacion != null) 'ubicacion': _ubicacion!.aJson(),
        'editadosGps': _editadosGps.toList(),
        'fotos': [for (final f in _fotos) f.aJson()],
      };

  /// El cuerpo de POST /reportes (ReporteRequestDTO).
  /// "origenFoto" todavía no lo guarda el backend; Spring ignora los campos que no conoce,
  /// así que ya se manda para cuando se agregue la columna.
  Map<String, dynamic> aSolicitud() {
    final datos = <String, dynamic>{};
    for (final nombre in CampoReporte.todos) {
      final valor = campo(nombre).trim();
      datos[nombre] = valor.isEmpty && CampoReporte.opcionales.contains(nombre) ? null : valor;
    }
    // Opcional: si no hay punto se mandan null (el backend lo acepta). Si viene, el backend
    // revisa que esté dentro del contorno del estado.
    datos['latitud'] = _ubicacion?.lat;
    datos['longitud'] = _ubicacion?.lng;
    datos['clienteId'] = clienteId;
    datos['fotos'] = [
      for (final f in _fotos)
        {
          'datos': 'data:image/jpeg;base64,${base64Encode(f.bytes)}',
          'fechaCaptura': f.fechaCaptura.toUtc().toIso8601String(),
          'origenFecha': f.origenFecha.clave,
          'origenFoto': f.origen.clave,
        },
    ];
    return datos;
  }

  /// Guarda en orden (una escritura detrás de otra) para no encimar archivos.
  Future<void> _guardar() {
    final datos = aJson();
    _cola = _cola.then((_) => _almacen.guardarDatos(datos)).catchError((Object _) {
      // si el disco falla, el reporte sigue en memoria; se reintenta en el siguiente cambio
    });
    return _cola;
  }

  void _avisar() {
    if (!_desechado) notifyListeners();
  }

  @override
  void dispose() {
    _desechado = true;
    super.dispose();
  }
}
