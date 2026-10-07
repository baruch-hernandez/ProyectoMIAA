package com.miaa.lecturas.controllers;

import com.miaa.lecturas.dtos.AuthResponseDTO;
import com.miaa.lecturas.dtos.LoginRequestDTO;
import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.repositories.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping({ "/auth", "/api/v1/auth" })
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class AuthController {

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequestDTO request) {
        if (request == null || request.getUsername() == null || request.getPassword() == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Faltan credenciales");
        }

        // 1. Buscar por username o por email
        Optional<Usuario> usuarioOpt = usuarioRepository.findByUsername(request.getUsername());
        if (usuarioOpt.isEmpty()) {
            usuarioOpt = usuarioRepository.findByEmail(request.getUsername());
        }

        if (usuarioOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("El usuario no existe en la base de datos.");
        }

        Usuario usuario = usuarioOpt.get();

        // 2. Validar si la contraseña coincide (vía BCrypt o en texto plano como
        // respaldo)
        boolean passwordValida = usuario.getPassword() != null
                && (passwordEncoder.matches(request.getPassword(), usuario.getPassword()) ||
                        request.getPassword().equals(usuario.getPassword()));

        if (!passwordValida) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("La contraseña ingresada es incorrecta.");
        }

        // 3. Crear DTO de respuesta
        AuthResponseDTO response = new AuthResponseDTO(
                "token-miaa-session-" + usuario.getId(),
                usuario.getId(),
                usuario.getNombre(),
                usuario.getRol());

        return ResponseEntity.ok(response);
    }
}