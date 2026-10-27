import 'package:flutter/material.dart';

import '../auth/sesion.dart';
import '../core/api.dart';
import '../diagnostico/pantalla_diagnostico.dart';
import '../presencia/latido.dart';
import '../reportes/api_reportes.dart';
import '../reportes/pantalla_nuevo_reporte.dart';

/// Inicio después del login: nuevo reporte (Sprint 2), quién soy (GET /usuarios/yo) y el latido de la 2.4.
class PantallaInicio extends StatefulWidget {
  const PantallaInicio({super.key, required this.sesion});

  final Sesion sesion;

  @override
  State<PantallaInicio> createState() => _PantallaInicioState();
}

class _PantallaInicioState extends State<PantallaInicio> with WidgetsBindingObserver {
  late final Latido _latido = Latido(widget.sesion.api);
  Map<String, dynamic>? _cuenta;
  String? _errorCuenta;
  bool _saliendo = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _latido.iniciar();
    _cargarCuenta();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _latido.dispose();
    super.dispose();
  }

  /// App a la vista → latido; app al fondo o pantalla apagada → sin latido (sale "últ. vez").
  @override
  void didChangeAppLifecycleState(AppLifecycleState estado) {
    if (estado == AppLifecycleState.resumed) {
      _latido.iniciar();
    } else if (estado == AppLifecycleState.paused || estado == AppLifecycleState.hidden) {
      _latido.detener();
    }
  }

  Future<void> _cargarCuenta() async {
    try {
      final r = await widget.sesion.api.dio.get('/usuarios/yo');
      if (mounted) setState(() => _cuenta = r.data as Map<String, dynamic>);
    } catch (e) {
      if (mounted) setState(() => _errorCuenta = ApiError.de(e).mensaje);
    }
  }

  Future<void> _salir() async {
    setState(() => _saliendo = true);
    _latido.detener();
    await widget.sesion.salir(); // la app regresa sola al login
  }

  @override
  Widget build(BuildContext context) {
    final u = widget.sesion.usuario;
    return Scaffold(
      appBar: AppBar(
        title: const Text('MIAA Notificador'),
        actions: [
          IconButton(
            tooltip: 'Probar conexión',
            icon: const Icon(Icons.network_check),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => PantallaDiagnostico(sesion: widget.sesion),
            )),
          ),
          IconButton(
            tooltip: 'Cerrar sesión',
            icon: _saliendo
                ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.logout),
            onPressed: _saliendo ? null : _salir,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _cargarCuenta,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('Hola, ${u?.nombre ?? ''}', style: Theme.of(context).textTheme.headlineSmall),
            Text('${u?.username} · ${u?.rol}'),
            const SizedBox(height: 16),
            FilledButton.icon(
              key: const Key('btn-nuevo-reporte'),
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(56)),
              onPressed: () => PantallaNuevoReporte.abrir(
                context,
                enviar: (solicitud) => ApiReportes(widget.sesion.api).crear(solicitud),
              ),
              icon: const Icon(Icons.add_a_photo),
              label: const Text('Nuevo reporte'),
            ),
            const SizedBox(height: 16),
            ListenableBuilder(
              listenable: _latido,
              builder: (context, _) => _TarjetaDisponibilidad(latido: _latido),
            ),
            const SizedBox(height: 12),
            _TarjetaCuenta(cuenta: _cuenta, error: _errorCuenta),
            const SizedBox(height: 24),
            Text(
              'Esta es la pantalla de prueba del sprint: confirma que el login, el token, '
              'el latido y el logout funcionan contra el backend real. '
              'Desliza hacia abajo para volver a consultar /usuarios/yo.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}

class _TarjetaDisponibilidad extends StatelessWidget {
  const _TarjetaDisponibilidad({required this.latido});

  final Latido latido;

  @override
  Widget build(BuildContext context) {
    final ok = latido.ultimoOk != null && latido.ultimoError == null;
    final hora = latido.ultimoOk == null ? '—' : TimeOfDay.fromDateTime(latido.ultimoOk!).format(context);
    return Card(
      child: ListTile(
        leading: Icon(Icons.circle, color: ok ? Colors.green : Colors.grey, size: 18),
        title: Text(ok ? 'En línea' : 'Sin conexión con el servidor'),
        subtitle: Text(latido.ultimoError ?? 'Último latido: $hora · enviados: ${latido.enviados}'),
        trailing: IconButton(
          tooltip: 'Mandar latido ahora',
          icon: const Icon(Icons.favorite),
          onPressed: latido.latir,
        ),
      ),
    );
  }
}

class _TarjetaCuenta extends StatelessWidget {
  const _TarjetaCuenta({required this.cuenta, required this.error});

  final Map<String, dynamic>? cuenta;
  final String? error;

  @override
  Widget build(BuildContext context) {
    if (error != null) {
      return Card(child: ListTile(leading: const Icon(Icons.error_outline), title: Text(error!)));
    }
    final c = cuenta;
    if (c == null) {
      return const Card(child: ListTile(title: Text('Consultando /usuarios/yo…')));
    }
    final pendientes = [
      if (c['debeCambiarPassword'] == true) 'Cambiar la contraseña temporal',
      if (c['avisoPrivacidadPendiente'] == true) 'Aceptar el aviso de privacidad (versión ${c['avisoPrivacidadVersion']})',
    ];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Respuesta de GET /usuarios/yo', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text('id: ${c['id']}  ·  rol: ${c['rol']}'),
            Text('correo: ${c['email'] ?? '—'}'),
            const SizedBox(height: 8),
            if (pendientes.isEmpty)
              const Text('✅ Sin requisitos pendientes')
            else ...[
              const Text('⚠️ Pendiente antes de usar la app (siguiente paso a programar):'),
              for (final p in pendientes) Text('• $p'),
            ],
          ],
        ),
      ),
    );
  }
}
