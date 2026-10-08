package com.miaa.lecturas.entities;

/**
 * Ciclo de vida de una queja.
 *
 *   PENDIENTE ──(jefe asigna)──▶ ASIGNADA ──▶ EN_PROCESO ──▶ RESUELTA
 *        └──────────────────────────────┴──────────────────▶ CANCELADA
 *
 * El lecturista solo crea quejas (siempre nacen en PENDIENTE). Los cambios de
 * estado los hará el jefe/trabajador en la siguiente parte del proyecto.
 */
public enum EstadoQueja {
    PENDIENTE,
    ASIGNADA,
    EN_PROCESO,
    RESUELTA,
    CANCELADA
}
