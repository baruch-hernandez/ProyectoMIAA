import 'package:flutter/material.dart';

import 'reportes_offline_dao.dart';
import 'sync_manager.dart';

/// Sprint 4 (tarea 2.5): en el inicio, cuántos reportes faltan por llegar al servidor.
/// Solo aparece si hay alguno pendiente o rechazado.
class TarjetaPendientes extends StatelessWidget {
  const TarjetaPendientes({super.key, required this.sync});

  final SyncManager sync;

  static const llave = Key('tarjeta-pendientes');

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: sync,
      builder: (context, _) {
        if (sync.enCola.isEmpty) return const SizedBox.shrink();
        final n = sync.pendientes;
        return Card(
          key: llave,
          child: Column(
            children: [
              ListTile(
                leading: Badge(
                  label: Text('$n'),
                  isLabelVisible: n > 0,
                  child: Icon(sync.hayRed ? Icons.cloud_upload_outlined : Icons.cloud_off),
                ),
                title: Text('Reportes pendientes por sincronizar: $n'),
                subtitle: Text(sync.sincronizando
                    ? 'Enviando…'
                    : sync.hayRed
                        ? 'Se envían solos; si falla, se vuelve a intentar.'
                        : 'Sin conexión: se enviarán solos al volver la señal.'),
                trailing: IconButton(
                  tooltip: 'Sincronizar ahora',
                  icon: const Icon(Icons.sync),
                  onPressed: sync.sincronizando ? null : sync.sincronizar,
                ),
              ),
              for (final r in sync.enCola)
                _Fila(r: r, alReintentar: () => sync.reintentar(r), alDescartar: () => _descartar(context, r)),
            ],
          ),
        );
      },
    );
  }

  Future<void> _descartar(BuildContext context, ReporteOffline r) async {
    final si = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('¿Descartar este reporte?'),
        content: const Text('Se borra del celular con sus fotos. No se puede deshacer.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Descartar')),
        ],
      ),
    );
    if (si == true) await sync.descartar(r);
  }
}

class _Fila extends StatelessWidget {
  const _Fila({required this.r, required this.alReintentar, required this.alDescartar});

  final ReporteOffline r;
  final VoidCallback alReintentar;
  final VoidCallback alDescartar;

  @override
  Widget build(BuildContext context) {
    final rechazado = r.estado == EstadoSync.rechazado;
    final f = r.fechaCapturaUtc.toLocal();
    final hora = '${f.day}/${f.month} ${TimeOfDay.fromDateTime(f).format(context)}';
    return ListTile(
      dense: true,
      leading: Icon(rechazado ? Icons.error_outline : Icons.schedule,
          color: rechazado ? Theme.of(context).colorScheme.error : null),
      title: Text(r.descripcion, maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: Text(rechazado
          ? 'No lo aceptó el servidor: ${r.error}'
          : 'Guardado en dispositivo · $hora${r.intentos > 0 ? ' · intentos: ${r.intentos}' : ''}'),
      trailing: rechazado
          ? Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(tooltip: 'Reintentar', icon: const Icon(Icons.refresh), onPressed: alReintentar),
                IconButton(tooltip: 'Descartar', icon: const Icon(Icons.delete_outline), onPressed: alDescartar),
              ],
            )
          : null,
    );
  }
}
