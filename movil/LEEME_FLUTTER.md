# App Flutter de prueba — MIAA Notificador

Primera versión de la app de campo. Sirve para **comprobar que el backend funciona desde el celular**:
- inicio de sesión;
- token guardado cifrado;
- solo entra el rol NOTIFICADOR;
- latido de la 2.4 cada 30 s;
- cerrar sesión;
- una pantalla de **diagnóstico** que dice exactamente qué falla (URL, certificado, red o sesión).

## Estructura
```
notificador_miaa/
├─ config/
│  ├─ dev.json          ← emulador (la PC es 10.0.2.2)
│  └─ celular.json      ← celular real (la IP de tu PC)
├─ assets/dev/
│  └─ miaa-dev.pem      ← certificado PÚBLICO del backend (lo generas tú, paso 3)
├─ lib/
│  ├─ main.dart                     arranque + tema MIAA + "puerta" (Login ↔ Inicio)
│  ├─ core/
│  │  ├─ config.dart                API_URL y demás, desde config/*.json
│  │  └─ api.dart                   Dio + interceptores (token, 401) + certificado de desarrollo
│  ├─ auth/
│  │  ├─ sesion.dart                login, logout, token cifrado (flutter_secure_storage)
│  │  └─ pantalla_login.dart        formulario + errores (bloqueo 423, rate limit 429)
│  ├─ presencia/
│  │  └─ latido.dart                POST /usuarios/yo/conexion cada 30 s (tarea 2.4)
│  ├─ inicio/
│  │  └─ pantalla_inicio.dart       "Hola, …", estado En línea y GET /usuarios/yo
│  └─ diagnostico/
│     └─ pantalla_diagnostico.dart  prueba la conexión paso por paso
└─ test/
   └─ widget_test.dart              pruebas unitarias (flutter test)
```
Es el equivalente de lo que ya tienen en la web: `api.ts` → `core/api.dart`, `sesion.ts` → `auth/sesion.dart` y `usePresencia.ts` → `presencia/latido.dart`.

## Pasos para correrlo

### 1. Copiar los archivos
Descomprime el zip **encima** de tu proyecto `notificador_miaa`. Va a reemplazar `lib/main.dart` y `test/widget_test.dart`; el resto son archivos nuevos.

### 2. Agregar los paquetes
En la terminal de Android Studio, dentro de `notificador_miaa`:
```powershell
flutter pub add dio flutter_secure_storage
```
Y en `pubspec.yaml`, dentro de la sección `flutter:` (respeta la sangría de 2 espacios):
```yaml
flutter:
  uses-material-design: true
  assets:
    - assets/dev/
```

### 3. Certificado de desarrollo (para que la app confíe en el HTTPS del backend)
Desde la carpeta `backend`:
```powershell
keytool -exportcert -rfc -alias miaa -keystore certificados\miaa-dev.p12 -storepass miaa-dev -file ..\notificador_miaa\assets\dev\miaa-dev.pem
```
- Solo se exporta la parte **pública**: no es secreto.
- En **debug**, la app confía en **ese certificado exacto y en ningún otro**, así que funciona aunque cambie la IP de la PC.
- **Si regeneran el `.p12`, hay que volver a exportarlo.**

### 4. `android/app/src/main/AndroidManifest.xml`
Arriba de `<application`:
```xml
<uses-permission android:name="android.permission.INTERNET"/>
```
Y dentro de la etiqueta `<application ...>`, agrega:
```xml
android:allowBackup="false"
android:usesCleartextTraffic="false"
```

### 5. URL del backend
- **Emulador:** `config/dev.json` ya trae `https://10.0.2.2:8500/api/v1`.
- **Celular:** en `config/celular.json` cambia `192.168.1.50` por la IP de tu PC (`ipconfig` → *Dirección IPv4*). El celular y la PC deben estar **en la misma red wifi**.
  - Abre el puerto 8500 en el firewall de Windows (PowerShell como administrador):
    ```powershell
    New-NetFirewallRule -DisplayName "MIAA API 8500" -Direction Inbound -Protocol TCP -LocalPort 8500 -Action Allow
    ```

### 6. Configurar el botón ▶ de Android Studio
*Run → Edit Configurations… → main.dart →* **Additional run args**:
```
--dart-define-from-file=config/dev.json
```
(o `config/celular.json`). También desde la terminal:
```powershell
flutter run --dart-define-from-file=config/celular.json
```

### 7. Probar
1. Arranca el backend: `.\mvnw spring-boot:run` (con el perfil `https`, que ya trae `application.properties`).
2. Corre la app, toca **"Probar conexión con el servidor"** y revisa que todo salga en verde.
3. Entra con `notificador1` / `notificador1`:
   - verás "Hola, Juan Pérez", el punto verde **En línea** y la respuesta de `/usuarios/yo` (con el aviso de privacidad pendiente, que es lo que sigue por programar);
   - en el **panel web del admin → Empleados**, Juan Pérez sale **En línea**;
   - al tocar **Cerrar sesión**, el admin lo ve "Últ. vez…".
4. Entra con `admin`: la app debe **rechazarlo** ("Esta app es solo para notificadores").
5. Mete mal la contraseña 5 veces: debe salir **"Cuenta bloqueada"**.
6. `flutter test` corre las pruebas unitarias. `flutter analyze` debe salir sin errores.

## Si algo falla (la pantalla de diagnóstico te dice cuál es)
| Mensaje | Causa |
|---|---|
| `Sin conexión con https://… (Connection refused)` | El backend no está corriendo, la IP está mal o el firewall bloquea el 8500 |
| `Falló el HTTPS: el certificado… no es de confianza` | Falta `assets/dev/miaa-dev.pem`, no agregaste `assets:` al `pubspec`, o regeneraron el `.p12` y no lo volviste a exportar |
| `No se cargó assets/dev/miaa-dev.pem` | Falta el paso 2 (`assets:`) o el paso 3. Después de cambiar el `pubspec` hay que **detener y volver a correr**: el *hot reload* no basta |
| `El servidor no contestó a tiempo` | El celular está en otra red, o la red de la escuela aísla los equipos: usa el túnel de Cloudflare |
| Compila pero en release no conecta | Falta `INTERNET` en el manifest *main* (paso 4) |
| Error de `minSdk` al compilar | En `android/app/build.gradle.kts` pon `minSdk = 23` |
| `Respondió 429` | Muchos intentos seguidos desde el mismo celular: espera un minuto |

## Lo que sigue (no viene aquí, a propósito)
- **Pantallas de requisitos:** cambiar la contraseña temporal y aceptar el aviso de privacidad. El backend ya tiene `PUT /usuarios/yo/password` y `POST /usuarios/yo/aviso-privacidad`.
- **Reportes:** lista (`GET /reportes/mios`), nuevo reporte con GPS (`geolocator`) y fotos (`image_picker`), y la cola sin señal.
- **Manejo de estado:** cuando crezca, pasar `Sesion` a Riverpod o Bloc y la navegación a `go_router`. Para esta prueba se usó un `ChangeNotifier` simple, a propósito, para que se entienda todo sin librerías extra.
