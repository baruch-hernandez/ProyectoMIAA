package com.miaa.lecturas.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Sprint 5 (tarea 1.1): la presencia y la última ubicación ahora viven juntas en usuario_presencia
 * (la crea ddl-auto=update). Este paso pasa ahí las ubicaciones de ubicaciones_empleado y quita lo
 * viejo (esa tabla y usuarios.conectado/ultima_conexion). En una base nueva no hace nada.
 */
@Component
@Order(0)
public class EsquemaPresencia implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(EsquemaPresencia.class);

    private final JdbcTemplate jdbc;

    public EsquemaPresencia(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(String... args) {
        try {
            Integer vieja = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'ubicaciones_empleado'",
                    Integer.class);
            if (vieja != null && vieja > 0) {
                int copiadas = jdbc.update("""
                        INSERT INTO usuario_presencia (usuario_id, ultima_latitud, ultima_longitud, precision_metros,
                                                       fecha_ubicacion_utc, ultima_conexion_utc, estado_conexion)
                        SELECT usuario_id, latitud, longitud, precision_metros, fecha_recibida, fecha_recibida, 'INACTIVO'
                          FROM ubicaciones_empleado
                        ON CONFLICT (usuario_id) DO NOTHING
                        """);
                jdbc.execute("DROP TABLE ubicaciones_empleado");
                log.info("ubicaciones_empleado → usuario_presencia ({} ubicaciones copiadas)", copiadas);
            }
            // Solo eran el último latido: no hay nada que copiar (el siguiente latido lo vuelve a poner)
            jdbc.execute("ALTER TABLE usuarios DROP COLUMN IF EXISTS conectado, DROP COLUMN IF EXISTS ultima_conexion");
        } catch (DataAccessException e) {
            // No detiene el arranque (igual que EsquemaReportes): solo se pierden las últimas ubicaciones viejas
            log.error("No se pudo migrar a usuario_presencia: {}", e.getMostSpecificCause().getMessage());
        }
    }
}
