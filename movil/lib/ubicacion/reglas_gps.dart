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

  /// Casi ningún celular baja de ±3 m (el radio que reporta Android es al 68 %). Si en este
  /// tiempo no se llega a ±1 m, se acepta la mejor precisión que el hardware sí da (tarea 1.3).
  static const esperaMaxima = Duration(seconds: 30);

  /// Ni después de esperar se acepta más que esto: ±20 m ya puede ser la casa de al lado.
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

/// Tareas 1.3 y 3.2: null = ya se puede tomar la foto; si no, qué se espera (para mostrarlo).
/// [edad]: hace cuánto llegó [lectura]. [esperando]: desde cuándo se abrió la cámara.
String? motivoParaEsperar(LecturaGps? lectura, {required Duration edad, required Duration esperando}) {
  if (lectura == null) return 'Buscando señal de satélites… Sal a cielo abierto.';
  if (edad > ReglasGps.lecturaVieja) return 'Se perdió la señal del GPS. Sal a cielo abierto.';
  if (!dentroDeAguascalientes(lectura.lat, lectura.lng)) return 'Tu ubicación sale fuera de Aguascalientes.';
  final p = lectura.precision;
  if (p <= ReglasGps.objetivo) return null;
  final yaEspero = esperando >= ReglasGps.esperaMaxima;
  if (yaEspero && p <= ReglasGps.precisionMaxima) return null; // lo mejor que da este celular
  return yaEspero
      ? 'La señal no baja de ±${ReglasGps.precisionMaxima.toStringAsFixed(0)} m: aléjate de techos y paredes altas.'
      : 'Afinando el GPS: ±${p.toStringAsFixed(1)} m (meta ±${ReglasGps.objetivo.toStringAsFixed(0)} m)…';
}
