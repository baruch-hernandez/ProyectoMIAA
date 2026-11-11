# MIAA — Reportes de campo de notificadores

Sistema para que los **notificadores** de MIAA (Aguascalientes) levanten reportes desde la calle y los **administradores** los revisen. Cada reporte lleva el domicilio, una descripción y hasta 3 fotos de evidencia con su hora y su punto GPS. Los administradores ven los reportes, dan de alta a los empleados y ven en un mapa dónde está cada notificador.

El proyecto tiene tres partes que hablan con la misma API:

| Parte | Carpeta | Tecnología | Quién la usa |
| --- | --- | --- | --- |
| **API** | [backend/](backend/) | Java 17 · Spring Boot 3.2 · Spring Security + JWT · JPA/Hibernate · PostgreSQL | Todos (a través de la web o la app) |
| **Panel web** | [frontend/](frontend/) | React 19 · TypeScript · Vite · Redux Toolkit · Tailwind · Leaflet | Admin (y notificador desde el navegador) |
| **App móvil** | [movil/](movil/) | Flutter (Dart) · Dio · CameraX · geolocator · flutter_map | Notificador en campo (Android) |
| **Pruebas de sistema** | [pruebas/](pruebas/) | Python · pytest · Selenium | Equipo (evidencia de sprint) |

---

## 1. Arquitectura

```text
 ┌──────────────────────┐        ┌──────────────────────┐
 │  App Flutter         │        │  Panel web (React)   │
 │  (notificador)       │        │  https://…:5173      │
 │  cámara + GPS        │        │  Vite reenvía /api → │
 └─────────┬────────────┘        └─────────┬────────────┘
           │ HTTPS + JWT                   │ HTTPS + JWT
           ▼                               ▼
 ┌──────────────────────────────────────────────────────┐
 │  API Spring Boot   https://…:8500/api/v1             │
 │  Filtros: rate limit login → JWT → requisitos        │
 │  Controllers → Services (reglas) → Repositories      │
 └─────────────────────────┬────────────────────────────┘
                           │ JPA
                           ▼
                 ┌──────────────────┐
                 │  PostgreSQL      │
                 │  base "miaa"     │
                 └──────────────────┘
```

- **Sin sesiones en el servidor.** Al iniciar sesión, la API entrega un JWT de 24 h y cada petición lo manda en `Authorization: Bearer …`.
- **Todo va cifrado.** En desarrollo, Spring atiende TLS directamente con un certificado autofirmado. El puerto 8500 no acepta HTTP plano y el 8090 redirige a HTTPS.
- **Las reglas viven en el backend.** La web y la app validan lo mismo para dar buena experiencia, pero quien decide es la API: tamaño de fotos, límite del estado, quién puede editar qué.

---

## 2. Estructura del repositorio

