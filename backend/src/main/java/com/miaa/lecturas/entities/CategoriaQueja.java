package com.miaa.lecturas.entities;

/**
 * Tipos de queja. Las etiquetas bonitas ("Fuga de agua") viven en el front
 * (utils/catalogos.ts); aquí solo el valor que se guarda en la BD.
 *
 * Si agregas un valor nuevo aquí, agrégalo también en el front.
 */
public enum CategoriaQueja {
    FUGA_AGUA,
    FALTA_AGUA,
    BAJA_PRESION,
    CALIDAD_AGUA,
    DRENAJE,
    MEDIDOR,
    COBRO,
    OTRO
}
