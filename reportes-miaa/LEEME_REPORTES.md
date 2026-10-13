# Reestructura: reportes de empleados (indicaciones de MIAA)

## Qué pidió MIAA y cómo quedó

| Indicación | Cómo quedó |
|---|---|
| El administrador **solo ve los reportes** de los empleados | Panel con dos secciones: **Reportes** (los de todos, del más nuevo al más viejo, con su autor) y **Empleados**. Abre cualquier reporte en **solo consulta**: no puede agregar notas ni cambiar fotos (el backend lo impide con 403). |
| Ver si el empleado está **activo o inactivo** | **Empleados**: *Activo* si inició sesión o subió un reporte en los últimos **7 días**; si no, *Inactivo*. Se calcula solo. Los días se cambian en `application.properties` → `miaa.empleados.dias-inactivo`. |
| Fotos con **buena resolución**, si no se rechazan | Mínimo **HD (1280×720)**, en vertical u horizontal. El celular la revisa al elegirla y el **servidor la vuelve a medir** (no le cree al cliente). Se reducen a máx. 1920 px (~1 MB) sin bajar de HD. |
| **Borrar imagen y volver a ponerla** (lecturista) | En el detalle de su reporte: **Quitar foto** (pide confirmación) y **Poner foto** (máx. 3). También al crearlo. |
| **Quitar los filtros**: solo el reporte y su descripción | Sin categoría, prioridad ni filtros. Un reporte es: **domicilio + descripción + fotos + notas**. |
| **Exportar** está de más | Se quitó. |
| **Priorizar la hora de captura** de la foto | Cada foto guarda **cuándo se tomó** (EXIF de la cámara; si no trae, la fecha del archivo) y aparte cuándo se subió. Se muestra "Tomada 9 oct 2026, 8:15 a.m." y se aclara cuando no vino de la cámara. |
| **Sin status** de los reportes | Sin estado (ni pendiente/resuelta) ni asignación. |
| **Quitar lo de las rutas** | Se quitaron rutas, el diseñador de rutas, la captura de lecturas y los "informes" del primer prototipo. |

## Instalación

1. **Haz un commit** antes de tocar nada (`git add -A && git commit -m "antes de reportes"`).
2. **Borra los archivos viejos**: copia `borrar-archivos-viejos.ps1` a la carpeta raíz del proyecto y córrelo:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\borrar-archivos-viejos.ps1
   ```
3. **Copia** `backend/` y `frontend/src/` de este zip sobre los tuyos. Incluye el `pom.xml` con el arreglo de Lombok.
   - ⚠️ Si tú o tu compañero cambiaron algo después de mis parches, revisa con `git diff` antes de confirmar.
4. **Backend** (en la terminal, NO con el botón ▶️ de VS Code):
   ```powershell
   cd backend
   mvn clean spring-boot:run
   ```
   Hibernate crea solo las tablas nuevas: `reportes`, `fotos_reporte`, `notas_reporte` y la columna `usuarios.ultimo_acceso`.
5. **Frontend**: `npm run dev`. No hay dependencias nuevas.
6. Cierra sesión y vuelve a entrar. Las direcciones viejas (`/mis-quejas`, `/lecturas`) redirigen al login.

**Usuarios de prueba:** `admin / admin123` → `/admin` · `lecturista1 / 123456` → `/reportes`

### Base de datos (opcional)
Las tablas viejas (`rutas`, `lecturas`, `informes`, `quejas`…) **siguen en PostgreSQL**: Hibernate nunca borra tablas. No estorban. Si quieren limpiarlas, está `limpiar-base-de-datos.sql`. **No se puede deshacer**: respalda antes con `pg_dump`. Si MIAA podría pedir ese historial después, mejor no lo corran.

## Endpoints

| Método | Ruta | Quién | Qué hace |
|---|---|---|---|
| POST | `/reportes` | LECTURISTA | Subir reporte (con hasta 3 fotos) |
| GET | `/reportes/mios` | LECTURISTA | Mis reportes |
| GET | `/reportes` | ADMIN | Reportes de todos |
| GET | `/reportes/{id}` | ambos | Detalle (el lecturista solo los suyos) |
| POST | `/reportes/{id}/notas` | LECTURISTA (autor) | Agregar nota |
| POST | `/reportes/{id}/fotos` | LECTURISTA (autor) | Poner foto |
| DELETE | `/reportes/{id}/fotos/{fotoId}` | LECTURISTA (autor) | Quitar foto |
| GET | `/usuarios/empleados` | ADMIN | Empleados con su estado activo/inactivo |

Una foto viaja así: `{ "datos": "data:image/jpeg;base64,...", "fechaCaptura": "2026-10-09T14:15:30Z", "origenFecha": "EXIF" }`

## Cómo funciona la hora de captura (para explicarlo en la presentación)

```
Celular toma la foto ──► el JPEG trae EXIF "DateTimeOriginal: 2026:10:09 08:15:30"
        │
