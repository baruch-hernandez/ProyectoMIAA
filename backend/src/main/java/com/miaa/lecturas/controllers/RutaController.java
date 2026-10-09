package com.miaa.lecturas.controllers;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.miaa.lecturas.entities.Ruta;
import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.repositories.LecturaRepository;
import com.miaa.lecturas.repositories.RutaRepository;
import com.miaa.lecturas.repositories.UsuarioRepository;
import com.miaa.lecturas.services.LimiteAguascalientes;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping({ "/rutas", "/api/v1/rutas" })
@CrossOrigin(origins = "*", allowedHeaders = "*", methods = { RequestMethod.GET, RequestMethod.POST,
        RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.OPTIONS })
public class RutaController {

    @Autowired
    private RutaRepository rutaRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private LecturaRepository lecturaRepository;

    @Autowired
    private LimiteAguascalientes limiteAgs;

    @Autowired
    private ObjectMapper objectMapper;

    /** Más puntos que esto ya no es una ruta dibujada a mano (protege la BD). */
    private static final int MAX_PUNTOS = 500;

    // 1. Obtener todas las rutas (Admin)
    @GetMapping
    public List<Ruta> obtenerTodas() {
        return rutaRepository.findAll();
    }

    // 2. Obtener rutas por Lecturista (Acepta ID numérico o Username)
    @GetMapping("/lecturista/{identificador}")
    public List<Ruta> obtenerPorLecturista(@PathVariable String identificador) {
        List<Ruta> rutas = new ArrayList<>();

        try {
            // Intenta buscar si el identificador es un ID numérico (ej: "2")
            Long id = Long.parseLong(identificador);
            rutas = rutaRepository.findByLecturistaId(id);
        } catch (NumberFormatException e) {
            // Si es un username (ej: "lecturista1"), busca el usuario primero
            Optional<Usuario> userOpt = usuarioRepository.findByUsername(identificador);
            if (userOpt.isPresent()) {
                rutas = rutaRepository.findByLecturistaId(userOpt.get().getId());
            }
        }

        // Si no se encuentra nada con ese filtro específico, retorna todas para
        // asegurar sincronización en pruebas
        if (rutas.isEmpty()) {
            rutas = rutaRepository.findAll();
        }

        return rutas;
    }

    // 3. Crear / Guardar Ruta (solo el jefe)
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> crearRuta(@RequestBody Ruta ruta) {
        try {
            if (ruta.getFechaAsignacion() == null) {
                ruta.setFechaAsignacion(LocalDate.now());
            }
            if (ruta.getEstado() == null) {
                ruta.setEstado("PENDIENTE");
            }

            // El trazado debe tener al menos 2 puntos y TODOS dentro del estado
            String problemaTrazado = validarPuntos(ruta.getPuntos());
            if (problemaTrazado != null) {
                return error(HttpStatus.BAD_REQUEST, problemaTrazado);
            }

            // ANTES: si no venía lecturista se usaba el id 2 "a ciegas".
            // AHORA: el jefe elige al lecturista y validamos que exista y sea LECTURISTA.
            if (ruta.getLecturista() == null || ruta.getLecturista().getId() == null) {
                return error(HttpStatus.BAD_REQUEST, "Elige al lecturista encargado de la ruta.");
            }
            Optional<Usuario> lecturista = usuarioRepository.findById(ruta.getLecturista().getId())
                    .filter(u -> "LECTURISTA".equals(u.getRol()));
            if (lecturista.isEmpty()) {
                return error(HttpStatus.BAD_REQUEST, "El lecturista elegido no existe o no tiene el rol LECTURISTA.");
            }
            ruta.setLecturista(lecturista.get());

            Ruta rutaGuardada = rutaRepository.save(ruta);
            return ResponseEntity.ok(rutaGuardada);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("Error: " + e.getMessage());
        }
    }

    // 4. Actualizar Estado
    @PutMapping("/{id}")
    public ResponseEntity<Ruta> actualizarEstado(@PathVariable Long id, @RequestBody Ruta rutaActualizada) {
        return rutaRepository.findById(id).map(ruta -> {
            if (rutaActualizada.getEstado() != null) {
                ruta.setEstado(rutaActualizada.getEstado());
            }
            return ResponseEntity.ok(rutaRepository.save(ruta));
        }).orElse(ResponseEntity.notFound().build());
    }

    // 5. Eliminar Ruta (solo el jefe)
    //
    // ANTES: si la ruta tenía lecturas, PostgreSQL rechazaba el DELETE por la llave
    // foránea (lecturas.ruta_id), el catch se tragaba el error y respondía un 404 vacío.
    // El front, además, quitaba la fila aunque fallara → "se borra" y al recargar regresa.
    //
    // AHORA: revisamos ANTES de borrar y respondemos con un mensaje claro.
    // No borramos las lecturas en cascada: son el historial de consumo (cobro) y no
    // deben perderse por borrar una ruta.
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<?> eliminarRuta(@PathVariable("id") Long id) {
        if (!rutaRepository.existsById(id)) {
            return error(HttpStatus.NOT_FOUND, "La ruta ya no existe. Actualiza la página.");
        }

        long lecturas = lecturaRepository.countByRutaId(id);
        if (lecturas > 0) {
            String cuantas = lecturas == 1 ? "1 lectura registrada" : lecturas + " lecturas registradas";
            return error(HttpStatus.CONFLICT,
                    "No se puede eliminar: la ruta tiene " + cuantas
                            + ". Las lecturas son historial de consumo y no deben borrarse.");
        }

        rutaRepository.deleteById(id);
        return ResponseEntity.noContent().build(); // 204: borrada, sin contenido que regresar
    }

    /**
     * Revisa el trazado que manda el front: un texto JSON como "[[21.88,-102.29],[21.89,-102.30]]"
     * (cada punto es [latitud, longitud]). Regresa el mensaje de error, o null si todo está bien.
     */
    private String validarPuntos(String puntosJson) {
        if (puntosJson == null || puntosJson.isBlank()) {
            return "La ruta necesita al menos 2 puntos en el mapa.";
        }
        double[][] puntos;
        try {
            puntos = objectMapper.readValue(puntosJson, double[][].class);
        } catch (JsonProcessingException e) {
            return "El trazado de la ruta no tiene un formato válido.";
        }
        if (puntos.length < 2) {
            return "La ruta necesita al menos 2 puntos en el mapa.";
        }
        if (puntos.length > MAX_PUNTOS) {
            return "La ruta tiene demasiados puntos (máximo " + MAX_PUNTOS + ").";
        }
        for (int i = 0; i < puntos.length; i++) {
            double[] p = puntos[i];
            if (p == null || p.length != 2) {
                return "El trazado de la ruta no tiene un formato válido.";
            }
            if (!limiteAgs.contiene(p[0], p[1])) {
                return "El punto " + (i + 1) + " de la ruta está fuera del estado de Aguascalientes.";
            }
        }
        return null;
    }

    /** Mismo formato JSON de error que el resto de la API: { status, message } */
    private static ResponseEntity<Map<String, Object>> error(HttpStatus status, String mensaje) {
        return ResponseEntity.status(status).body(Map.of("status", status.value(), "message", mensaje));
    }
}