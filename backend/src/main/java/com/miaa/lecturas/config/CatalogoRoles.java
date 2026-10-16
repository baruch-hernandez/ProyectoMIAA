package com.miaa.lecturas.config;

import com.miaa.lecturas.entities.Rol;
import com.miaa.lecturas.repositories.RolRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;


@Component
@Order(0)
public class CatalogoRoles implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(CatalogoRoles.class);
    static final String NOMBRE_LLAVE = "fk_usuarios_rol";
    /** Clave que tenía el rol de campo antes de llamarse NOTIFICADOR. */
    static final String CLAVE_VIEJA = "LECTURISTA";

    private final RolRepository rolRepository;
    private final JdbcTemplate jdbc;

    public CatalogoRoles(RolRepository rolRepository, JdbcTemplate jdbc) {
        this.rolRepository = rolRepository;
        this.jdbc = jdbc;
    }

    @Override
    public void run(String... args) {
        asegurarRol(Rol.ADMIN, "Administrador", "Consulta los reportes y administra a los empleados.");
        asegurarRol(Rol.NOTIFICADOR, "Notificador", "Empleado de campo: sube reportes de domicilios.");
        migrarClaveVieja();
        asegurarLlaveForanea();
    }

    /** Solo lo crea si no existe: si alguien cambió el nombre en la base, se respeta. */
    @SuppressWarnings("null")
    private void asegurarRol(String clave, String nombre, String descripcion) {
        if (!rolRepository.existsById(clave)) {
            rolRepository.save(new Rol(clave, nombre, descripcion));
        }
    }

    private void migrarClaveVieja() {
        try {
            int movidos = jdbc.update("UPDATE usuarios SET rol = ? WHERE rol = ?", Rol.NOTIFICADOR, CLAVE_VIEJA);
            int borrados = jdbc.update("DELETE FROM roles WHERE clave = ?", CLAVE_VIEJA);
            if (movidos > 0 || borrados > 0) {
                log.info("Rol renombrado {} → {}: {} usuario(s) actualizados", CLAVE_VIEJA, Rol.NOTIFICADOR, movidos);
            }
        } catch (DataAccessException e) {
            log.warn("No se pudo migrar el rol {} → {}: {}", CLAVE_VIEJA, Rol.NOTIFICADOR,
                    e.getMostSpecificCause().getMessage());
        }
    }

    private void asegurarLlaveForanea() {
        try {
            Integer existe = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.table_constraints "
                            + "WHERE LOWER(table_name) = 'usuarios' AND LOWER(constraint_name) = ?",
                    Integer.class, NOMBRE_LLAVE);
            if (existe != null && existe > 0) {
                return;
            }
            // Si algún usuario tiene un rol que no está en el catálogo, la llave no se puede crear
            List<String> desconocidos = jdbc.queryForList(
                    "SELECT DISTINCT rol FROM usuarios WHERE rol IS NOT NULL "
                            + "AND rol NOT IN (SELECT clave FROM roles)", String.class);
            if (!desconocidos.isEmpty()) {
                log.warn("No se creó la llave foránea usuarios.rol → roles: hay usuarios con roles que no "
                        + "están en la tabla roles: {}. Corrígelos (UPDATE usuarios SET rol = ...) y reinicia.", desconocidos);
                return;
            }
            jdbc.execute("ALTER TABLE usuarios ADD CONSTRAINT " + NOMBRE_LLAVE
                    + " FOREIGN KEY (rol) REFERENCES roles (clave)");
            log.info("Se creó la llave foránea usuarios.rol → roles.clave");
        } catch (DataAccessException e) {
            // No detiene el arranque: la app funciona igual, solo falta la restricción en la base
            log.warn("No se pudo crear la llave foránea usuarios.rol → roles: {}", e.getMostSpecificCause().getMessage());
        }
    }
}
