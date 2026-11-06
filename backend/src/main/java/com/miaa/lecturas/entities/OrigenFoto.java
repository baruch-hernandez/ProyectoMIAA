package com.miaa.lecturas.entities;

/**
 * Con qué se agregó una foto en la app. Solo la cámara trae hora del disparo y punto GPS.
 * ARCHIVOS ya no sale de la app: sigue aquí para poder leer las fotos que ya lo tienen.
 */
public enum OrigenFoto {
    CAMARA,
    GALERIA,
    ARCHIVOS
}
