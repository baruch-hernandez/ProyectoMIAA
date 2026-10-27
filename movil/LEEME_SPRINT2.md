# Sprint 2 — Fotos de evidencia (app móvil del notificador)

## 1. Cómo ponerlo a andar

```powershell
cd E:\MIAA\ProyectoMIAA\movil
flutter pub get
flutter analyze
flutter test                      # pruebas unitarias y de widgets (sin celular)
flutter run --dart-define-from-file=config/dev.json
```

- **Android SDK Platform 37.** `permission_handler` 13 compila contra Android 17 (API 37), así que el `compileSdk` quedó en `maxOf(flutter.compileSdkVersion, 37)`. Si Gradle dice que falta la plataforma 37, instálala en **Android Studio → Settings → Languages & Frameworks → Android SDK → SDK Platforms → Android 17 (API 37)**.
  - **Si no puedes instalarla:** en `pubspec.yaml` usa `permission_handler: ^12.0.1` y en `build.gradle.kts` deja `compileSdk = flutter.compileSdkVersion`. El código funciona igual con las dos versiones.
- **Archivos basura.** En la raíz del proyecto había tres archivos vacíos (`Get`, `Process` y `Run`), seguramente de un comando que se pegó mal. Bórralos.

## 2. Qué tarea quedó en qué archivo

| Tarea | Dónde |
|---|---|
| 1.1 Dependencias | `pubspec.yaml`: `camera`, `image_picker`, `file_picker`, `permission_handler`, `path_provider` e `image` (compresión y EXIF) |
| 1.2 Permisos | `android/app/src/main/AndroidManifest.xml`: `CAMERA`, `READ_MEDIA_IMAGES` y `READ_EXTERNAL_STORAGE` con `maxSdkVersion="32"`. La cámara se marca `required="false"`. |
| 1.3 minSdk | `android/app/build.gradle.kts`: `minSdk = maxOf(flutter.minSdkVersion, 24)`. CameraX pide 23 y permission_handler pide 24. |
| 1.4 Servicio de permisos | `lib/permisos/servicio_permisos.dart` (granted / denied / permanentlyDenied / restricted) y `asegurarPermiso()` en `lib/permisos/dialogo_permiso.dart` |
| 2.1 Modal y botón a Ajustes | `DialogoPermiso` en `lib/permisos/dialogo_permiso.dart`, con `openAppSettings()`. Al regresar de Ajustes revisa solo. |
| 2.2 Envío bloqueado sin foto | `BorradorReporte.puedeEnviar` y el botón "Enviar reporte" en `lib/reportes/pantalla_nuevo_reporte.dart` |
| 2.3 Vista previa grande | `lib/fotos/pantalla_vista_previa.dart`, con zoom de pellizco y la foto ya comprimida, tal como se enviará |
| 2.4 Repetir / descartar | Botón "Repetir foto": borra el temporal y vuelve a abrir la cámara. En galería dice "Elegir otra". |
| 2.5 Confirmar | Botón "Usar foto": `BorradorReporte.agregarFoto()` |
| 3.1 Cámara integrada | `lib/fotos/pantalla_camara.dart`: CameraX a 1080p, enfoque al tocar, flash y linterna |
| 3.1 Resolución y compresión | `lib/fotos/procesador_fotos.dart`: lado largo de 1920 px, JPEG con calidad de 85 a 62 hasta pesar ≤ 1.7 MB, mínimo 1280×720. Corre en otro hilo (isolate). |
| 3.2 Galería | `FuenteFotosDispositivo.desdeGaleria()` en `lib/fotos/fuentes_fotos.dart` (image_picker) |
| 3.3 Explorador de archivos | `FuenteFotosDispositivo.desdeArchivos()` (file_picker, solo jpg, jpeg y png) |
| 3.4 Metadatos `origen_fecha_foto` | `resolverFechaCaptura()` (EXIF → ARCHIVO → SUBIDA). Se guarda en `FotoEvidencia.aJson()` con el origen CAMARA, GALERIA o ARCHIVOS. |
| Borrador persistente | `lib/reportes/almacen_borrador.dart`: carpeta privada de la app. Si se cierra la app, el reporte y sus fotos siguen ahí. |
| Envío | `lib/reportes/api_reportes.dart`: `POST /reportes`, con el mismo formato que `ReporteRequestDTO` |
| 4.1 Botón deshabilitado | `test/formulario_reporte_test.dart` |
| 4.2 Modal con permiso denegado | `test/permisos_test.dart` |
| 4.3 Ciclo completo | `integration_test/ciclo_fotos_test.dart` (automática) y el protocolo manual de la sección 4 |

Las reglas de las fotos salen del backend (`ValidadorFotos.java` y `ReporteService.java`), para que el servidor nunca rechace lo que la app manda:

- máximo 3 fotos;
- mínimo 1280×720;
- ~1.8 MB por foto;
- JPG o PNG;
- `origenFecha` con uno de estos valores: EXIF, ARCHIVO o SUBIDA.

### ¿De dónde sale la hora de captura? (3.4)

1. **EXIF `DateTimeOriginal`**, la hora que escribe la cámara. Se lee del archivo original, antes de comprimirlo. Si trae `OffsetTimeOriginal`, se respeta la zona horaria.
2. **ARCHIVO:**
   - con la cámara de la app, es el instante en que se tocó el botón;
   - en la galería o en archivos, es la fecha del archivo, pero solo si es anterior a cuando se eligió. Si es "de hace un momento", es la fecha de la copia que hizo el selector y no sirve.
3. **SUBIDA:** si no hubo otra cosa, se usa la hora en que se eligió la foto.

