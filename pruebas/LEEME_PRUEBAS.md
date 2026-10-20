# Pruebas del Sprint 1 — punto 5 (DoD / Calidad)

| Tarea | Archivo | Qué prueba | Herramienta |
|---|---|---|---|
| **5.1** Unitarias (back) | `backend/src/test/java/.../*Test.java` | Rate limit, bloqueo, JWT de 24 h, BCrypt, política de contraseñas, presencia | JUnit 5 |
| **5.1** Integración (back) | `test_5_1_api_auth.py` | Login, 401/403/423/429, token alterado, roles, logout y disponibilidad | pytest + requests |
| **5.1** Integración (front) | `test_5_1_ui_login.py` | Login web, sessionStorage, errores en pantalla, bloqueo, rate limit, ruteo por rol, cerrar sesión | **Selenium** |
| **5.2** HTTPS | `test_5_2_https.py` | TLS 1.2/1.3, TLS 1.0/1.1 rechazados, sin HTTP plano, redirección, certificado, que el navegador no haga peticiones sin cifrar | ssl + **Selenium** |
| **5.3** Concurrencia | `test_5_3_concurrencia.py` | 100 usuarios con login + consulta + latido **a la vez**, y 10 navegadores en paralelo | hilos + **Selenium** |
| **5.4** Aviso de privacidad | `test_5_4_aviso_privacidad.py` | El backend bloquea sin aviso, se guarda versión y fecha, el flujo en pantalla, que no se pueda brincar | requests + **Selenium** |

Cada prueba con navegador deja **capturas** en `reportes/capturas/`. Si una falla, también se guarda la pantalla del momento en que falló.

---

## Preparación (una sola vez)
1. **Python 3.10 o más** (`python --version`) y **Google Chrome**. Selenium descarga solo el *chromedriver* que corresponde (necesita internet la primera vez).
2. **Base de datos aparte** para las pruebas. Así no se ensucia la de desarrollo:
   ```powershell
   psql -U postgres -c "CREATE DATABASE miaa_pruebas;"
   ```
3. Copia `application-pruebas.properties` en `backend/src/main/resources/` y los `*Test.java` en `backend/src/test/java/...` (el zip ya trae la estructura).

## Correrlas
**1. Backend** con los perfiles `https` y `pruebas`:
```powershell
cd backend
.\mvnw spring-boot:run "-Dspring-boot.run.profiles=https,pruebas"
```
- `pruebas` usa la base `miaa_pruebas` y la **borra y recrea en cada arranque**. Siempre empieza limpia, con `admin` y `notificador1`.
- También hace que el backend crea la cabecera `X-Forwarded-For`, pero **solo si viene de esta misma PC**. Así cada usuario simulado tiene "su propia IP" y el rate limit (10 por IP) se mide de verdad. Si no, a los 10 logins se bloquearía toda la suite.

**2. Front:** `cd frontend` y luego `npm run dev:https`

**3. Pruebas unitarias (JUnit).** No necesitan base de datos:
```powershell
cd backend
.\mvnw test "-Dtest=*Test"
```
El patrón `*Test` deja fuera a `LecturasBackendApplicationTests`, que sí necesita la base. En la consola debe salir `Tests run: 31, Failures: 0`.

**4. Pruebas de integración, HTTPS, carga y aviso** (pytest + Selenium):
```powershell
cd pruebas
.\correr_pruebas.ps1              # todo, unos 2 minutos
.\correr_pruebas.ps1 -Ver         # con Chrome visible (para la demo)
.\correr_pruebas.ps1 -SinNavegador
```
Abre `pruebas\reportes\reporte.html`: ahí está cada prueba con su resultado, su tiempo y lo que imprimió.

Si no quieres usar el script:
```powershell
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m pytest -s
```
Para correr solo una tarea: `pytest test_5_3_concurrencia.py -s`. El `-s` muestra los tiempos en la consola.

### Variables (opcionales)
| Variable | Por defecto | Para qué |
|---|---|---|
| `MIAA_FRONT` | `https://localhost:5173` | URL del front |
| `MIAA_API` | `https://localhost:8500/api/v1` | URL de la API |
| `MIAA_ADMIN_USUARIO` / `MIAA_ADMIN_PASSWORD` | `admin` / `admin123` | Admin para preparar datos |
| `MIAA_INTENTOS_MAXIMOS` | `5` | Igual que `miaa.login.intentos-maximos` |
| `MIAA_USUARIOS_CARGA` | `100` | Usuarios simultáneos (5.3) |
| `MIAA_NAVEGADORES` | `10` | Chrome en paralelo (5.3). Bájalo si tu PC tiene poca RAM |
| `MIAA_P95_MAX_MS` | `5000` | Tiempo máximo aceptable del 95% de los logins |
| `MIAA_PUERTO_REDIRECCION` | `8090` | Puerto HTTP que redirige a HTTPS |
| `MIAA_HEADLESS` | `1` | `0` = ver el navegador |

En PowerShell: `$env:MIAA_NAVEGADORES="5"` antes de correr.

