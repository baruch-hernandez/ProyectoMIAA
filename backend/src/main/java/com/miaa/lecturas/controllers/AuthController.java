package com.miaa.lecturas.controllers;

import com.miaa.lecturas.config.JwtUtils;
import com.miaa.lecturas.config.UsuarioPrincipal;
import com.miaa.lecturas.dtos.LoginRequestDTO;
import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.repositories.UsuarioRepository;
import com.miaa.lecturas.services.BloqueoPorIntentos;
import com.miaa.lecturas.services.CuentaService;
import com.miaa.lecturas.services.PresenciaService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping({ "/auth", "/api/v1/auth" })
public class AuthController {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;
    private final CuentaService cuentaService;
    private final BloqueoPorIntentos bloqueo;
    private final PresenciaService presenciaService;

    public AuthController(UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder,
            JwtUtils jwtUtils,
            CuentaService cuentaService,
            BloqueoPorIntentos bloqueo,
            PresenciaService presenciaService) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtils = jwtUtils;
        this.cuentaService = cuentaService;
        this.bloqueo = bloqueo;
        this.presenciaService = presenciaService;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequestDTO request) {
        if (request == null || estaVacio(request.getUsername()) || estaVacio(request.getPassword())) {
            return error(HttpStatus.BAD_REQUEST, "Escribe tu usuario y contraseña.");
        }

        String identificador = request.getUsername().trim();

        // 1. Buscar por username o por email (RF-01)
        Optional<Usuario> usuarioOpt = usuarioRepository.findByUsername(identificador);
        if (usuarioOpt.isEmpty()) {
            usuarioOpt = usuarioRepository.findByEmail(identificador);
        }

        LocalDateTime ahora = LocalDateTime.now();

        // 2. Revisar bloqueo temporal por intentos fallidos (RNF-04)
        if (usuarioOpt.isPresent()) {
            LocalDateTime hasta = bloqueo.bloqueadaHasta(usuarioOpt.get(), ahora);
            if (hasta != null) {
                return cuentaBloqueada(hasta, ahora);
            }
        }

        // 3. Validar contraseña con BCrypt
        boolean credencialesValidas = usuarioOpt
                .map(u -> u.getPassword() != null && passwordEncoder.matches(request.getPassword(), u.getPassword()))
                .orElse(false);

        if (!credencialesValidas) {
            if (usuarioOpt.isEmpty()) {
                return error(HttpStatus.UNAUTHORIZED, "Credenciales inválidas.");
            }
            Usuario u = usuarioOpt.get();
            BloqueoPorIntentos.Fallo fallo = bloqueo.registrarFallo(u, ahora);
            usuarioRepository.save(u);
            if (fallo.bloqueo()) {
                return cuentaBloqueada(fallo.bloqueadoHasta(), ahora);
            }
            String mensaje = "Credenciales inválidas.";
            if (fallo.intentosRestantes() <= 2) {
                mensaje += fallo.intentosRestantes() == 1
                        ? " Te queda 1 intento antes de que la cuenta se bloquee."
                        : " Te quedan " + fallo.intentosRestantes() + " intentos antes de que la cuenta se bloquee.";
            }
            return error(HttpStatus.UNAUTHORIZED, mensaje);
        }

        Usuario usuario = usuarioOpt.get();
        bloqueo.registrarExito(usuario); // Reiniciar contador de intentos

        // Validar si la cuenta está activa
        if (!usuario.estaHabilitado()) {
            usuarioRepository.save(usuario);
            return error(HttpStatus.FORBIDDEN, "Tu cuenta está dada de baja. Habla con tu administrador.");
        }

        // Registrar último acceso y presencia
        usuario.setUltimoAcceso(ahora);
        usuarioRepository.save(usuario);
        presenciaService.vidaChecar(usuario.getId());

        // Generar token JWT
        String token = jwtUtils.generarToken(usuario);

        // Mapear rol normalizado ("Administrador" o "Empleado") (RF-02)
        String rolNombre = usuario.getRol() != null ? usuario.getRol().toString() : "Empleado";

        // 4. Estructura de respuesta adaptada exactamente al requerimiento de la Tarea
        // 2.1
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("token", token);

        Map<String, Object> userMap = new LinkedHashMap<>();
        userMap.put("id", usuario.getId());
        userMap.put("username", usuario.getUsername());
        userMap.put("role", rolNombre);
        userMap.put("nombre", usuario.getNombre());
        userMap.put("tieneQueCambiarPassword", usuario.tieneQueCambiarPassword());
        userMap.put("avisoPendiente", cuentaService.avisoPendiente(usuario));

        response.put("user", userMap);

        return ResponseEntity.ok(response);
    }

    private static boolean estaVacio(String s) {
        return s == null || s.isBlank();
    }

    private static ResponseEntity<Map<String, Object>> cuentaBloqueada(LocalDateTime hasta, LocalDateTime ahora) {
        long minutos = BloqueoPorIntentos.minutosRestantes(hasta, ahora);
        Map<String, Object> cuerpo = new LinkedHashMap<>();
        cuerpo.put("status", HttpStatus.LOCKED.value());
        cuerpo.put("message", "Tu cuenta se bloqueó por demasiados intentos fallidos. Intenta de nuevo en "
                + minutos + (minutos == 1 ? " minuto" : " minutos") + " o pide al administrador que la desbloquee.");
        cuerpo.put("codigo", "CUENTA_BLOQUEADA");
        cuerpo.put("segundos", BloqueoPorIntentos.segundosRestantes(hasta, ahora));
        return ResponseEntity.status(HttpStatus.LOCKED).body(cuerpo);
    }

    private static ResponseEntity<Map<String, Object>> error(HttpStatus status, String mensaje) {
        return ResponseEntity.status(status).body(Map.of("status", status.value(), "message", mensaje));
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@AuthenticationPrincipal UsuarioPrincipal yo) {
        if (yo != null) {
            presenciaService.desconectar(yo.id());
        }
    }
}