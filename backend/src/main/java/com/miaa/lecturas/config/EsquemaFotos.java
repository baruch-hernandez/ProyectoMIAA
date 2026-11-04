package com.miaa.lecturas.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Agrega OBTURADOR a la restricción de fotos_reporte.origen_fecha.
 *
 * Hibernate creó ese CHECK con los valores que tenía el enum, y ddl-auto=update no lo vuelve a
 * tocar: sin este paso, en una base ya creada fallaría cada foto tomada con la cámara de la app.
 */
@Component
@Order(0)
public class EsquemaFotos implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(EsquemaFotos.class);
    static final String RESTRICCION = "fotos_reporte_origen_fecha_check";

    private final JdbcTemplate jdbc;

    public EsquemaFotos(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(String... args) {
        try {
            Integer lista = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM pg_constraint WHERE conname = ? "
                            + "AND pg_get_constraintdef(oid) LIKE '%OBTURADOR%'",
                    Integer.class, RESTRICCION);
            if (lista != null && lista > 0) {
                return;
            }
            jdbc.execute("ALTER TABLE fotos_reporte DROP CONSTRAINT IF EXISTS " + RESTRICCION);
            jdbc.execute("ALTER TABLE fotos_reporte ADD CONSTRAINT " + RESTRICCION
                    + " CHECK (origen_fecha IN ('OBTURADOR', 'EXIF', 'ARCHIVO', 'SUBIDA'))");
            log.info("Restricción {} actualizada con OBTURADOR", RESTRICCION);
        } catch (DataAccessException e) {
            // No detiene el arranque (igual que CatalogoRoles), pero las fotos de la app fallarán
            log.error("No se pudo actualizar {}: {}", RESTRICCION, e.getMostSpecificCause().getMessage());
        }
    }
}
