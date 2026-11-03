package mx.gob.miaa.movil

import android.os.Build
import android.os.PowerManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * Canal "mx.gob.miaa.movil/dispositivo":
 *  - sdkInt: la versión de Android (API level), para pedir READ_MEDIA_IMAGES (Android 13+)
 *    o READ_EXTERNAL_STORAGE (Android 12 o menos).
 *  - ahorroEnergia: si está prendido el "Ahorro de batería", que puede bajarle al GPS.
 */
class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "mx.gob.miaa.movil/dispositivo")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "sdkInt" -> result.success(Build.VERSION.SDK_INT)
                    "ahorroEnergia" -> result.success((getSystemService(POWER_SERVICE) as PowerManager).isPowerSaveMode)
                    else -> result.notImplemented()
                }
            }
    }
}
