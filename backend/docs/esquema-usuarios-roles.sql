-- =====================================================================
-- Esquema de Usuarios y Roles (tarea 1.2) — REFERENCIA / documentación
-- No hace falta correrlo: Hibernate crea las tablas y columnas, y
-- config/CatalogoRoles.java llena "roles" y crea la llave foránea al arrancar.
-- Sirve para el documento técnico o para crear la base a mano (PostgreSQL).
-- =====================================================================

CREATE TABLE roles (
    clave        VARCHAR(30)  PRIMARY KEY,          -- 'ADMIN', 'LECTURISTA'
    nombre       VARCHAR(60)  NOT NULL,             -- nombre para mostrar
    descripcion  VARCHAR(255)
);

INSERT INTO roles (clave, nombre, descripcion) VALUES
    ('ADMIN',      'Administrador', 'Consulta los reportes y administra a los empleados.'),
    ('LECTURISTA', 'Lecturista',    'Empleado de campo (notificador): sube reportes de domicilios.');

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
    bloqueado_hasta           TIMESTAMP           -- NULL o pasada = no bloqueada
);

-- Si algún día renombran el rol (p. ej. a "Notificador") SOLO para mostrarlo:
--   UPDATE roles SET nombre = 'Notificador' WHERE clave = 'LECTURISTA';
-- Cambiar la CLAVE ('LECTURISTA' → 'NOTIFICADOR') implica tocar el código (@PreAuthorize, front).