```text
ProyectoMIAA/
├─ backend/
│  ├─ src/main/java/com/miaa/lecturas/
│  │  ├─ controllers/   endpoints REST (Auth, Cuenta, Reporte, Ubicacion, Usuario)
│  │  ├─ services/      reglas de negocio (ReporteService, EmpleadoService, BloqueoPorIntentos…)
│  │  ├─ repositories/  Spring Data JPA
│  │  ├─ entities/      tablas (Usuario, Reporte, FotoReporte, NotaReporte, UbicacionEmpleado, Rol)
│  │  ├─ dtos/          lo que entra y sale por la API (records con validaciones)
│  │  ├─ config/        seguridad, JWT, CORS, rate limit, redirección HTTPS, catálogo de roles
│  │  └─ DataInitializer.java   usuarios de prueba (no corre con el perfil "prod")
│  ├─ src/main/resources/
│  │  ├─ application.properties          configuración base
│  │  ├─ application-https.properties    perfil "https" (puerto, TLS, CORS)
│  │  ├─ application-pruebas.properties  perfil "pruebas" (base aparte que se recrea)
│  │  └─ geo/aguascalientes.json         contorno del estado (386 puntos)
│  ├─ src/test/java/…   pruebas unitarias JUnit 5 + Mockito
│  ├─ docs/esquema-usuarios-roles.sql    esquema de referencia (no hace falta correrlo)
│  └─ generar-certificado.ps1            crea el certificado HTTPS de desarrollo
├─ frontend/
│  └─ src/
│     ├─ components/admin/        reportes, empleados, mapa de ubicación
│     ├─ components/notificador/  mis reportes, nuevo, editar
│     ├─ components/cuenta/       contraseña temporal y aviso de privacidad
│     ├─ services/                llamadas a la API (axios)
│     ├─ store/                   sesión con Redux Toolkit
│     ├─ hooks/                   presencia, compartir ubicación, cola sin señal
│     └─ utils/                   GPS, límite de Ags, fotos, cola en IndexedDB
├─ movil/
│  ├─ lib/
│  │  ├─ core/        API (Dio), config, reloj del servidor, canal nativo
│  │  ├─ auth/        login y token cifrado
│  │  ├─ reportes/    lista, nuevo, editar, borrador persistente, envío
│  │  ├─ fotos/       cámara, vista previa, compresión y EXIF
│  │  ├─ ubicacion/   GPS, reglas de precisión, mapa, límite de Ags, geocodificador
│  │  ├─ permisos/    pedir permisos y mandar a Ajustes
│  │  ├─ presencia/   latido "en línea"
│  │  └─ diagnostico/ prueba de conexión paso a paso
│  ├─ test/              pruebas unitarias y de widgets
│  ├─ integration_test/  ciclo completo de fotos en emulador
│  └─ config/            dev.json (emulador) y celular.json (celular real)
└─ pruebas/           pytest + Selenium: auth, HTTPS, carga de 100 usuarios, aviso
```

---

## 3. Requisitos

| Herramienta | Versión | Para qué |
| --- | --- | --- |
| JDK | 17 o más (probado con 21) | Backend. Trae `keytool` para el certificado |
| PostgreSQL | 14 o más | Base de datos |
| Node.js | 22 LTS (Vite 8 pide ≥ 20.19) | Panel web |
| Flutter | estable reciente (Dart ≥ 3.13) | App móvil |
| Android Studio + SDK Platform 37 | — | Emulador y compilar la app ([detalles](movil/LEEME_SPRINT2.md)) |
| Python 3.10+ y Chrome | — | Solo para la carpeta `pruebas/` |

No hace falta instalar Maven: el backend trae su wrapper (`mvnw`).

---

## 4. Puesta en marcha paso a paso (Windows / PowerShell)

### 4.1 Base de datos

```powershell
psql -U postgres -c "CREATE DATABASE miaa;"
```

Usuario y contraseña de la base se definen en [application.properties](backend/src/main/resources/application.properties) (`postgres` / `1234` por defecto). Cámbialos si tu instalación usa otros.

**No hace falta crear tablas:** Hibernate las crea y actualiza al arrancar (`ddl-auto=update`), y [CatalogoRoles.java](backend/src/main/java/com/miaa/lecturas/config/CatalogoRoles.java) llena la tabla de roles.

### 4.2 Certificado HTTPS de desarrollo

Una sola vez por PC, desde la carpeta `backend`:

```powershell
cd backend
powershell -ExecutionPolicy Bypass -File .\generar-certificado.ps1
```

Crea `backend/certificados/miaa-dev.p12` (contraseña `miaa-dev`), válido para `localhost` y para todas las IP de tu PC. Lo usan el backend y el servidor de Vite.

> Si la IP de tu PC cambia (otra red wifi), borra el `.p12` y vuelve a generarlo. Después vuelve a exportar el `.pem` para la app (paso 4.5).

### 4.3 Backend

```powershell
cd backend
.\mvnw spring-boot:run
```

- Arranca en **`https://localhost:8500`** con el perfil `https`, que ya viene activo en `application.properties`.
- La primera vez crea los usuarios de prueba (sección 5).
- Para comprobar que responde: `curl.exe -k https://localhost:8500/api/v1/auth/login` debe contestar (aunque sea con error de método).

### 4.4 Panel web

```powershell
cd frontend
npm install
npm run dev:https
```

Abre **`https://localhost:5173`** y acepta el aviso del certificado autofirmado.

