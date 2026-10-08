package com.miaa.lecturas.dtos;

import com.miaa.lecturas.entities.NotaQueja;

import java.time.LocalDateTime;

public record NotaDTO(Long id, String texto, String autor, String autorRol, LocalDateTime fechaCreacion) {

    public static NotaDTO desde(NotaQueja n) {
        return new NotaDTO(
                n.getId(),
                n.getTexto(),
                n.getAutor().getNombre(),
                n.getAutor().getRol(),
                n.getFechaCreacion());
    }
}
