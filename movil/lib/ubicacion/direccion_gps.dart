// Convierte la respuesta del geocodificador (OpenStreetMap / Nominatim) en los campos del
// formulario y decide QUÉ campos se pueden llenar solos. Es el mismo algoritmo que
// frontend/src/utils/direccionGps.ts, pasado a Dart: sin Flutter ni red, para poder probarlo.
import '../reportes/borrador_reporte.dart';

/// Campos del domicilio que el GPS puede llenar. Referencias y contrato, nunca.
const camposGps = [
  CampoReporte.calle,
  CampoReporte.numeroExterior,
  CampoReporte.colonia,
  CampoReporte.codigoPostal,
  CampoReporte.municipio,
];

/// Lo que se pudo sacar de la dirección: campo → valor (solo los que vinieron).
typedef DireccionGps = Map<String, String>;

const _acentos = {'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u', 'ñ': 'n'};

/// "Jesús María" y "jesus maria" se consideran iguales.
String normalizar(String texto) {
  final b = StringBuffer();
  for (final letra in texto.toLowerCase().trim().split('')) {
    b.write(_acentos[letra] ?? letra);
  }
  return b.toString();
}

/// El primer valor no vacío de la lista de llaves, en ese orden de preferencia.
String? _primero(Map<String, dynamic> a, List<String> llaves) {
  for (final llave in llaves) {
    final valor = a[llave]?.toString().trim();
    if (valor != null && valor.isNotEmpty) return valor;
  }
  return null;
}

String _corta(String texto, int maximo) => texto.length <= maximo ? texto : texto.substring(0, maximo);

/// En OpenStreetMap el municipio puede venir como municipality, county, city, town…, a veces con
/// prefijo ("Municipio de Calvillo"). Solo se acepta si es uno de los 11 del estado.
String? municipioDesde(Map<String, dynamic> a) {
  const candidatos = ['municipality', 'county', 'city', 'town', 'village'];
  final prefijo = RegExp(r'^(municipio|mpio\.?)\s+(de\s+)?');
  for (final llave in candidatos) {
    final valor = a[llave]?.toString();
    if (valor == null || valor.isEmpty) continue;
    final limpio = normalizar(valor).replaceFirst(prefijo, '');
    for (final m in municipiosAguascalientes) {
      if (normalizar(m) == limpio) return m;
    }
  }
  return null;
}

bool estaEnAguascalientes(Map<String, dynamic> a) =>
    a['ISO3166-2-lvl4'] == 'MX-AGU' || normalizar(a['state']?.toString() ?? '') == 'aguascalientes';

/// address de Nominatim → campos del formulario. Lo que no venga, no se incluye.
DireccionGps interpretarDireccion(Map<String, dynamic> a) {
  final r = <String, String>{};
  final calle = _primero(a, ['road', 'pedestrian', 'footway', 'path']);
  if (calle != null) r[CampoReporte.calle] = _corta(calle, 150);
  // En México muchas casas no tienen número en OSM: casi siempre hay que capturarlo
  final numero = a['house_number']?.toString().trim();
  if (numero != null && numero.isNotEmpty) r[CampoReporte.numeroExterior] = _corta(numero, 20);
  // En Aguascalientes las colonias suelen venir como neighbourhood o suburb
  final colonia = _primero(a, ['neighbourhood', 'suburb', 'quarter', 'residential', 'city_district', 'hamlet']);
  if (colonia != null) r[CampoReporte.colonia] = _corta(colonia, 100);
  final cp = a['postcode']?.toString().replaceAll(RegExp(r'\s'), '');
  if (cp != null && RegExp(r'^20\d{3}$').hasMatch(cp)) r[CampoReporte.codigoPostal] = cp;
  final municipio = municipioDesde(a);
  if (municipio != null) r[CampoReporte.municipio] = municipio;
  return r;
}

/// Una línea legible para mostrar debajo del mapa.
String resumenDireccion(DireccionGps d) {
  final calle = [d[CampoReporte.calle], d[CampoReporte.numeroExterior]].whereType<String>().join(' ');
  return [
    if (calle.isNotEmpty) calle,
    if (d[CampoReporte.colonia] != null) 'Col. ${d[CampoReporte.colonia]}',
    if (d[CampoReporte.codigoPostal] != null) 'C.P. ${d[CampoReporte.codigoPostal]}',
    if (d[CampoReporte.municipio] != null) d[CampoReporte.municipio]!,
  ].join(', ');
}

/// Qué valor debe quedar en cada campo del GPS después de aplicar la sugerencia, SIN pisar lo que
/// el notificador escribió a mano ([editados]). Con [forzar] ("Volver a llenar") se ignoran.
/// Los campos no editados quedan "en manos del GPS": si el nuevo punto no trae, p. ej., número,
/// se vacía (para no dejar el número de la casa anterior). El municipio nunca se vacía.
Map<String, String> cambiosPorDireccion(DireccionGps sugerencia, Set<String> editados, {bool forzar = false}) {
  final cambios = <String, String>{};
  for (final campo in camposGps) {
    if (!forzar && editados.contains(campo)) continue;
    final valor = sugerencia[campo];
    if (valor != null) {
      cambios[campo] = valor;
    } else if (campo != CampoReporte.municipio) {
      cambios[campo] = '';
    }
  }
  return cambios;
}