- Vite reenvía `/api/...` al backend (proxy en [vite.config.ts](frontend/vite.config.ts)). Así el navegador solo habla con un sitio: no hay problemas de CORS y solo se acepta un certificado.
- `host: true` deja entrar desde otros equipos y desde el celular con `https://<IP-de-tu-PC>:5173`. El navegador solo da el GPS en páginas HTTPS.
- Si corres el backend **sin** el perfil `https`, arranca el front con `$env:MIAA_API_DESTINO="http://localhost:8500"; npm run dev:https`.

### 4.5 App móvil

```powershell
cd movil
flutter pub get

# Certificado PÚBLICO del backend para que la app confíe en él (solo en debug)
keytool -exportcert -rfc -alias miaa -keystore ..\backend\certificados\miaa-dev.p12 -storepass miaa-dev -file assets\dev\miaa-dev.pem

flutter run --dart-define-from-file=config/dev.json       # emulador (la PC es 10.0.2.2)
flutter run --dart-define-from-file=config/celular.json   # celular real
```

**Si usas un celular real:**

1. En [config/celular.json](movil/config/celular.json), cambia `API_URL` por la IP de tu PC (`ipconfig` → *Dirección IPv4*).
2. Conecta la PC y el celular a la misma red wifi.
3. Abre el puerto en el firewall (PowerShell como administrador):

   ```powershell
   New-NetFirewallRule -DisplayName "MIAA API 8500" -Direction Inbound -Protocol TCP -LocalPort 8500 -Action Allow
   ```

En la pantalla de login está **"Probar conexión con el servidor"**: dice exactamente qué falla (URL, certificado, red o sesión).

---

## 5. Usuarios de prueba

Los crea [DataInitializer.java](backend/src/main/java/com/miaa/lecturas/DataInitializer.java) en cualquier perfil excepto `prod`:

| Usuario | Contraseña | Rol | Dónde entra |
| --- | --- | --- | --- |
| `admin` | `admin123` | ADMIN | Panel web |
| `notificador1` | `notificador1` | NOTIFICADOR | App móvil y web |

La app móvil rechaza al admin ("Esta app es solo para notificadores").

---

## 6. Cómo funciona

### 6.1 Inicio de sesión y seguridad

1. `POST /api/v1/auth/login` compara la contraseña con su hash **BCrypt** y devuelve un **JWT** firmado (HS256) que dura 24 h ([JwtUtils.java](backend/src/main/java/com/miaa/lecturas/config/JwtUtils.java)).
2. En cada petición, [JwtAuthFilter](backend/src/main/java/com/miaa/lecturas/config/JwtAuthFilter.java) valida el token, carga al usuario y revisa que siga habilitado.
3. Hay dos frenos contra la fuerza bruta:
   - **Rate limit por IP** ([LimiteLoginFilter](backend/src/main/java/com/miaa/lecturas/config/LimiteLoginFilter.java)): más de 10 intentos de login por minuto → **429** con `Retry-After`.
   - **Bloqueo de cuenta** ([BloqueoPorIntentos](backend/src/main/java/com/miaa/lecturas/services/BloqueoPorIntentos.java)): 5 contraseñas incorrectas seguidas → **423**, cuenta bloqueada 15 min. El admin puede desbloquearla.
4. **Roles:** `@PreAuthorize("hasRole('ADMIN')")` o `'NOTIFICADOR'` en cada controller. Además, los services revisan que el reporte sea tuyo antes de tocarlo.
5. **Requisitos de la cuenta:** si el usuario tiene una contraseña temporal (porque el admin lo dio de alta o se la restableció) o no ha aceptado la versión vigente del aviso de privacidad, toda la API responde **403 `REQUISITO_PENDIENTE`**. Solo puede usar las rutas de su cuenta (`/usuarios/yo/...`). La web lo manda a `/cuenta/requisitos`.

En el celular, el token se guarda cifrado con `flutter_secure_storage`. En la web vive en `sessionStorage`, así que se borra al cerrar la pestaña.

### 6.2 Reportes

Un reporte tiene:

- el **domicilio**: calle, número, colonia, CP y municipio (uno de los 11 de Ags), más referencias;
- el número de contrato (opcional);
- el **punto del domicilio** en el mapa (opcional);
- una **descripción**;
- de **1 a 3 fotos**.

