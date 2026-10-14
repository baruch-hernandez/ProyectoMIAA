package com.miaa.lecturas.dtos;

/**
 * Lo que comparten "crear" y "editar" un reporte: domicilio, ubicación y descripción.
 * Los records ReporteRequestDTO y ReporteEdicionDTO la implementan "gratis": sus
 * métodos (calle(), colonia()...) ya tienen exactamente estos nombres.
 * Así ReporteService aplica los datos con UN solo método para los dos casos.
 */
public interface DatosReporte {
    String calle();
    String numeroExterior();
    String numeroInterior();
    String colonia();
    String codigoPostal();
    String municipio();
    String referencias();
    String numeroContrato();
    Double latitud();
    Double longitud();
    String descripcion();
}
