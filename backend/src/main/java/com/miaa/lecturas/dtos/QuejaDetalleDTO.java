package com.miaa.lecturas.dtos;

import com.miaa.lecturas.entities.CategoriaQueja;
import com.miaa.lecturas.entities.EstadoQueja;
import com.miaa.lecturas.entities.PrioridadQueja;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Detalle completo de una queja. Solo trae los NOMBRES de los usuarios,
 * nunca la entidad Usuario (que tiene email, password, etc.).
 */
public record QuejaDetalleDTO(
        Long id,
        String folio,
        String calle,
        String numeroExterior,
        String numeroInterior,
        String colonia,
        String codigoPostal,
        String municipio,
        String referencias,
        String numeroContrato,
        Double latitud,
        Double longitud,
        CategoriaQueja categoria,
        String descripcion,
        PrioridadQueja prioridad,
        EstadoQueja estado,
        String creadoPor,
        String asignadoA,
        LocalDateTime fechaCreacion,
        LocalDateTime fechaActualizacion,
        List<String> fotos,
        List<NotaDTO> notas) {
}