| Regla | Dónde se aplica |
| --- | --- |
| Fotos JPG/PNG, mínimo 1280×720, ~1.8 MB máximo | [ValidadorFotos.java](backend/src/main/java/com/miaa/lecturas/services/ValidadorFotos.java) (la app y la web comprimen antes de enviar) |
| El punto debe caer **dentro del contorno de Aguascalientes** | [LimiteAguascalientes.java](backend/src/main/java/com/miaa/lecturas/services/LimiteAguascalientes.java), con el mismo contorno en la web (`limiteAgs.ts`) y en la app (`limite_ags.dart`) |
| El notificador solo puede editar o borrar **sus** reportes, y solo durante **24 h** | [ReporteService.java](backend/src/main/java/com/miaa/lecturas/services/ReporteService.java) |
| Después de 24 h ya no se edita, pero se pueden agregar **notas** | `POST /reportes/{id}/notas` |
| Un reporte reenviado (se cortó la señal) **no se duplica** | Cada reporte lleva un `clienteId` (UUID) generado en el dispositivo |

Las fotos se guardan en la base como texto base64 (columna `datos` de `fotos_reporte`).

### 6.3 Fotos de evidencia: hora y GPS

Cada foto guarda **cuándo** y **dónde** se tomó. Los campos `fecha_captura`, `origen_foto`, `latitud`, `longitud` y `precision_gps` no se pueden cambiar una vez guardados (`updatable = false`).

**Hora de captura** ([procesador_fotos.dart](movil/lib/fotos/procesador_fotos.dart)), en este orden de prioridad:

1. **Cámara de la app:** el instante del disparo, corregido con el reloj del servidor. [RelojServidor](movil/lib/core/reloj.dart) lee el encabezado HTTP `Date` de cada respuesta y, entre una respuesta y otra, avanza con el contador de arranque del celular. Si el reloj del celular está movido, aun sin red, la hora no se altera. Si el servidor no ha contestado desde que se abrió la app, la hora queda como no verificada.
2. **Foto de galería:** la fecha EXIF `DateTimeOriginal`, respetando la zona horaria.
3. La fecha del archivo, y si no hay otra, la hora en que se eligió la foto.

Cada foto también manda `origenFecha` (OBTURADOR, EXIF, ARCHIVO o SUBIDA) para saber qué tan confiable es la hora, y `origenFoto` (CAMARA o GALERIA; la web no lo manda). La app solo agrega fotos con la cámara o la galería.

**Punto GPS** (solo en fotos tomadas con la cámara de la app; reglas en [reglas_gps.dart](movil/lib/ubicacion/reglas_gps.dart)):

- Con la ubicación apagada, la ubicación aproximada o el ahorro de batería activo **no deja tomar la foto** y ofrece abrir los ajustes.
- Durante los primeros **10 s** escucha solo el chip GPS (`GPS_PROVIDER`, por un canal nativo en [MainActivity.kt](movil/android/app/src/main/kotlin/mx/gob/miaa/movil/MainActivity.kt)) y busca **±1 m**. Un semáforo lo muestra: verde ≤ 1 m, amarillo ≤ 5 m, rojo > 5 m. El `forceLocationManager` de geolocator no sirve para esto: en Android 12+ elige el proveedor fusionado.
- La foto se queda con la **lectura más precisa de los últimos 5 s**, no con la última. La precisión es la que reporta Android: la app nunca la ajusta, así que el ±1 m depende del chip del celular y del cielo despejado.
- Si en ese tiempo no llega a ±1 m (por ejemplo, un medidor bajo techo) **deja tomar la foto igual**. Si además no hay lectura útil, suma wifi y antenas sin soltar el chip:
  - con la mejor lectura que haya, si es de ±20 m o mejor;
  - **sin coordenadas**, si no hay ninguna que sirva.
- El punto y la hora se escriben también en el **EXIF del JPG** y se muestran en una tarjeta en la vista previa.
- El backend vuelve a validar: las tres coordenadas juntas o ninguna, precisión ≤ 20 m y dentro de Aguascalientes.

### 6.4 Sin señal

