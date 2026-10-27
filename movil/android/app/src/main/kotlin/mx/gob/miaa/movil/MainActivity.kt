package mx.gob.miaa.movil

import android.os.Build
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * Canal "mx.gob.miaa.movil/dispositivo": le dice a Dart la versión de Android (API level).
 * Se usa para pedir READ_MEDIA_IMAGES (Android 13+) o READ_EXTERNAL_STORAGE (Android 12 o menos).
 */
class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "mx.gob.miaa.movil/dispositivo")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "sdkInt" -> result.success(Build.VERSION.SDK_INT)
                    else -> result.notImplemented()
                }
            }
    }
}
