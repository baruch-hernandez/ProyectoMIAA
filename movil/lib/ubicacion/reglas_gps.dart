import 'limite_ags.dart';
import 'ubicacion.dart';

/// Historia 3: cuándo el GPS es lo bastante bueno para tomar la foto de evidencia.
/// Los umbrales del backend (FotoRequestDTO.java) son los mismos.
class ReglasGps {
  ReglasGps._();

  /// La meta de la historia: ±1 m (verde).
  static const objetivo = 1.0;

  /// Hasta aquí es amarillo; más es rojo.
  static const amarillo = 5.0;

  /// Casi ningún celular baja de ±3 m (el radio que reporta Android es al 68 %), y bajo techo el
  /// chip GPS no da nada. Pasado este tiempo la foto se puede tomar igual (tarea 1.3): con la
  /// mejor lectura que haya, o sin coordenadas si no hay ninguna que sirva (medidor en interior).
  static const esperaMaxima = Duration(seconds: 10);

  /// Una lectura peor que esto no se graba con la foto: ±20 m ya puede ser la casa de al lado.
  static const precisionMaxima = 20.0;

  /// Si el GPS deja de mandar lecturas (techo, túnel), la última ya no dice dónde estás.
  static const lecturaVieja = Duration(seconds: 5);
}

/// Tarea 3.1: verde ≤ 1 m, amarillo 1–5 m, rojo > 5 m.
enum Semaforo { verde, amarillo, rojo }

Semaforo semaforoDe(double precision) => precision <= ReglasGps.objetivo
    ? Semaforo.verde
    : precision <= ReglasGps.amarillo
        ? Semaforo.amarillo
        : Semaforo.rojo;

/// La lectura que se graba con la foto: reciente y de ±[ReglasGps.precisionMaxima] m o mejor.
/// null = la foto va sin coordenadas (el backend la acepta, igual que una de galería).
/// [edad]: hace cuánto llegó [lectura].
LecturaGps? lecturaParaFoto(LecturaGps? lectura, {required Duration edad}) =>
    lectura != null && edad <= ReglasGps.lecturaVieja && lectura.precision <= ReglasGps.precisionMaxima
        ? lectura
        : null;

/// Tareas 1.3 y 3.2: null = ya se puede tomar la foto; si no, qué se espera (para mostrarlo).
/// [esperando]: desde cuándo se abrió la cámara.
String? motivoParaEsperar(LecturaGps? lectura, {required Duration edad, required Duration esperando}) {
  final util = lecturaParaFoto(lectura, edad: edad);
  // Un punto bueno fuera del estado es real: ahí no se toma la foto, ni esperando.
  if (util != null && !dentroDeAguascalientes(util.lat, util.lng)) return 'Tu ubicación sale fuera de Aguascalientes.';
  if (util != null && util.precision <= ReglasGps.objetivo) return null;
  final falta = ReglasGps.esperaMaxima - esperando;
  if (falta <= Duration.zero) return null; // con lo mejor que hubo, o sin coordenadas en interiores
  final igual = '(en ${falta.inSeconds} s podrás tomarla igual)';
  if (lectura == null) return 'Buscando señal de satélites… $igual';
  if (edad > ReglasGps.lecturaVieja) return 'Se perdió la señal del GPS. $igual';
  return 'Afinando el GPS: ±${lectura.precision.toStringAsFixed(1)} m '
      '(meta ±${ReglasGps.objetivo.toStringAsFixed(0)} m) $igual';
}