- **App:** el reporte en curso se guarda como **borrador** en la carpeta privada de la app, una por usuario. Si se cierra la app, el reporte y sus fotos siguen ahí.
- **Web:** si no hay red al enviar, el reporte se guarda en **IndexedDB** ([colaReportes.ts](frontend/src/utils/colaReportes.ts)) y se envía solo cuando vuelve la conexión.

### 6.5 Presencia y ubicación en vivo

- **Activo / Inactivo:** con la sesión iniciada y la app a la vista, la app y la web mandan un latido cada 30 s (`POST /usuarios/yo/conexion`). Al cerrar sesión pasa a inactivo de inmediato. Si no llega nada en 60 s (pantalla o celular apagados, app al fondo o cerrada, pestaña oculta o sin señal), también.
- **Ubicación del notificador** ([UbicacionService.java](backend/src/main/java/com/miaa/lecturas/services/UbicacionService.java)):
  - el celular manda su posición cada ~20 s (`POST /ubicacion`);
  - el admin, con el mapa abierto, consulta cada 5 s.
  - Es "casi tiempo real" sin WebSockets.

---

## 7. API

Todas las rutas existen con y sin el prefijo `/api/v1`. Todas, menos el login, piden `Authorization: Bearer <token>`.

| Método | Ruta | Rol | Qué hace |
| --- | --- | --- | --- |
| POST | `/auth/login` | — | Usuario y contraseña → token |
| POST | `/auth/logout` | cualquiera | Marca desconectado |
| GET | `/usuarios/yo` | cualquiera | Mi cuenta y mis requisitos pendientes |
| PUT | `/usuarios/yo/password` | cualquiera | Cambiar mi contraseña |
| POST | `/usuarios/yo/aviso-privacidad` | cualquiera | Aceptar el aviso (con su versión) |
| POST | `/usuarios/yo/conexion` | cualquiera | Latido "en línea" |
| POST | `/reportes` | NOTIFICADOR | Crear reporte con fotos |
| GET | `/reportes/mios` | NOTIFICADOR | Mis reportes |
| GET | `/reportes` | ADMIN | Todos los reportes |
| GET | `/reportes/{id}` | los dos* | Detalle (*el notificador solo ve los suyos) |
| PUT / DELETE | `/reportes/{id}` | NOTIFICADOR | Editar o borrar (24 h) |
| POST | `/reportes/{id}/notas` | NOTIFICADOR | Agregar nota |
| POST / DELETE | `/reportes/{id}/fotos[/{fotoId}]` | NOTIFICADOR | Agregar o quitar foto (24 h) |
| POST / DELETE | `/ubicacion` | NOTIFICADOR | Mandar mi ubicación o dejar de compartirla |
| GET / POST | `/usuarios/empleados` | ADMIN | Listar empleados o dar de alta uno |
| GET / PUT | `/usuarios/empleados/{id}` | ADMIN | Ver o editar empleado |
| GET | `/usuarios/empleados/{id}/ubicacion` | ADMIN | Última ubicación del empleado |
| POST | `/usuarios/empleados/{id}/password` | ADMIN | Restablecer contraseña (queda como temporal) |
| PUT | `/usuarios/empleados/{id}/habilitado` | ADMIN | Dar de baja o de alta |
| POST | `/usuarios/empleados/{id}/desbloquear` | ADMIN | Quitar el bloqueo por intentos |

**Errores:** responden en JSON, `{ "status", "message" }`. Las validaciones devuelven **400** con `{ message, errores: { campo: "mensaje" } }` ([GlobalExceptionHandler](backend/src/main/java/com/miaa/lecturas/exceptions/GlobalExceptionHandler.java)).

---

## 8. Modelo de datos

```text
roles ──< usuarios ──< reportes ──< fotos_reporte
              │            └─────< notas_reporte
              └── ubicaciones_empleado (1 a 1: la última posición)
```

