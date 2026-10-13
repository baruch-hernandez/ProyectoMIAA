package com.miaa.lecturas.entities;

/**
 * De dónde sacó el celular la hora en que se tomó una foto, de más a menos confiable.
 */
public enum OrigenFechaFoto {
    /** Metadato EXIF "DateTimeOriginal" que escribe la cámara al tomar la foto. */
    EXIF,
    /** Fecha de modificación del archivo (al tomar la foto con la cámara del celular, es la misma). */
    ARCHIVO,
    /** No se pudo saber: se usó la hora en que se eligió/subió la foto. */
    SUBIDA
}