utils/fotos.ts lee el EXIF ANTES de comprimir   (el <canvas> borra el EXIF)
        │   ¿no trae EXIF o es del futuro? → fecha del archivo → si tampoco, la hora actual
        ▼
POST { fechaCaptura: "2026-10-09T14:15:30Z", origenFecha: "EXIF" }   (UTC)
        │
ValidadorFotos.java: no puede ser del futuro (10 min de tolerancia) ni anterior al 2000
        ▼
fotos_reporte.fecha_captura  (+ fecha_subida aparte, solo como referencia)
```

## Archivos

**Backend nuevos:** `Reporte`, `FotoReporte`, `NotaReporte`, `OrigenFechaFoto` (entidades) · `ReporteRepository`, `FotoReporteRepository`, `NotaReporteRepository` · `ReporteService` (reglas de negocio), `ValidadorFotos` (HD y fecha), `EmpleadoService` (activo/inactivo) · `ReporteController` · DTOs `Reporte*`, `Foto*`, `Empleado*`.
**Backend modificados:** `Usuario` (+`ultimoAcceso`), `AuthController` (registra el acceso), `UsuarioController` (`/empleados`), `NotaDTO`, `SecurityConfig` y `GlobalExceptionHandler` (comentarios), `application.properties` (+días de inactividad), `pom.xml` (Lombok).
**Frontend nuevos:** `utils/fotos.ts` (EXIF + HD + compresión), `types/reporte.ts`, `services/reportesApi.ts`, `components/reportes/*` (detalle, lista, miniatura y visor de foto, compartidos por los dos roles), `components/admin/*` (marco, reportes, empleados), `lecturista/MisReportes`, `lecturista/NuevoReporte`; `MapaUbicacion` se movió a `components/mapa/`.
**Se conservan:** GPS, autollenado del domicilio y límite de Aguascalientes.

## Verificado
- **Backend:** 18 pruebas (HD exacto 1280×720, vertical, 1279×720 y 800×600 rechazadas, archivos que no son imagen, base64 dañado, fechas del futuro y de 1980, y las reglas de activo/inactivo, incluido el límite de 7 días). Revisión de compilación sin errores en nuestras clases (aquí no hay Maven: la compilación completa se confirma con `mvn clean spring-boot:run`).
- **Frontend:** 21 pruebas del lector de EXIF (Intel y Motorola, con zona horaria, sin EXIF, archivo truncado, cámara con la hora mal puesta). TypeScript, lint (0 errores) y `build`.
- **En el navegador, los dos roles:** foto de 800×600 rechazada, foto de 4032×3024 con EXIF → 1920×1440 con "Tomada 8:15 a.m.", el JSON ya no trae categoría ni prioridad, quitar y poner foto, admin sin botones de edición, tabla de empleados, y sin scroll horizontal en celular.

## Pendiente / a considerar
- `components/AvisoPrivacidadModal.tsx` ya no lo usa nadie (lo usaba la pantalla vieja). Si MIAA necesita aviso de privacidad por las fotos y la ubicación, se puede mostrar en el login o al primer reporte.
- Las fotos se guardan en base64 dentro de PostgreSQL. Para la demo está bien; con miles de reportes conviene guardarlas como archivos (disco o S3) y en la BD solo la ruta.