| Tabla | Campos clave |
| --- | --- |
| `usuarios` | username, hash BCrypt, rol, habilitado, `debe_cambiar_password`, versión y fecha del aviso aceptado, intentos fallidos, `bloqueado_hasta`, última conexión |
| `reportes` | domicilio, municipio, latitud/longitud, descripción, `cliente_id` (UUID anti-duplicados), autor, fechas de creación y edición |
| `fotos_reporte` | imagen (base64), ancho/alto, `fecha_captura` (timestamptz) y su origen, lat/lng/precisión del GPS, desfase del reloj |
| `notas_reporte` | texto, autor, fecha |
| `ubicaciones_empleado` | última posición, precisión, si está compartiendo |

[docs/esquema-usuarios-roles.sql](backend/docs/esquema-usuarios-roles.sql) tiene el SQL de referencia de usuarios y roles.

---

## 9. Pruebas

```powershell
# Backend: unitarias (no necesitan base de datos)
cd backend
.\mvnw test "-Dtest=*Test"

# App móvil: unitarias y de widgets (sin celular)
cd movil
flutter analyze
flutter test
flutter test integration_test/ciclo_fotos_test.dart -d emulator-5554   # en emulador

# Pruebas de sistema: auth, HTTPS, 100 usuarios simultáneos, aviso (pytest + Selenium)
# Necesitan el backend con: .\mvnw spring-boot:run "-Dspring-boot.run.profiles=https,pruebas"
cd pruebas
.\correr_pruebas.ps1
```

El perfil `pruebas` usa otra base (`miaa_pruebas`) que **se borra y recrea en cada arranque**. Créala una vez con `psql -U postgres -c "CREATE DATABASE miaa_pruebas;"`. Los detalles están en [pruebas/LEEME_PRUEBAS.md](pruebas/LEEME_PRUEBAS.md).

---

## 10. Configuración que más se toca

En [application.properties](backend/src/main/resources/application.properties):

| Propiedad | Valor | Qué controla |
| --- | --- | --- |
| `spring.datasource.*` | `localhost:5432/miaa`, `postgres`/`1234` | Conexión a PostgreSQL |
| `jwt.secret` | variable `JWT_SECRET` (con un valor de desarrollo por defecto) | Firma de los tokens |
| `jwt.expiration` | `86400000` (24 h) | Duración del token |
| `miaa.login.max-por-ip` / `ventana-segundos` | `10` / `60` | Rate limit del login |
| `miaa.login.intentos-maximos` / `minutos-bloqueo` | `5` / `15` | Bloqueo de cuenta |
| `miaa.reportes.horas-para-modificar` | `24` | Ventana de edición |
| `miaa.aviso-privacidad.version` | `2026-10` | Al cambiarla, todos vuelven a aceptar el aviso. Cámbiala junto con `frontend/src/utils/avisoPrivacidad.ts` |
| `miaa.cors.origenes` | en `application-https.properties` | Desde qué URL puede llamar el front (acepta `*`) |

