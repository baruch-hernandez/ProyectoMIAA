package com.miaa.lecturas.entities;

/**
 * Roles del sistema. Usuario.rol se guarda como texto con alguno de estos valores.
 * (Referencia; a futuro conviene cambiar Usuario.rol a este enum con @Enumerated.)
 */
public enum Rol {
    ADMIN,      // jefe: ve y gestiona todo
    LECTURISTA  // empleado de campo: captura lecturas y registra quejas/notas de domicilios
}
