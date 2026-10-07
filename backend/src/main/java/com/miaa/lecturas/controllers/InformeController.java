package com.miaa.lecturas.controllers;

import com.miaa.lecturas.entities.Informe;
import com.miaa.lecturas.repositories.InformeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping({ "/informes", "/api/v1/informes" })
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class InformeController {

    @Autowired
    private InformeRepository informeRepository;

    @GetMapping
    public List<Informe> obtenerTodos() {
        return informeRepository.findAll();
    }

    @PostMapping
    public ResponseEntity<?> crearInforme(@RequestBody Informe informe) {
        try {
            // Requerimiento: La fecha y hora SIEMPRE son asignadas por el servidor
            informe.setFechaRegistro(LocalDateTime.now());

            Informe guardado = informeRepository.save(informe);
            return ResponseEntity.ok(guardado);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Error al crear el informe: " + e.getMessage());
        }
    }
}