---

## Cómo leer cada resultado (lo que va en el reporte del sprint)

### 5.1 Autenticación
- **JUnit:** 31 pruebas en verde. Las 5 de `JwtUtilsTest` cubren la tarea 1.4: el token dura exactamente 86 400 s y se rechaza si fue alterado, si venció o si se firmó con otra llave.
- **API:** el bloqueo responde 423 en el 5.º intento, el rate limit responde 429 con `Retry-After` en el 11.º, y el notificador recibe 403 en los endpoints del admin.
- **Selenium:** capturas `5.1_*`: panel del admin, "Te queda 1 intento", "Cuenta bloqueada" con la cuenta regresiva, botón "Espera 0:57", "Acceso denegado" para el notificador y sesión cerrada.

### 5.2 HTTPS
- `test_negocia_tls_1_2_o_1_3` imprime la versión y el cifrado (p. ej. `TLSv1.3 / TLS_AES_256_GCM_SHA384`).
- Se rechazan TLS 1.0 y 1.1. El puerto 8500 no atiende HTTP plano y el 8090 redirige a `https://`.
- Selenium revisa **todas** las peticiones de la página: ninguna va por `http://`.
- `test_el_certificado_es_valido_para_el_host` **falla a propósito** si la IP cambió y no regeneraron el certificado.
- **Evidencia extra (manual) con Wireshark:**
  1. Captura en *Adapter for loopback traffic* con el filtro `tcp.port == 8500`.
  2. Inicia sesión.
  3. Solo verás `TLSv1.3 Application Data`. La contraseña no aparece por ningún lado.
  4. Toma la captura de pantalla para el reporte.

### 5.3 Concurrencia
En la consola (con `-s`) y en `reportes/carga_api.csv` sale algo así:
```
100 usuarios simultáneos en 3.7 s · fallas: 0
login      n=100  promedio= 2681 ms  p50= 2708  p95= 3471  máx= 3574
En línea según el panel del admin: 100/100
```
- **Criterio de aceptación:** 0 fallas y p95 ≤ 5 s con los 100 arrancando **en el mismo instante**. Eso es más duro que "100 usuarios activos" repartidos en el tiempo.
- El login tarda a propósito: **BCrypt es lento por diseño** para frenar ataques. Es normal que sea lo más lento.
- **¿Por qué no 100 navegadores?** Cada Chrome usa unos 150 MB de RAM, así que 100 serían como 15 GB. La carga real la ponen los 100 usuarios por API, y Selenium demuestra con 10 navegadores que la **interfaz** aguanta sesiones simultáneas. Si el profe pide más navegadores: `$env:MIAA_NAVEGADORES="20"`.

### 5.4 Aviso de privacidad
- **API:** sin aceptar el aviso, `GET /reportes/mios` responde **403 REQUISITO_PENDIENTE**. Aceptar una versión vieja da 409. Al aceptar queda la **fecha** en la ficha del empleado.
- **Selenium:** capturas `5.4_aviso_mostrado` (con el botón deshabilitado), `5.4_aviso_marcado` y `5.4_aviso_aceptado`. Al volver a entrar ya no se lo vuelve a pedir, y escribir `/reportes` en la barra no permite brincarlo.

---

## Si algo falla
| Mensaje | Causa |
|---|---|
| `No hay respuesta de la API` | El backend no está corriendo o no usa el perfil `https` |
| `El backend NO está usando la IP de cada usuario` | Falta el perfil `pruebas` (`-Dspring-boot.run.profiles=https,pruebas`) |
| `SessionNotCreatedException` / chromedriver | Actualiza Chrome. Sin internet, Selenium no puede bajar el driver: define `MIAA_CHROMEDRIVER` con la ruta |
| `El certificado no incluye '…'` | Regenera `backend/certificados/miaa-dev.p12` con la IP actual |
| 5.3 falla por tiempo | Tu PC está ocupada: cierra programas o sube `MIAA_P95_MAX_MS` y anótalo en el reporte |
| `test_notificador_no_puede_usar_el_panel_web` falla | Cambiaron la regla 3.3 y el notificador ya puede usar la web. Actualiza esa prueba y la del aviso |

## Cómo se verificó este paquete
- **JUnit:** se corrieron 23 de las 31 pruebas contra las clases reales del proyecto, y todas pasan. `JwtUtilsTest` y `HashPasswordTest` necesitan las librerías de Maven (jjwt y Spring Security), que no estaban disponibles donde se armó. Confírmalas con `.\mvnw test "-Dtest=*Test"`.
- **pytest + Selenium:** se corrieron completas (36 pasan y 1 se salta: HSTS, que es de producción) contra **su front real**, en Chrome sin ventana. El backend fue uno **simulado** que replica las reglas de sus `.java`. También se le metieron dos errores a propósito (bloqueo apagado y aviso no exigido) y las pruebas los detectaron.
- Como el backend de verdad no se pudo correr ahí, la primera corrida en su PC es la prueba final. Si algo no cuadra, el mensaje dice qué se esperaba.
