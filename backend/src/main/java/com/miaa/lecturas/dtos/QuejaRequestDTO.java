package com.miaa.lecturas.dtos;

import com.miaa.lecturas.entities.CategoriaQueja;
import com.miaa.lecturas.entities.PrioridadQueja;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Lo que manda el front para registrar una queja.
 *
 * DTO = "Data Transfer Object": la forma EXACTA del JSON que entra. Así:
 *  - el cliente no puede mandar campos que no debe (estado, creadoPor, fechas...),
 *  - y las validaciones (@NotBlank, @Pattern...) se revisan solas con @Valid.
 *
 * Si algo no cumple, Spring responde 400 y GlobalExceptionHandler arma
 * { message, errores: { campo: "mensaje" } } para mostrarlo en el formulario.
 */
public record QuejaRequestDTO(

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

        // Opcionales, pero si vienen deben caer (aprox.) dentro del estado
        @DecimalMin(value = "21.5", message = "La ubicación está fuera de Aguascalientes")
        @DecimalMax(value = "22.6", message = "La ubicación está fuera de Aguascalientes")
        Double latitud,

        @DecimalMin(value = "-103.0", message = "La ubicación está fuera de Aguascalientes")
        @DecimalMax(value = "-101.7", message = "La ubicación está fuera de Aguascalientes")
        Double longitud,

        @NotNull(message = "Elige una categoría")
        CategoriaQueja categoria,

        @NotBlank(message = "Describe la queja")
        @Size(min = 10, max = 2000, message = "Entre 10 y 2000 caracteres")
        String descripcion,

        @NotNull(message = "Elige una prioridad")
        PrioridadQueja prioridad,

        @Size(max = 3, message = "Máximo 3 fotos")
        List<String> fotos) {
}
