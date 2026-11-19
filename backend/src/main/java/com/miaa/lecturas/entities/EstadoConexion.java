package com.miaa.lecturas.entities;

public enum EstadoConexion {
    /** Sesión iniciada y latidos llegando. */
    ACTIVO,
    /** Cerró sesión, la app se pausó o dejaron de llegar latidos (lo marca PresenciaService). */
    INACTIVO
}
