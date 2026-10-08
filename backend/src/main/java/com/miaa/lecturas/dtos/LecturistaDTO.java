package com.miaa.lecturas.dtos;

import com.miaa.lecturas.entities.Usuario;

/** Datos mínimos de un lecturista para combos y filtros (sin email ni password). */
public record LecturistaDTO(Long id, String nombre, String username) {

    public static LecturistaDTO desde(Usuario u) {
        return new LecturistaDTO(u.getId(), u.getNombre(), u.getUsername());
    }
}
