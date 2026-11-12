package com.miaa.lecturas.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Sprint 4 (tarea 1.2): la columna reportes.cliente_id ahora se llama client_sync_id.
 *
 * ddl-auto=update no renombra: crea client_sync_id (con su índice UNIQUE) junto a la vieja.
 * Este paso copia los UUID que ya había y borra cliente_id; en una base nueva no hace nada.
 */
@Component
@Order(0)
public class EsquemaReportes implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(EsquemaReportes.class);

    private final JdbcTemplate jdbc;

    public EsquemaReportes(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(String... args) {
        try {
            Integer vieja = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.columns "
                            + "WHERE table_name = 'reportes' AND column_name = 'cliente_id'",
                    Integer.class);
            if (vieja == null || vieja == 0) {
                return;
            }
            int copiados = jdbc.update("UPDATE reportes SET client_sync_id = cliente_id "
                    + "WHERE client_sync_id IS NULL AND cliente_id IS NOT NULL");
            jdbc.execute("ALTER TABLE reportes DROP COLUMN cliente_id"); // se lleva su UNIQUE viejo
            log.info("reportes.cliente_id → client_sync_id ({} reportes copiados)", copiados);
        } catch (DataAccessException e) {
            // No detiene el arranque (igual que EsquemaFotos); los reportes viejos se podrían duplicar al reenviarse
            log.error("No se pudo migrar reportes.cliente_id: {}", e.getMostSpecificCause().getMessage());
        }
    }
}
