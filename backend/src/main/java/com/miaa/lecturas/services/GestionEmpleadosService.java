package com.miaa.lecturas.services;

import com.miaa.lecturas.config.UsuarioPrincipal;
import com.miaa.lecturas.dtos.CuentaEmpleadoDTO;
import com.miaa.lecturas.dtos.EdicionEmpleadoDTO;
import com.miaa.lecturas.dtos.NuevoEmpleadoDTO;
import com.miaa.lecturas.entities.Rol;
import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.repositories.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Objects;
import java.util.Set;

/**
 * El ADMIN administra las cuentas de los empleados (NOTIFICADORES y otros ADMINISTRADORES):
 * alta con su rol, edición (incluido el rol), baja/reactivación y restablecer contraseña.
 *
 * Decisiones:
 *  - Dar de baja NO borra: el empleado ya no puede entrar, pero sus reportes se conservan.
 *  - La contraseña que pone el admin es TEMPORAL: al entrar, el empleado debe cambiarla.
 *    Así el admin nunca conoce la contraseña real de nadie.
 *  - Candados para no quedarse sin administradores:
 *      · nadie puede cambiarse su propio rol ni darse de baja a sí mismo;
 *      · siempre debe quedar al menos UN administrador activo.
 *  - El cambio de rol aplica al instante: JwtAuthFilter lee el rol de la base en cada petición.
 */
@Service
public class GestionEmpleadosService {

    /** Roles que el admin puede asignar (deben existir en la tabla "roles", ver CatalogoRoles). */
    static final Set<String> ROLES_ASIGNABLES = Set.of(Rol.ADMIN, Rol.NOTIFICADOR);

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
        return aDTO(cargarEmpleado(id));
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
        u.setRol(rolValido(req.rol(), Rol.NOTIFICADOR));
        u.setPassword(passwordEncoder.encode(req.passwordTemporal()));
        u.setHabilitado(true);
        u.setDebeCambiarPassword(true);
        u.setFechaAlta(LocalDateTime.now());
        return aDTO(usuarioRepository.save(u));
    }

    @Transactional
    public CuentaEmpleadoDTO editar(Long id, EdicionEmpleadoDTO req, UsuarioPrincipal yo) {
        Usuario u = cargarEmpleado(id);
        String username = req.username().trim();
        String email = textoOpcional(req.email());
        if (usuarioRepository.existsByUsernameIgnoreCaseAndIdNot(username, id)) {
            throw conflicto("Ya existe alguien con el usuario \"" + username + "\".");
        }
        if (email != null && usuarioRepository.existsByEmailIgnoreCaseAndIdNot(email, id)) {
            throw conflicto("Ya existe alguien con el correo " + email + ".");
        }

        String rolNuevo = rolValido(req.rol(), u.getRol());
        if (!rolNuevo.equals(u.getRol())) {
            if (esElMismo(yo, id)) {
                throw conflicto("No puedes cambiar tu propio rol. Pídeselo a otro administrador.");
            }
            if (Rol.ADMIN.equals(u.getRol()) && u.estaHabilitado()) {
                exigirOtroAdministrador(id);
            }
            u.setRol(rolNuevo);
        }

        u.setNombre(req.nombre().trim());
        u.setUsername(username);
        u.setEmail(email);
        return aDTO(u);
    }

    @Transactional
    public CuentaEmpleadoDTO restablecerPassword(Long id, String passwordTemporal) {
        Usuario u = cargarEmpleado(id);
        PoliticaPassword.validar(passwordTemporal);
        u.setPassword(passwordEncoder.encode(passwordTemporal));
        u.setDebeCambiarPassword(true);
        BloqueoPorIntentos.desbloquear(u); // con su nueva contraseña ya puede entrar
        return aDTO(u);
    }

    /** Quita el bloqueo por intentos fallidos sin esperar a que venza. */
    @Transactional
    public CuentaEmpleadoDTO desbloquear(Long id) {
        Usuario u = cargarEmpleado(id);
        BloqueoPorIntentos.desbloquear(u);
        return aDTO(u);
    }

    @Transactional
    public CuentaEmpleadoDTO cambiarHabilitado(Long id, boolean habilitado, UsuarioPrincipal yo) {
        Usuario u = cargarEmpleado(id);
        if (!habilitado && u.estaHabilitado()) {
            if (esElMismo(yo, id)) {
                throw conflicto("No puedes darte de baja a ti mismo.");
            }
            if (Rol.ADMIN.equals(u.getRol())) {
                exigirOtroAdministrador(id);
            }
        }
        u.setHabilitado(habilitado);
        if (!habilitado) {
            // Deja de aparecer "en línea" de inmediato (su sesión se corta en su siguiente petición)
            ubicacionService.marcarDesconectado(id);
        }
        return aDTO(u);
    }

    // ---------------------------------------------------------------- reglas

    /** El rol que pidieron, o el de por defecto si no mandaron ninguno. Rechaza roles que no existen. */
    static String rolValido(String pedido, String porDefecto) {
        if (pedido == null || pedido.isBlank()) {
            return porDefecto;
        }
        String rol = pedido.trim().toUpperCase();
        if (!ROLES_ASIGNABLES.contains(rol)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El rol debe ser ADMIN o NOTIFICADOR.");
        }
        return rol;
    }

    static boolean esElMismo(UsuarioPrincipal yo, Long id) {
        return yo != null && Objects.equals(yo.id(), id);
    }

    /** Antes de quitarle lo de admin (o darlo de baja): que quede al menos otro administrador activo. */
    private void exigirOtroAdministrador(Long id) {
        long otros = usuarioRepository.findByRolOrderByNombreAsc(Rol.ADMIN).stream()
                .filter(Usuario::estaHabilitado)
                .filter(a -> !Objects.equals(a.getId(), id))
                .count();
        if (otros == 0) {
            throw conflicto("Debe quedar al menos un administrador activo. Da de alta a otro antes de hacer este cambio.");
        }
    }

    @SuppressWarnings("null")
    private Usuario cargarEmpleado(Long id) {
        return usuarioRepository.findById(id)
                // (ojo: Set.of(...).contains(null) lanza excepción, por eso se revisa el null primero)
                .filter(u -> u.getRol() != null && ROLES_ASIGNABLES.contains(u.getRol()))
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
                u.getAvisoPrivacidadFecha(), bloqueada ? bloqueo : null, u.getRol());
    }
}
