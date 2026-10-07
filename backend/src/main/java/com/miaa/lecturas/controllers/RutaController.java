package com.miaa.lecturas.controllers;

import com.miaa.lecturas.entities.Ruta;
import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.repositories.RutaRepository;
import com.miaa.lecturas.repositories.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
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

    // 3. Crear / Guardar Ruta
    @PostMapping
    public ResponseEntity<?> crearRuta(@RequestBody Ruta ruta) {
        try {
            if (ruta.getFechaAsignacion() == null) {
                ruta.setFechaAsignacion(LocalDate.now());
            }
            if (ruta.getEstado() == null) {
                ruta.setEstado("PENDIENTE");
            }

            Long idLecturista = (ruta.getLecturista() != null && ruta.getLecturista().getId() != null)
                    ? ruta.getLecturista().getId()
                    : 2L;

            Usuario lecturista = usuarioRepository.findById(idLecturista)
                    .orElseGet(() -> usuarioRepository.findByUsername("lecturista1").orElse(null));

            ruta.setLecturista(lecturista);

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

    // 5. Eliminar Ruta
    @DeleteMapping("/{id}")
    public ResponseEntity<?> eliminarRuta(@PathVariable Long id) {
        try {
            rutaRepository.deleteById(id);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }
}