-- =====================================================================
-- Esquema de Usuarios y Roles (tarea 1.2) — REFERENCIA / documentación
-- No hace falta correrlo: Hibernate crea las tablas y columnas, y
-- config/CatalogoRoles.java llena "roles" y crea la llave foránea al arrancar.
-- Sirve para el documento técnico o para crear la base a mano (PostgreSQL).
-- =====================================================================

CREATE TABLE roles (
    clave        VARCHAR(30)  PRIMARY KEY,          -- 'ADMIN', 'NOTIFICADOR'
    nombre       VARCHAR(60)  NOT NULL,             -- nombre para mostrar
    descripcion  VARCHAR(255)
);

INSERT INTO roles (clave, nombre, descripcion) VALUES
    ('ADMIN',       'Administrador', 'Consulta los reportes y administra a los empleados.'),
    ('NOTIFICADOR', 'Notificador',   'Empleado de campo: sube reportes de domicilios.');

CREATE TABLE usuarios (
    id                        BIGSERIAL    PRIMARY KEY,
    nombre                    VARCHAR(255),
    username                  VARCHAR(255),       -- único (lo valida la app, sin importar mayúsculas)
    email                     VARCHAR(255),
    password                  VARCHAR(255),       -- hash BCrypt ($2a$..., 60 caracteres)
    rol                       VARCHAR(30)  REFERENCES roles (clave),   -- fk_usuarios_rol
    habilitado                BOOLEAN,            -- NULL o TRUE = puede entrar; FALSE = dado de baja
    debe_cambiar_password     BOOLEAN,            -- contraseña temporal pendiente de cambiar
    aviso_privacidad_version  VARCHAR(30),
    aviso_privacidad_fecha    TIMESTAMP,
    fecha_alta                TIMESTAMP,
    ultimo_acceso             TIMESTAMP,
    intentos_fallidos         INTEGER,            -- contraseñas incorrectas seguidas (bloqueo, tarea 1.6)
    bloqueado_hasta           TIMESTAMP,          -- NULL o pasada = no bloqueada
    ultima_conexion           TIMESTAMP,          -- último latido (presencia, tarea 2.4)
    conectado                 BOOLEAN             -- FALSE al cerrar sesión
);

-- El rol de campo antes se llamaba LECTURISTA. CatalogoRoles lo migra solo al arrancar;
-- a mano sería (en este orden, por la llave foránea):
--   INSERT INTO roles VALUES ('NOTIFICADOR', 'Notificador', 'Empleado de campo: sube reportes de domicilios.');
--   UPDATE usuarios SET rol = 'NOTIFICADOR' WHERE rol = 'LECTURISTA';
--   DELETE FROM roles WHERE clave = 'LECTURISTA';
