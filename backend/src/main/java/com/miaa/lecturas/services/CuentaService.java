package com.miaa.lecturas.services;

import com.miaa.lecturas.config.UsuarioPrincipal;
import com.miaa.lecturas.dtos.CuentaDTO;
import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.repositories.UsuarioRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

/**
 * Lo que cada persona hace con SU cuenta: ver sus datos, cambiar su contraseña y
 * aceptar el aviso de privacidad.
 *
 * "Requisitos pendientes": mientras alguien deba cambiar su contraseña temporal o
 * no haya aceptado el aviso vigente, el JwtAuthFilter solo le deja usar /usuarios/yo/**.
 */
@Service
public class CuentaService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final String versionAviso;

    public CuentaService(UsuarioRepository usuarioRepository,
                         PasswordEncoder passwordEncoder,
                         @Value("${miaa.aviso-privacidad.version:2026-10}") String versionAviso) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.versionAviso = versionAviso;
    }

    public String versionAviso() {
        return versionAviso;
    }

    /** El aviso aplica a los NOTIFICADORES: son a quienes se les toman ubicación y fotos. */
    public boolean avisoPendiente(Usuario u) {
        return "NOTIFICADOR".equals(u.getRol()) && !versionAviso.equals(u.getAvisoPrivacidadVersion());
    }

    public boolean tieneRequisitosPendientes(Usuario u) {
        return u.tieneQueCambiarPassword() || avisoPendiente(u);
    }

    @Transactional(readOnly = true)
    public CuentaDTO yo(UsuarioPrincipal yo) {
        return aDTO(cargar(yo));
    }

    @Transactional
    public CuentaDTO cambiarPassword(UsuarioPrincipal yo, String actual, String nueva) {
        Usuario u = cargar(yo);
        if (!passwordEncoder.matches(actual, u.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La contraseña actual no es correcta.");
        }
        PoliticaPassword.validar(nueva);
        if (passwordEncoder.matches(nueva, u.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La nueva contraseña debe ser distinta a la actual.");
        }
        u.setPassword(passwordEncoder.encode(nueva));
        u.setDebeCambiarPassword(false);
        return aDTO(u); // sin save(): JPA guarda el cambio al cerrar la transacción
    }

    @Transactional
    public CuentaDTO aceptarAviso(UsuarioPrincipal yo, String version) {
        if (!versionAviso.equals(version)) {
            // Aceptó un texto viejo (p. ej. tenía la página abierta cuando cambió): que lea el nuevo
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "El aviso de privacidad cambió. Vuelve a cargar la página para leer la versión vigente.");
        }
        Usuario u = cargar(yo);
        u.setAvisoPrivacidadVersion(versionAviso);
        u.setAvisoPrivacidadFecha(LocalDateTime.now());
        return aDTO(u);
    }

    @SuppressWarnings("null")
    private Usuario cargar(UsuarioPrincipal yo) {
        return usuarioRepository.findById(yo.id())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Tu usuario ya no existe"));
    }

    private CuentaDTO aDTO(Usuario u) {
        return new CuentaDTO(u.getId(), u.getNombre(), u.getUsername(), u.getEmail(), u.getRol(),
                u.tieneQueCambiarPassword(), avisoPendiente(u), versionAviso);
    }
}
