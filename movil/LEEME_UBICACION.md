# Ubicación del domicilio con mapa (como en la web)

## Qué hace (igual que `NuevoReporte.tsx` + `MapaUbicacion.tsx` de la web)

| Web (React + Leaflet) | App (Flutter) | Archivo |
|---|---|---|
| Al abrir el formulario pide el GPS | Al abrir, **si ya hay permiso**, se ubica solo. Si no, con «Mi ubicación». | `reportes/pantalla_nuevo_reporte.dart` |
| `afinarGps.ts`: escucha hasta 20 s y se queda con la lectura más precisa (para en ±15 m) | `AfinadorGps`, igual | `ubicacion/afinador_gps.dart` |
| Mapa calles / satélite (OSM / Esri) | Botón de capas arriba a la derecha | `ubicacion/mapa_ags.dart` |
| Sombra fuera del estado + borde punteado | Igual (`PolygonLayer` con hueco) | `ubicacion/mapa_ags.dart` |
| Clic en el mapa o arrastrar el marcador | **Pin fijo al centro**: se mueve el mapa debajo, o se toca para llevar el pin ahí (más cómodo con el dedo) | `ubicacion/pantalla_elegir_ubicacion.dart` |
| Círculo de precisión del GPS | Igual. Si el pin se mueve a mano, desaparece y el punto cuenta como «marcado en el mapa». | idem |
| No acepta puntos fuera de Aguascalientes | El botón «Usar este punto» se deshabilita | idem + `ubicacion/limite_ags.dart` |
| Nominatim llena la dirección sin pisar lo escrito a mano | Igual. Los campos que escribes a mano ya no los toca el GPS. Hay un botón «Volver a llenar». | `ubicacion/direccion_gps.dart`, `ubicacion/geocodificador.dart` |

- **Límite del estado:** `limite_ags.dart` se **generó** desde `backend/src/main/resources/geo/aguascalientes.json`. Es el mismo contorno de 386 puntos que usan el backend y la web, así los tres dan la misma respuesta para un punto.
- **Envío:** el punto viaja en `latitud` y `longitud` de `POST /reportes`. Es opcional y el backend vuelve a revisar el contorno.

## Lo que tienes que agregar TÚ

Esto no viene en el zip, para no pisar tus cambios.

### `pubspec.yaml`, en `dependencies:`

```yaml
  # --- Ubicación del domicilio con mapa (igual que la web con Leaflet) ---
  flutter_map: ^8.3.2   # mapa con mosaicos de OpenStreetMap / satélite
  latlong2: ^0.9.1      # tipo LatLng que usa flutter_map
  geolocator: ^14.1.0   # GPS del celular (lecturas con su precisión en metros)
```

### `android/app/src/main/AndroidManifest.xml`, junto a los otros `uses-permission`

```xml
    <!-- Ubicación del domicilio: GPS solo mientras se usa la app (nunca en segundo plano) -->
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
    <uses-feature android:name="android.hardware.location.gps" android:required="false"/>
```

Después:

```powershell
flutter pub get
flutter test
flutter run --dart-define-from-file=config/dev.json
```

## Probarlo en el emulador

1. **Simular el GPS:** en los `···` (Extended controls) del emulador, ve a **Location**. Busca una dirección de Aguascalientes, o pon por ejemplo `21.8824, -102.2826`, y toca **Set location**.
   - Para ver el "afinado", mándale primero un punto y luego otro cercano.
   - Una ruta (pestaña *Routes*) sirve para ver cómo se mueve el pin.
2. **Internet en el emulador:** los mosaicos del mapa y Nominatim salen a internet. Si el mapa se ve gris, revisa que el emulador tenga red.
3. **Casos para probar:**
   - Negar el permiso de ubicación: sale el modal con «Abrir ajustes».
   - Apagar la Ubicación del emulador: sale «La ubicación está apagada → Prender ubicación».
   - En Android 12+, elegir «Ubicación aproximada»: aparece el aviso para activar la precisa.
   - Mover el pin fuera del estado: no se puede confirmar.
   - Escribir la colonia a mano y luego tocar «Mi ubicación»: la colonia NO cambia.

## Ojo para producción

- **Nominatim y los mosaicos de OpenStreetMap** son gratis, pero con reglas: máximo 1 búsqueda por segundo (la app ya lo respeta) y nada de uso masivo. Para MIAA en producción conviene:
  - un geocodificador propio, que se cambia en `config/*.json` con `"GEOCODER_URL"`;
  - un proveedor de mapas con contrato.
- **La app se identifica** con el User-Agent `MIAA-Notificador/1.0`, como pide la política de OpenStreetMap.
- **El token JWT nunca se manda** a Nominatim: la búsqueda de direcciones usa un cliente HTTP aparte.