En la app, [config/*.json](movil/config/):

- `API_URL`: URL del backend;
- `CERT_DEV`: confiar en el certificado de desarrollo;
- `LATIDO_SEGUNDOS` (opcional, 1 por defecto): cada cuánto se manda el latido. El backend da 2 s de margen (`miaa.presencia.segundos-en-linea`), así que si lo subes, sube también ese valor.

---

## 11. Para aprender del proyecto: por dónde leer

Un recorrido sugerido, de lo más simple a lo más interesante:

1. **Una petición de punta a punta.** Lee en este orden:
   - [LoginRequestDTO](backend/src/main/java/com/miaa/lecturas/dtos/LoginRequestDTO.java)
   - [AuthController](backend/src/main/java/com/miaa/lecturas/controllers/AuthController.java)
   - [JwtUtils](backend/src/main/java/com/miaa/lecturas/config/JwtUtils.java)
   - y del lado del cliente, [services/api.ts](frontend/src/services/api.ts) o [core/api.dart](movil/lib/core/api.dart), que agregan el token y reaccionan al 401.
2. **La cadena de seguridad.** [SecurityConfig](backend/src/main/java/com/miaa/lecturas/config/SecurityConfig.java) muestra el orden de los filtros y cómo se responden el 401 y el 403 en JSON.
3. **Reglas de negocio con pruebas.** Lee [ReporteService](backend/src/main/java/com/miaa/lecturas/services/ReporteService.java) junto con [ReporteServiceTest](backend/src/test/java/com/miaa/lecturas/services/ReporteServiceTest.java). Las pruebas usan Mockito, así que no necesitan base de datos.
4. **Geometría simple.** [LimiteAguascalientes](backend/src/main/java/com/miaa/lecturas/services/LimiteAguascalientes.java) decide si un punto está dentro del estado (punto en polígono).
5. **Trabajo sin señal.** Hay dos enfoques para comparar:
   - la web: [colaReportes.ts](frontend/src/utils/colaReportes.ts), con IndexedDB y `clienteId` para no duplicar;
   - la app: [borrador_reporte.dart](movil/lib/reportes/borrador_reporte.dart).
6. **Hardware del celular.**
   - [pantalla_camara.dart](movil/lib/fotos/pantalla_camara.dart) y [reglas_gps.dart](movil/lib/ubicacion/reglas_gps.dart): cámara, GPS y cuándo dejar tomar la foto.
   - [procesador_fotos.dart](movil/lib/fotos/procesador_fotos.dart): comprimir en un isolate y escribir EXIF a mano.
7. **Inyección para poder probar.** La app recibe sus dependencias por constructor (`FuenteGps`, `FuenteFotos`…), y las pruebas les pasan versiones falsas desde [test/apoyo/falsos.dart](movil/test/apoyo/falsos.dart).

---

## 12. Problemas comunes

| Síntoma | Causa y solución |
| --- | --- |
| El backend no arranca: `certificados/miaa-dev.p12` no existe | Corre `generar-certificado.ps1` (paso 4.2) |
| Vite: `EPROTO … packet length too long` | El backend corre sin `https` y Vite le habla en HTTPS. Usa `MIAA_API_DESTINO` (paso 4.4) |
| App: "el certificado no es de confianza" | Falta `assets/dev/miaa-dev.pem`, o se regeneró el `.p12` y no se volvió a exportar. Después de cambiarlo, detén la app y vuelve a correrla: el hot reload no basta |
| App: "Connection refused" o tiempo agotado en el celular | IP equivocada en `celular.json`, otra red wifi o el firewall bloquea el 8500 |
| 403 `REQUISITO_PENDIENTE` | El usuario debe cambiar su contraseña temporal o aceptar el aviso de privacidad |
| 423 al iniciar sesión | Cuenta bloqueada por intentos: espera 15 min o que el admin la desbloquee |
| 429 al iniciar sesión | Demasiados intentos desde la misma IP: espera un minuto |
| Gradle pide la plataforma 37 | Instálala en Android Studio → SDK Platforms → Android 17 (API 37) |

Más detalle por tema: [movil/LEEME_FLUTTER.md](movil/LEEME_FLUTTER.md) (conexión de la app), [movil/LEEME_SPRINT2.md](movil/LEEME_SPRINT2.md) (fotos y permisos) y [movil/LEEME_UBICACION.md](movil/LEEME_UBICACION.md) (mapa y GPS).

---

## 13. Antes de llevarlo a producción

Esta configuración es de **desarrollo**. Para un servidor real falta:

- **Secretos:**
  - definir `JWT_SECRET` (64+ caracteres hexadecimales) y la contraseña de PostgreSQL con variables de entorno;
  - no usar los valores por defecto del repo.
- **Perfil `prod`:** así no se crean `admin/admin123` ni `notificador1`.
- **Certificado real:**
  - `backend/certificados/miaa-dev.p12` está en el repositorio con su llave privada; solo sirve para desarrollo;
  - en producción va Caddy o Nginx enfrente, con Let's Encrypt;
  - activa HSTS (`miaa.seguridad.hsts=true`).
- **Base de datos:** cambiar `ddl-auto=update` por migraciones (Flyway o Liquibase).
- **Mapas y geocodificación:**
  - Nominatim y los mosaicos de OpenStreetMap tienen límites de uso;
  - conviene un proveedor con contrato (en la app se cambia `GEOCODER_URL`).
- **Spring Boot 3.2** ya no tiene soporte: actualizar a 3.5.
- **App:** compilar en release (`flutter build apk --release`). En release, la app no confía en el certificado de desarrollo.
