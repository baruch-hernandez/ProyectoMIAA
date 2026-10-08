package com.miaa.lecturas.controllers;

import com.miaa.lecturas.config.JwtUtils;
import com.miaa.lecturas.dtos.AuthResponseDTO;
import com.miaa.lecturas.dtos.LoginRequestDTO;
import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.repositories.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping({ "/auth", "/api/v1/auth" })
public class AuthController {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;

    // Inyección por constructor (en vez de @Autowired en campos): más fácil de probar
    // y deja claro qué necesita la clase para funcionar.
    public AuthController(UsuarioRepository usuarioRepository,
                          PasswordEncoder passwordEncoder,
                          JwtUtils jwtUtils) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtils = jwtUtils;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequestDTO request) {
        if (request == null || estaVacio(request.getUsername()) || estaVacio(request.getPassword())) {
            return error(HttpStatus.BAD_REQUEST, "Escribe tu usuario y contraseña.");
        }

        String identificador = request.getUsername().trim();

        // 1. Buscar por username o por email
        Optional<Usuario> usuarioOpt = usuarioRepository.findByUsername(identificador);
        if (usuarioOpt.isEmpty()) {
            usuarioOpt = usuarioRepository.findByEmail(identificador);
        }

        // 2. Validar contraseña SOLO con BCrypt (se eliminó la comparación en texto plano).
        //    Mismo mensaje si falla el usuario o la contraseña: así un atacante no sabe
        //    cuál de los dos existe.
        boolean credencialesValidas = usuarioOpt
                .map(u -> u.getPassword() != null && passwordEncoder.matches(request.getPassword(), u.getPassword()))
                .orElse(false);

        if (!credencialesValidas) {
            return error(HttpStatus.UNAUTHORIZED, "Usuario o contraseña incorrectos.");
        }

        Usuario usuario = usuarioOpt.get();

        // 3. Token JWT real (antes era el texto fijo "token-miaa-session-<id>")
        AuthResponseDTO response = new AuthResponseDTO(
                jwtUtils.generarToken(usuario),
                usuario.getId(),
                usuario.getNombre(),
                usuario.getRol());

        return ResponseEntity.ok(response);
    }

    private static boolean estaVacio(String s) {
        return s == null || s.isBlank();
    }

    /** Mismo formato JSON de error que el resto de la API: { status, message } */
    private static ResponseEntity<Map<String, Object>> error(HttpStatus status, String mensaje) {
        return ResponseEntity.status(status).body(Map.of("status", status.value(), "message", mensaje));
    }
}
