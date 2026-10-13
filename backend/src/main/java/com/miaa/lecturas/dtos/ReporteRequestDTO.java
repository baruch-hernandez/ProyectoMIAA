package com.miaa.lecturas.dtos;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Lo que manda el lecturista para subir un reporte: domicilio, descripción y fotos.
 * (Sin categoría, prioridad ni estado: MIAA pidió que el reporte sea solo eso.)
 *
 * Si algo no cumple, Spring responde 400 y GlobalExceptionHandler arma
 * { message, errores: { campo: "mensaje" } } para mostrarlo en el formulario.
 */
public record ReporteRequestDTO(

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
        String descripcion,

        // @Valid: también valida cada foto de la lista con las reglas de FotoRequestDTO
        @Size(max = 3, message = "Máximo 3 fotos")
        List<@Valid FotoRequestDTO> fotos) {
}
