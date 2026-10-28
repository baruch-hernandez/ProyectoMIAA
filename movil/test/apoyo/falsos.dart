// Versiones falsas de permisos, cámara, galería y procesamiento para las pruebas.
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:movil/fotos/foto_evidencia.dart';
import 'package:movil/fotos/fuentes_fotos.dart';
import 'package:movil/fotos/procesador_fotos.dart';
import 'package:movil/permisos/servicio_permisos.dart';
import 'package:movil/reportes/almacen_borrador.dart';
import 'package:movil/reportes/borrador_reporte.dart';
import 'package:movil/reportes/pantalla_nuevo_reporte.dart';
import 'package:movil/ubicacion/fuente_gps.dart';
import 'package:movil/ubicacion/geocodificador.dart';
import 'package:movil/ubicacion/ubicacion.dart';

/// Simula Android: `consultar` nunca dice "permanente" (igual que permission_handler 13);
/// `solicitar` regresa lo que se le programe en [respuestas].
class PermisosFalsos implements ServicioPermisos {
  PermisosFalsos({this.estado = EstadoPermiso.denegado, List<EstadoPermiso>? respuestas, this.alAbrirAjustes})
      : respuestas = respuestas ?? [];

  EstadoPermiso estado;
  final List<EstadoPermiso> respuestas;

  /// Lo que "hace el usuario" dentro de Ajustes (p. ej. activar el permiso).
  EstadoPermiso Function()? alAbrirAjustes;

  int consultas = 0;
  int solicitudes = 0;
  int ajustesAbiertos = 0;

  @override
  Future<EstadoPermiso> consultar(TipoPermiso tipo) async {
    consultas++;
    return estado == EstadoPermiso.denegadoPermanente ? EstadoPermiso.denegado : estado;
  }

  @override
  Future<EstadoPermiso> solicitar(TipoPermiso tipo) async {
    solicitudes++;
    if (respuestas.isNotEmpty) estado = respuestas.removeAt(0);
    return estado;
  }

  @override
  Future<bool> abrirAjustes() async {
    ajustesAbiertos++;
    final accion = alAbrirAjustes;
    if (accion != null) estado = accion();
    return true;
  }
}

/// Galería y archivos que regresan lo que se les forme en la cola (null = canceló).
class FuenteFalsa implements FuenteFotos {
  FuenteFalsa({List<FotoCruda?>? galeria, List<FotoCruda?>? archivos})
      : galeria = galeria ?? [],
        archivos = archivos ?? [];

  final List<FotoCruda?> galeria;
  final List<FotoCruda?> archivos;
  int vecesGaleria = 0;
  int vecesArchivos = 0;

  @override
  Future<FotoCruda?> desdeGaleria() async {
    vecesGaleria++;
    return galeria.isEmpty ? null : galeria.removeAt(0);
  }

  @override
  Future<FotoCruda?> desdeArchivos() async {
    vecesArchivos++;
    return archivos.isEmpty ? null : archivos.removeAt(0);
  }
}

/// Cámara falsa: cuenta las veces que se abrió y regresa una foto (o null).
class CamaraFalsa {
  CamaraFalsa({this.foto});

  FotoCruda? foto;
  int veces = 0;

  Future<FotoCruda?> abrir(BuildContext context) async {
    veces++;
    return foto ?? fotoCruda(momentoObturador: DateTime.now());
  }
}

/// No procesa nada (las pruebas de widgets no corren isolates): regresa una foto válida
/// o lanza el error que se le indique.
class ProcesadorFalso extends ProcesadorFotos {
  ProcesadorFalso({this.error});

  FotoInvalida? error;
  int veces = 0;

  @override
  Future<FotoProcesada> procesar(EntradaFoto entrada) async {
    veces++;
    final e = error;
    if (e != null) throw e;
    return fotoProcesada();
  }
}

/// GPS falso: entrega las lecturas que se le den (y nada más).
class FuenteGpsFalsa implements FuenteGps {
  FuenteGpsFalsa({List<LecturaGps>? lecturas, this.activo = true, this.precisa = true})
      : lecturasProgramadas = lecturas ?? [];

  final List<LecturaGps> lecturasProgramadas;
  bool activo;
  bool precisa;
  int ajustesAbiertos = 0;

  @override
  Future<bool> servicioActivo() async => activo;

