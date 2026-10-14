package com.miaa.lecturas.dtos;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * PUT /reportes/{id} — el lecturista corrige domicilio, ubicación o descripción de SU reporte
 * (dentro de las primeras horas; ver miaa.reportes.horas-para-modificar). Las fotos se
 * cambian aparte (quitar/poner foto) y no tienen límite de tiempo.
 */
public record ReporteEdicionDTO(

        @NotBlank(message = "La calle es obligatoria")
        @Size(max = 150, message = "Máximo 150 caracteres")
        String calle,

        @NotBlank(message = "El número exterior es obligatorio")
        @Size(max = 20, message = "Máximo 20 caracteres")
        String numeroExterior,

        @Size(max = 20, message = "Máximo 20 caracteres")
        String numeroInterior,

        @NotBlank(message = "La colonia es obligatoria")
        @Size(max = 100, message = "Máximo 100 caracteres")
        String colonia,

        // Los códigos postales del estado de Aguascalientes van del 20000 al 20999
        @NotBlank(message = "El código postal es obligatorio")
        @Pattern(regexp = "20\\d{3}", message = "Debe ser un C.P. de Aguascalientes (20xxx)")
        String codigoPostal,

        @NotBlank(message = "El municipio es obligatorio")
        String municipio,

        @Size(max = 255, message = "Máximo 255 caracteres")
        String referencias,

        @Size(max = 30, message = "Máximo 30 caracteres")
        String numeroContrato,

        // Filtro rápido con un rectángulo; el contorno real lo revisa LimiteAguascalientes
        @DecimalMin(value = "21.5", message = "La ubicación está fuera de Aguascalientes")
        @DecimalMax(value = "22.6", message = "La ubicación está fuera de Aguascalientes")
        Double latitud,

        @DecimalMin(value = "-103.0", message = "La ubicación está fuera de Aguascalientes")
        @DecimalMax(value = "-101.7", message = "La ubicación está fuera de Aguascalientes")
        Double longitud,

        @NotBlank(message = "Describe el reporte")
        @Size(min = 10, max = 2000, message = "Entre 10 y 2000 caracteres")
        String descripcion) implements DatosReporte {
}
