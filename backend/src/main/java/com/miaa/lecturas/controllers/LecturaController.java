package com.miaa.lecturas.controllers;

import com.miaa.lecturas.entities.Lectura;
import com.miaa.lecturas.repositories.LecturaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping({ "/lecturas", "/api/v1/lecturas" })
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class LecturaController {

    @Autowired
    private LecturaRepository lecturaRepository;

    @GetMapping
    public List<Lectura> obtenerTodas() {
        return lecturaRepository.findAll();
    }

    @PostMapping
    public ResponseEntity<?> registrarLectura(@RequestBody Lectura lectura) {
        try {
            if (lectura.getFechaRegistro() == null) {
                lectura.setFechaRegistro(LocalDateTime.now());
            }

            Lectura guardada = lecturaRepository.save(lectura);
            return ResponseEntity.ok(guardada);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("Error al guardar la lectura: " + e.getMessage());
        }
    }
}