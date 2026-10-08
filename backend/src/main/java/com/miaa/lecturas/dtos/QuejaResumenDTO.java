package com.miaa.lecturas.dtos;

import com.miaa.lecturas.entities.CategoriaQueja;
import com.miaa.lecturas.entities.EstadoQueja;
import com.miaa.lecturas.entities.PrioridadQueja;
import com.miaa.lecturas.entities.Queja;

import java.time.LocalDateTime;

/** Versión "ligera" de la queja para listas: sin fotos ni notas. */
public record QuejaResumenDTO(
        Long id,
        String folio,
        String domicilio,
        String colonia,
        String municipio,
        CategoriaQueja categoria,
        PrioridadQueja prioridad,
        EstadoQueja estado,
        String asignadoA,
        LocalDateTime fechaCreacion) {

    public static QuejaResumenDTO desde(Queja q) {
        return new QuejaResumenDTO(
                q.getId(),
                q.getFolio(),
                q.getDomicilioCompleto(),
                q.getColonia(),
                q.getMunicipio(),
                q.getCategoria(),
                q.getPrioridad(),
                q.getEstado(),
                q.getAsignadoA() != null ? q.getAsignadoA().getNombre() : null,
                q.getFechaCreacion());
    }
}
