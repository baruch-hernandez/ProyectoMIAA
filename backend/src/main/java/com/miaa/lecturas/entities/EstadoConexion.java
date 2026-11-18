package com.miaa.lecturas.entities;

/** usuario_presencia.estado_conexion (Sprint 5). */
public enum EstadoConexion {
    /** Sesión iniciada y latidos llegando. */
    ACTIVO,
    /** Cerró sesión, la app se pausó o dejaron de llegar latidos (lo marca PresenciaService). */
    INACTIVO
}
