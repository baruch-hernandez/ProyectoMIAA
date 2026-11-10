package com.miaa.lecturas.dtos;

/**
 * Lo que comparten "crear" y "editar" un reporte: domicilio, ubicación y descripción.
 * Los records ReporteRequestDTO y ReporteEdicionDTO la implementan "gratis": sus
 * métodos (calle(), colonia()...) ya tienen exactamente estos nombres.
 * Así ReporteService aplica los datos con UN solo método para los dos casos.
 */
public interface DatosReporte {

    /** Los tipos de predio que se pueden elegir (los mismos en la web y en la app). */
    String TIPOS_PREDIO = "HABITACIONAL|COMERCIAL|INDUSTRIAL|BALDIO|EN_CONSTRUCCION|DESHABITADO";

    String calle();
    String numeroExterior();
    String numeroInterior();
    String colonia();
    String codigoPostal();
    String municipio();
    String referencias();
    String numeroContrato();
    String tipoPredio();
    String claveCatastral();
    Double latitud();
    Double longitud();
    String descripcion();
}
