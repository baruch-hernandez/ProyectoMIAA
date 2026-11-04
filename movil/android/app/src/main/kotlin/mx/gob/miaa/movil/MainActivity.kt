package mx.gob.miaa.movil

import android.content.Intent
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.provider.Settings
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel

/**
 * Canal "mx.gob.miaa.movil/dispositivo":
 *  - sdkInt: la versión de Android (API level), para pedir READ_MEDIA_IMAGES (Android 13+)
 *    o READ_EXTERNAL_STORAGE (Android 12 o menos).
 *  - ahorroEnergia: si está prendido el "Ahorro de batería", que puede bajarle al GPS.
 *  - abrirAhorroEnergia: abre los ajustes del "Ahorro de batería".
 *  - arranqueMs: milisegundos desde que se prendió el celular. Mover el reloj no los cambia.
 *
 * Canal de eventos "mx.gob.miaa.movil/gnss": lecturas directas del chip GPS.
 */
class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "mx.gob.miaa.movil/dispositivo")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "sdkInt" -> result.success(Build.VERSION.SDK_INT)
                    "ahorroEnergia" -> result.success((getSystemService(POWER_SERVICE) as PowerManager).isPowerSaveMode)
                    "abrirAhorroEnergia" -> {
                        startActivity(Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS))
                        result.success(true)
                    }
                    "arranqueMs" -> result.success(SystemClock.elapsedRealtime())
                    else -> result.notImplemented()
                }
            }
        EventChannel(flutterEngine.dartExecutor.binaryMessenger, "mx.gob.miaa.movil/gnss")
            .setStreamHandler(LecturasGnss(getSystemService(LOCATION_SERVICE) as LocationManager))
    }
}

/**
 * GPS_PROVIDER directo: en Android 12+ el forceLocationManager de geolocator elige
 * FUSED_PROVIDER, que mezcla wifi y antenas y no es el chip satelital.
 */
private class LecturasGnss(private val gestor: LocationManager) : EventChannel.StreamHandler, LocationListener {
    private var eventos: EventChannel.EventSink? = null

    override fun onListen(arguments: Any?, sink: EventChannel.EventSink) {
        eventos = sink
        // Sin chip GPS no llegan lecturas y la cámara pasa sola a wifi y antenas.
        if (LocationManager.GPS_PROVIDER !in gestor.allProviders) return
        try {
            gestor.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, this, Looper.getMainLooper())
        } catch (e: SecurityException) {
            sink.error("sin-permiso", e.message, null)
        }
    }

    override fun onCancel(arguments: Any?) {
        gestor.removeUpdates(this)
        eventos = null
    }

    override fun onLocationChanged(lectura: Location) {
        if (!lectura.hasAccuracy()) return
        eventos?.success(
            mapOf(
                "lat" to lectura.latitude,
                "lng" to lectura.longitude,
                "precision" to lectura.accuracy.toDouble(),
            ),
        )
    }

    override fun onProviderDisabled(proveedor: String) {
        eventos?.error("gps-apagado", "Se apagó la ubicación", null)
    }

    override fun onProviderEnabled(proveedor: String) = Unit

    // Android 9 y anteriores la llaman y su versión default no existe ahí.
    @Deprecated("Solo para Android 9 y anteriores")
    override fun onStatusChanged(proveedor: String?, estado: Int, extras: Bundle?) = Unit
}