Una hora EXIF que está en el futuro (reloj del celular mal puesto) se ignora, igual que en el backend.

## 3. Pruebas automáticas

```powershell
flutter test                                                   # 4.1 y 4.2, más procesamiento y metadatos
flutter test integration_test/ciclo_fotos_test.dart -d emulator-5554   # 4.3 en el emulador
```

La prueba de integración usa en el emulador **el procesamiento y el disco reales**. Lo que simula son las ventanas del sistema (diálogo de permisos, cámara, galería), porque una prueba de Flutter no puede tocarlas. Esas ventanas se prueban a mano con la sección 4.

> Si el reloj del emulador está atrasado (antes del 20/10/2026), la hora EXIF de la foto de prueba parecería del futuro y la prueba fallaría. Pon la fecha automática en el emulador.

## 4. Protocolo manual en emulador o celular (4.3)

**Antes de empezar:**

- **Cámara del emulador:** en Device Manager → ✏️ Editar → Show Advanced Settings → **Back camera = Webcam0** (usa la webcam de tu PC) o **VirtualScene** (un cuarto 3D que recorres con Alt + WASD). Con la webcam puedes fotografiar un medidor real o una hoja con números impresos.
- **Fotos en la galería:**
  ```powershell
  adb push medidor.jpg /sdcard/Pictures/
  adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Pictures/medidor.jpg
  ```
  Si no aparece, ábrela una vez con la app **Archivos** del emulador.
- **Regresar los permisos a "nunca preguntado":** `adb shell pm clear mx.gob.miaa.movil`. Ojo: también borra la sesión, así que hay que volver a entrar.
- **Ver el estado actual:** `adb shell dumpsys package mx.gob.miaa.movil | findstr CAMERA`

| # | Pasos | Resultado esperado | ✔ |
|---|---|---|---|
| P1 | Nuevo reporte → **Cámara** → en el diálogo de Android, «No permitir» | Sale el modal de la app con «Intentar de nuevo» y «Abrir ajustes». La cámara NO se abre. | ☐ |
| P2 | «Intentar de nuevo» → «No permitir» otra vez | El modal cambia: «Android ya no lo vuelve a preguntar», los pasos 1 a 4 y solo «Abrir ajustes» | ☐ |
| P3 | «Abrir ajustes» → Permisos → Cámara → «Permitir solo mientras se usa la app» → regresar | La cámara se abre sola, sin volver a tocar nada | ☐ |
| P4 | Tomar una foto movida a propósito → en la vista previa, hacer zoom | Se nota que no se lee. Al tocar «Repetir foto», la cámara se reabre y esa foto NO aparece en el reporte. | ☐ |
| P5 | Tomar una foto nítida del medidor → «Usar foto» | Aparece la miniatura «Cámara · hh:mm», con «Hora: EXIF» o «ARCHIVO». **Enviar reporte** se habilita. | ☐ |
| P6 | **Galería** → elegir `medidor.jpg` → «Usar foto» | La miniatura dice «Galería» y la hora es la del EXIF de la foto, no la de ahorita | ☐ |
| P7 | **Archivos** → navegar a Pictures → elegir un PNG | Se adjunta. Los PDF ni siquiera aparecen, por el filtro. | ☐ |
| P8 | **Archivos** → elegir una imagen de 800×600 | Mensaje «La foto mide 800×600…» y no se adjunta | ☐ |
| P9 | Quitar todas las fotos (la ✕ de cada miniatura) | **Enviar reporte** se deshabilita y aparece «Agrega al menos una foto…» | ☐ |
| P10 | Con 2 fotos, cerrar la app desde recientes → abrirla → Nuevo reporte | El borrador sigue ahí, con sus 2 fotos y los campos que ya habías escrito | ☐ |
| P11 | Con el backend prendido, llenar el formulario → Enviar | «Reporte enviado». El reporte aparece en el panel web con la hora de captura y su origen. | ☐ |
| P12 | Emulador con Android 12 (API 31 o 32) → Galería | Android pide «Archivos y contenido multimedia» (READ_EXTERNAL_STORAGE) y no READ_MEDIA_IMAGES | ☐ |
| P13 | Android 14+ → Galería → «Seleccionar fotos» (acceso parcial) | Se acepta como permiso concedido y la galería se abre | ☐ |

Anota en cada caso el modelo o la API del emulador y una captura. Te sirven de evidencia para el reporte de estadía.

## 5. Notas y decisiones

- **El explorador de archivos no pide permiso.** Usa el Storage Access Framework de Android: el usuario elige el archivo y Android solo da acceso a ese.
- **Galería en Android 13+.** `image_picker` usa el Photo Picker del sistema, que en realidad no necesita `READ_MEDIA_IMAGES`. El permiso se pide igual porque así lo marca la tarea 1.2.
  - Si la app se publica en Google Play, revisa su política: Play restringe `READ_MEDIA_IMAGES` a apps cuyo propósito principal son las fotos. En ese caso convendría quitarlo y quedarse con el Photo Picker.
- **"Permanentemente denegado" en Android** solo lo informa `request()`, nunca `status`. Así lo marca la guía de `permission_handler` 13, y el código nunca guarda ese veredicto: al volver de Ajustes, consulta de nuevo.
- **`origenFoto`** (CAMARA, GALERIA o ARCHIVOS) ya viaja en la solicitud, pero el backend todavía no lo guarda (Spring ignora los campos que no conoce). Para auditarlo en el servidor, falta agregar la columna `origen_foto` a `FotoReporte`.
- **La latitud y la longitud** van en `null` hasta la tarea del GPS.
