package com.miaa.lecturas.controllers;

import com.miaa.lecturas.config.JwtUtils;
import com.miaa.lecturas.config.UsuarioPrincipal;
import com.miaa.lecturas.dtos.LoginRequestDTO;
import com.miaa.lecturas.dtos.OlvidePasswordDTO;
import com.miaa.lecturas.dtos.RestablecerPasswordDTO;
import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.repositories.UsuarioRepository;
import com.miaa.lecturas.services.BloqueoPorIntentos;
import com.miaa.lecturas.services.CuentaService;
import com.miaa.lecturas.services.PresenciaService;
import com.miaa.lecturas.services.RecuperacionPasswordService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;
    private final CuentaService cuentaService;
    private final BloqueoPorIntentos bloqueo;
    private final PresenciaService presenciaService;
    private final RecuperacionPasswordService recuperacion;

    public AuthController(UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder,
            JwtUtils jwtUtils,
            CuentaService cuentaService,
            BloqueoPorIntentos bloqueo,
            PresenciaService presenciaService,
            RecuperacionPasswordService recuperacion) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtils = jwtUtils;
        this.cuentaService = cuentaService;
        this.bloqueo = bloqueo;
        this.presenciaService = presenciaService;
        this.recuperacion = recuperacion;
    }

    /** "Olvidé mi contraseña": manda un código al correo de la cuenta. Siempre 204, exista o no. */
    @PostMapping("/password/olvide")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void olvidePassword(@Valid @RequestBody OlvidePasswordDTO request) {
        recuperacion.solicitar(request.usuario(), LocalDateTime.now());
    }

    /** Con el código del correo pone la contraseña nueva (y quita un bloqueo por intentos). */
    @PostMapping("/password/restablecer")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void restablecerPassword(@Valid @RequestBody RestablecerPasswordDTO request) {
        recuperacion.restablecer(request.usuario(), request.codigo(), request.nueva(), LocalDateTime.now());
    }

    // @Transactional: la fila del usuario queda bloqueada (FOR UPDATE) hasta responder, así los
    // intentos fallidos simultáneos se cuentan uno por uno y el bloqueo no se puede brincar.
    @SuppressWarnings("null")
    @PostMapping("/login")
    @Transactional
    public ResponseEntity<?> login(@RequestBody LoginRequestDTO request) {
        if (request == null || estaVacio(request.getUsername()) || estaVacio(request.getPassword())) {
            return error(HttpStatus.BAD_REQUEST, "Escribe tu usuario y contraseña.");
        }

        String identificador = request.getUsername().trim();

        Optional<Usuario> usuarioOpt = usuarioRepository.findParaLoginByUsernameIgnoreCase(identificador);
        if (usuarioOpt.isEmpty()) {
            usuarioOpt = usuarioRepository.findParaLoginByEmailIgnoreCase(identificador);
        }

        LocalDateTime ahora = LocalDateTime.now();

        if (usuarioOpt.isPresent()) {
            LocalDateTime hasta = bloqueo.bloqueadaHasta(usuarioOpt.get(), ahora);
            if (hasta != null) {
                return cuentaBloqueada(hasta, ahora);
            }
        }

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

        if (!usuario.estaHabilitado()) {
            usuarioRepository.save(usuario);
            return error(HttpStatus.FORBIDDEN, "Tu cuenta está dada de baja. Habla con tu administrador.");
        }

        usuario.setUltimoAcceso(ahora);
        usuarioRepository.save(usuario);
        presenciaService.latido(usuario.getId(), null);

        String token = jwtUtils.generarToken(usuario);

        String rolNombre = usuario.getRol();

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

    @SuppressWarnings("null")
    private static ResponseEntity<Map<String, Object>> error(HttpStatus status, String mensaje) {
        return ResponseEntity.status(status).body(Map.of("status", status.value(), "message", mensaje));
    }

    @SuppressWarnings("null")
    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@AuthenticationPrincipal UsuarioPrincipal yo) {
        if (yo != null) {
            presenciaService.desconectar(yo.id()); // INACTIVO y gris en el mapa del admin al instante
        }
    }
}