package com.miaa.lecturas.services;

import com.miaa.lecturas.dtos.CuentaEmpleadoDTO;
import com.miaa.lecturas.dtos.EdicionEmpleadoDTO;
import com.miaa.lecturas.dtos.NuevoEmpleadoDTO;
import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.repositories.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

/**
 * El ADMIN administra las cuentas de los LECTURISTAS: alta, edición, baja/reactivación
 * y restablecer contraseña. (A otros administradores no los toca desde aquí.)
 *
 * Decisiones:
 *  - Dar de baja NO borra: el empleado ya no puede entrar, pero sus reportes se conservan.
 *  - La contraseña que pone el admin es TEMPORAL: al entrar, el empleado debe cambiarla.
 *    Así el admin nunca conoce la contraseña real de nadie.
 */
@Service
public class GestionEmpleadosService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final UbicacionService ubicacionService;

    public GestionEmpleadosService(UsuarioRepository usuarioRepository,
                                   PasswordEncoder passwordEncoder,
                                   UbicacionService ubicacionService) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.ubicacionService = ubicacionService;
    }

    @Transactional(readOnly = true)
    public CuentaEmpleadoDTO obtener(Long id) {
        return aDTO(cargarLecturista(id));
    }

    @Transactional
    public CuentaEmpleadoDTO crear(NuevoEmpleadoDTO req) {
        String username = req.username().trim();
        String email = textoOpcional(req.email());
        if (usuarioRepository.existsByUsernameIgnoreCase(username)) {
            throw conflicto("Ya existe alguien con el usuario \"" + username + "\".");
        }
        if (email != null && usuarioRepository.existsByEmailIgnoreCase(email)) {
            throw conflicto("Ya existe alguien con el correo " + email + ".");
        }
        PoliticaPassword.validar(req.passwordTemporal());

        Usuario u = new Usuario();
        u.setNombre(req.nombre().trim());
        u.setUsername(username);
        u.setEmail(email);
        u.setRol("LECTURISTA");
        u.setPassword(passwordEncoder.encode(req.passwordTemporal()));
        u.setHabilitado(true);
        u.setDebeCambiarPassword(true);
        u.setFechaAlta(LocalDateTime.now());
        return aDTO(usuarioRepository.save(u));
    }

    @Transactional
    public CuentaEmpleadoDTO editar(Long id, EdicionEmpleadoDTO req) {
        Usuario u = cargarLecturista(id);
        String username = req.username().trim();
        String email = textoOpcional(req.email());
        if (usuarioRepository.existsByUsernameIgnoreCaseAndIdNot(username, id)) {
            throw conflicto("Ya existe alguien con el usuario \"" + username + "\".");
        }
        if (email != null && usuarioRepository.existsByEmailIgnoreCaseAndIdNot(email, id)) {
            throw conflicto("Ya existe alguien con el correo " + email + ".");
        }
        u.setNombre(req.nombre().trim());
        u.setUsername(username);
        u.setEmail(email);
        return aDTO(u);
    }

    @Transactional
    public CuentaEmpleadoDTO restablecerPassword(Long id, String passwordTemporal) {
        Usuario u = cargarLecturista(id);
        PoliticaPassword.validar(passwordTemporal);
        u.setPassword(passwordEncoder.encode(passwordTemporal));
        u.setDebeCambiarPassword(true);
        BloqueoPorIntentos.desbloquear(u); // con su nueva contraseña ya puede entrar
        return aDTO(u);
    }

    /** Quita el bloqueo por intentos fallidos sin esperar a que venza. */
    @Transactional
    public CuentaEmpleadoDTO desbloquear(Long id) {
        Usuario u = cargarLecturista(id);
        BloqueoPorIntentos.desbloquear(u);
        return aDTO(u);
    }

    @Transactional
    public CuentaEmpleadoDTO cambiarHabilitado(Long id, boolean habilitado) {
        Usuario u = cargarLecturista(id);
        u.setHabilitado(habilitado);
        if (!habilitado) {
            // Deja de aparecer "en línea" de inmediato (su sesión se corta en su siguiente petición)
            ubicacionService.marcarDesconectado(id);
        }
        return aDTO(u);
    }

    private Usuario cargarLecturista(Long id) {
        return usuarioRepository.findById(id)
                .filter(u -> "LECTURISTA".equals(u.getRol()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ese empleado no existe"));
    }

    private static ResponseStatusException conflicto(String mensaje) {
        return new ResponseStatusException(HttpStatus.CONFLICT, mensaje);
    }

    private static String textoOpcional(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    static CuentaEmpleadoDTO aDTO(Usuario u) {
        LocalDateTime bloqueo = u.getBloqueadoHasta();
        boolean bloqueada = bloqueo != null && bloqueo.isAfter(LocalDateTime.now());
        return new CuentaEmpleadoDTO(u.getId(), u.getNombre(), u.getUsername(), u.getEmail(),
                u.estaHabilitado(), u.tieneQueCambiarPassword(), u.getFechaAlta(), u.getUltimoAcceso(),
                u.getAvisoPrivacidadFecha(), bloqueada ? bloqueo : null);
    }
}
