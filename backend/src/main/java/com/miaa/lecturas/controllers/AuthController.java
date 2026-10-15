package com.miaa.lecturas.controllers;

import com.miaa.lecturas.config.JwtUtils;
import com.miaa.lecturas.config.UsuarioPrincipal;
import com.miaa.lecturas.services.PresenciaService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.ResponseStatus;
import com.miaa.lecturas.dtos.AuthResponseDTO;
import com.miaa.lecturas.dtos.LoginRequestDTO;
import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.repositories.UsuarioRepository;
import com.miaa.lecturas.services.BloqueoPorIntentos;
import com.miaa.lecturas.services.CuentaService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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

    // Inyección por constructor (en vez de @Autowired en campos): más fácil de probar
    // y deja claro qué necesita la clase para funcionar.
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

        // 1. Buscar por username o por email
        Optional<Usuario> usuarioOpt = usuarioRepository.findByUsername(identificador);
        if (usuarioOpt.isEmpty()) {
            usuarioOpt = usuarioRepository.findByEmail(identificador);
        }

        LocalDateTime ahora = LocalDateTime.now();

        // 2. ¿Cuenta bloqueada por intentos fallidos? Se revisa ANTES de la contraseña:
        //    mientras dure el bloqueo, ni la correcta deja entrar (si no, el bloqueo no serviría).
        if (usuarioOpt.isPresent()) {
            LocalDateTime hasta = bloqueo.bloqueadaHasta(usuarioOpt.get(), ahora);
            if (hasta != null) {
                return cuentaBloqueada(hasta, ahora);
            }
        }

        // 3. Validar contraseña SOLO con BCrypt.
        //    Mismo mensaje si falla el usuario o la contraseña: así un atacante no sabe
        //    cuál de los dos existe.
        boolean credencialesValidas = usuarioOpt
                .map(u -> u.getPassword() != null && passwordEncoder.matches(request.getPassword(), u.getPassword()))
                .orElse(false);

        if (!credencialesValidas) {
            if (usuarioOpt.isEmpty()) {
                return error(HttpStatus.UNAUTHORIZED, "Usuario o contraseña incorrectos.");
            }
            Usuario u = usuarioOpt.get();
            BloqueoPorIntentos.Fallo fallo = bloqueo.registrarFallo(u, ahora);
            usuarioRepository.save(u);
            if (fallo.bloqueo()) {
                return cuentaBloqueada(fallo.bloqueadoHasta(), ahora);
            }
            String mensaje = "Usuario o contraseña incorrectos.";
            if (fallo.intentosRestantes() <= 2) {
                mensaje += fallo.intentosRestantes() == 1
                        ? " Te queda 1 intento antes de que la cuenta se bloquee."
                        : " Te quedan " + fallo.intentosRestantes() + " intentos antes de que la cuenta se bloquee.";
            }
            return error(HttpStatus.UNAUTHORIZED, mensaje);
        }

        Usuario usuario = usuarioOpt.get();
        bloqueo.registrarExito(usuario); // contraseña correcta: el contador vuelve a 0

        // Dado de baja: la contraseña era correcta, pero ya no puede entrar
        if (!usuario.estaHabilitado()) {
            usuarioRepository.save(usuario); // guarda el contador en 0
            return error(HttpStatus.FORBIDDEN, "Tu cuenta está dada de baja. Habla con tu administrador.");
        }

        // Registrar el acceso: con esto el admin sabe si el empleado está activo
        usuario.setUltimoAcceso(ahora);
        usuarioRepository.save(usuario);
        presenciaService.vidaChecar(usuario.getId());
        // 4. Token JWT real (antes era el texto fijo "token-miaa-session-<id>")
        AuthResponseDTO response = new AuthResponseDTO(
                jwtUtils.generarToken(usuario),
                usuario.getId(),
                usuario.getNombre(),
                usuario.getRol(),
                usuario.tieneQueCambiarPassword(),
                cuentaService.avisoPendiente(usuario));

        return ResponseEntity.ok(response);
    }
    
    private static boolean estaVacio(String s) {
        return s == null || s.isBlank();
    }

    /** 423 Locked: { status, message, codigo: "CUENTA_BLOQUEADA", segundos } */
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

    /** Mismo formato JSON de error que el resto de la API: { status, message } */
    private static ResponseEntity<Map<String, Object>> error(HttpStatus status, String mensaje) {
        return ResponseEntity.status(status).body(Map.of("status", status.value(), "message", mensaje));
    }
    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)   // 204: todo bien, sin cuerpo
    public void logout(@AuthenticationPrincipal UsuarioPrincipal yo) {
        if (yo != null) {                    // null si el token ya venció o no vino: no hay nada que hacer
            presenciaService.desconectar(yo.id());
        }
    }
}
