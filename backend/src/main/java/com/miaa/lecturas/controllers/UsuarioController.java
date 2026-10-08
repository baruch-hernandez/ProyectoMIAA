package com.miaa.lecturas.controllers;

import com.miaa.lecturas.dtos.LecturistaDTO;
import com.miaa.lecturas.repositories.UsuarioRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping({ "/usuarios", "/api/v1/usuarios" })
public class UsuarioController {

    private final UsuarioRepository usuarioRepository;

    public UsuarioController(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    /**
     * GET /usuarios/lecturistas → [{ id, nombre, username }]
     * Lo usa el panel del jefe para: filtrar rutas por encargado y elegir a quién asignar una ruta.
     */
    @GetMapping("/lecturistas")
    @PreAuthorize("hasRole('ADMIN')")
    public List<LecturistaDTO> lecturistas() {
        return usuarioRepository.findByRolOrderByNombreAsc("LECTURISTA").stream()
                .map(LecturistaDTO::desde)
                .toList();
    }
}
