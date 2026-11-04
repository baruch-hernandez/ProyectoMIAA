package com.miaa.lecturas.entities;

/**
 * De dónde sacó el celular la hora en que se tomó una foto, de más a menos confiable.
 */
public enum OrigenFechaFoto {
    /** Instante del disparo en la cámara de la app, corregido con la hora del servidor. */
    OBTURADOR,
    /** Metadato EXIF "DateTimeOriginal" que escribe la cámara al tomar la foto. */
    EXIF,
    /** Fecha de modificación del archivo. */
    ARCHIVO,
    /** No se pudo saber: se usó la hora en que se eligió/subió la foto. */
    SUBIDA
}
