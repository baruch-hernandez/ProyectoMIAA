package com.miaa.lecturas;

import com.miaa.lecturas.entities.Rol;
import com.miaa.lecturas.entities.Usuario;
import com.miaa.lecturas.repositories.UsuarioRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Crea los usuarios de prueba la primera vez.
 *
 * Cambios respecto a la versión anterior:
 *  - Las contraseñas se guardan con BCrypt (antes iban en texto plano).
 *  - YA NO resetea la contraseña en cada arranque: si el usuario existe y ya tiene
 *    hash BCrypt, no se toca.
 *  - Si encuentra una contraseña vieja en texto plano, la convierte a BCrypt
 *    conservando el mismo valor (migración automática).
 *
 * ⚠️ Solo para desarrollo. En producción los usuarios se dan de alta desde un panel.
 */
@Component
@Profile("!prod") // en el servidor real (perfil "prod") NO se crean admin/admin123 ni notificador1
@Order(1) // después de CatalogoRoles: los roles ya existen
public class DataInitializer implements CommandLineRunner {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(UsuarioRepository usuarioRepository, PasswordEncoder passwordEncoder) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        asegurarUsuario("admin", "Administrador MIAA", "admin@miaa.gob.mx", "admin123", Rol.ADMIN);
        asegurarUsuario("notificador1", "Juan Pérez", "juan.perez@miaa.gob.mx", "notificador1", Rol.NOTIFICADOR);

        System.out.println("✅ Usuarios de prueba listos (contraseñas con BCrypt):");
        System.out.println("   - Admin:      admin / admin123");
        System.out.println("   - Notificador: notificador1 / notificador1");
    }

    private void asegurarUsuario(String username, String nombre, String email, String password, String rol) {
        usuarioRepository.findByUsername(username).ifPresentOrElse(
                existente -> {
                    // Migración: contraseñas viejas en texto plano → BCrypt
                    if (!esHashBCrypt(existente.getPassword())) {
                        String original = existente.getPassword() != null ? existente.getPassword() : password;
                        existente.setPassword(passwordEncoder.encode(original));
                        usuarioRepository.save(existente);
                    }
                },
                () -> {
                    Usuario nuevo = new Usuario();
                    nuevo.setUsername(username);
                    nuevo.setNombre(nombre);
                    nuevo.setEmail(email);
                    nuevo.setPassword(passwordEncoder.encode(password));
                    nuevo.setRol(rol);
                    nuevo.setHabilitado(true);
                    nuevo.setDebeCambiarPassword(false); // usuarios de prueba: sin cambio forzado
                    nuevo.setFechaAlta(java.time.LocalDateTime.now());
                    usuarioRepository.save(nuevo);
                });
    }

    /** Los hashes BCrypt empiezan con $2a$, $2b$ o $2y$ y miden 60 caracteres. */
    private static boolean esHashBCrypt(String valor) {
        return valor != null && valor.length() == 60 && valor.startsWith("$2");
    }
}
