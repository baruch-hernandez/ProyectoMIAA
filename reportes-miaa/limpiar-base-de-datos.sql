-- OPCIONAL. Borra las tablas que ya no usa el programa.
-- Hibernate (ddl-auto=update) crea las tablas nuevas solo, pero NUNCA borra las viejas.
--
-- ⚠️ ESTO NO SE PUEDE DESHACER. Haz un respaldo antes:
--    pg_dump -U postgres -d miaa -f respaldo_miaa.sql
--
-- Las rutas y lecturas son historial: si MIAA podría pedirlas después, NO corras esto.

BEGIN;
DROP TABLE IF EXISTS lecturas      CASCADE;  -- capturas de lecturas (dependían de rutas)
DROP TABLE IF EXISTS rutas         CASCADE;
DROP TABLE IF EXISTS fotos_informe CASCADE;  -- informes del primer prototipo
DROP TABLE IF EXISTS informes      CASCADE;
DROP TABLE IF EXISTS notas_queja   CASCADE;  -- quejas (con categoría, prioridad y estado)
DROP TABLE IF EXISTS fotos_queja   CASCADE;
DROP TABLE IF EXISTS quejas        CASCADE;
COMMIT;