  @override
  Future<bool> abrirAjustesUbicacion() async {
    ajustesAbiertos++;
    return true;
  }

  @override
  Future<bool> esPrecisa() async => precisa;

  @override
  Stream<LecturaGps> lecturas() => Stream.fromIterable(lecturasProgramadas);
}

/// Geocodificador falso: siempre regresa [resultado] y cuenta las consultas.
class GeocodificadorFalso implements Geocodificador {
  GeocodificadorFalso([this.resultado = const SinDireccion()]);

  ResultadoGeocodificacion resultado;
  int consultas = 0;

  @override
  Future<ResultadoGeocodificacion> direccionDe(double lat, double lng) async {
    consultas++;
    return resultado;
  }
}

/// PNG válido y pequeño para que Image.memory no falle en las pruebas.
Uint8List pngDePrueba() => img.encodePng(img.Image(width: 8, height: 6));

/// JPG de prueba con EXIF opcional.
Uint8List jpgDePrueba(int ancho, int alto, {String? fechaExif, String? zona, int? orientacion}) {
  final imagen = img.Image(width: ancho, height: alto);
  img.fill(imagen, color: img.ColorRgb8(200, 120, 40));
  if (fechaExif != null) imagen.exif.exifIfd['DateTimeOriginal'] = fechaExif;
  if (zona != null) imagen.exif.exifIfd['OffsetTimeOriginal'] = zona;
  if (orientacion != null) imagen.exif.imageIfd['Orientation'] = orientacion;
  return img.encodeJpg(imagen, quality: 90);
}

FotoCruda fotoCruda({DateTime? momentoObturador, DateTime? fechaArchivo}) => FotoCruda(
      bytes: pngDePrueba(),
      nombre: 'prueba.png',
      momentoObturador: momentoObturador,
      fechaArchivo: fechaArchivo,
    );

FotoProcesada fotoProcesada({OrigenFechaFoto origenFecha = OrigenFechaFoto.exif}) => FotoProcesada(
      bytes: pngDePrueba(),
      ancho: 1920,
      alto: 1080,
      fechaCaptura: DateTime.utc(2026, 10, 27, 18, 30),
      origenFecha: origenFecha,
    );

/// Abre PantallaNuevoReporte ENCIMA de una pantalla base (como en la app), para que el
/// "regresar" después de enviar tenga a dónde ir. Usa una pantalla alta para que todo el
/// formulario quede a la vista sin hacer scroll.
Future<BorradorReporte> abrirFormulario(
  WidgetTester tester, {
  ServicioPermisos? permisos,
  FuenteFotos? fuente,
  ProcesadorFotos? procesador,
  CamaraFalsa? camara,
  EnviarReporte? enviar,
  BorradorReporte? borrador,
  FuenteGps? gps,
  Geocodificador? geocodificador,
  bool ubicarAlAbrir = false,
}) async {
  await tester.binding.setSurfaceSize(const Size(800, 2400));
  addTearDown(() => tester.binding.setSurfaceSize(null));

  final b = borrador ?? BorradorReporte.nuevo(AlmacenBorradorEnMemoria());
  final camaraFalsa = camara ?? CamaraFalsa();
  final navegador = GlobalKey<NavigatorState>();
  await tester.pumpWidget(MaterialApp(
    navigatorKey: navegador,
    home: const Scaffold(body: Center(child: Text('Inicio'))),
  ));
  navegador.currentState!.push(MaterialPageRoute<bool>(
    builder: (_) => PantallaNuevoReporte(
      borrador: b,
      enviar: enviar ?? (_) async {},
      permisos: permisos ?? PermisosFalsos(estado: EstadoPermiso.concedido),
      fuente: fuente ?? FuenteFalsa(),
      procesador: procesador ?? ProcesadorFalso(),
      abrirCamara: camaraFalsa.abrir,
      gps: gps ?? FuenteGpsFalsa(),
      geocodificador: geocodificador ?? GeocodificadorFalso(),
      ubicarAlAbrir: ubicarAlAbrir,
      conMosaicos: false, // sin descargar mapas en las pruebas
    ),
  ));
  await tester.pumpAndSettle();
  return b;
}

/// El botón "Enviar reporte" (FilledButton.icon) está habilitado.
bool botonEnviarHabilitado(WidgetTester tester) =>
    tester.widget<ButtonStyleButton>(find.byKey(PantallaNuevoReporte.llaveEnviar)).onPressed != null;
