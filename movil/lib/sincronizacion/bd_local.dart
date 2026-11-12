import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

/// Sprint 4 (tarea 2.1): la base SQLite del celular, con migraciones.
///
/// Cada elemento de la lista es una versión (la 1.ª es la versión 1). Para cambiar el esquema se
/// AGREGA una versión al final; nunca se edita una que ya se instaló en algún celular.
const migraciones = <List<String>>[
  // v1: la bandeja de salida de reportes hechos sin conexión
  [
    '''
    CREATE TABLE reportes_offline (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid_cliente      TEXT    NOT NULL UNIQUE,  -- clientSyncId: el backend no lo duplica al reintentar
      usuario_id        INTEGER NOT NULL,         -- en un celular compartido, cada quien manda solo los suyos
      descripcion       TEXT    NOT NULL,
      latitud           REAL    NOT NULL,
      longitud          REAL    NOT NULL,
      precision_gps     REAL,                     -- null si se eligió a mano en el mapa
      foto_path         TEXT    NOT NULL,         -- carpeta con las fotos del reporte (AlmacenFotosOffline)
      fecha_captura_utc TEXT    NOT NULL,         -- ISO-8601 con Z
      sync_status       TEXT    NOT NULL,         -- PENDIENTE_SINCRONIZAR, SINCRONIZADO o RECHAZADO
      intentos          INTEGER NOT NULL DEFAULT 0,
      datos             TEXT    NOT NULL,         -- JSON: domicilio, predio y metadatos de cada foto
      error             TEXT,                     -- último error de red o motivo del rechazo
      folio             TEXT                      -- el que dio el backend al sincronizarlo
    )''',
    'CREATE INDEX idx_reportes_offline_estado ON reportes_offline (usuario_id, sync_status)',
  ],
];

Future<Database>? _bd;

/// La base de la app (se abre una sola vez).
Future<Database> bdLocal() => _bd ??= abrirBdLocal();

/// [fabrica] y [ruta] son para las pruebas (SQLite en la PC, en un archivo temporal).
Future<Database> abrirBdLocal({DatabaseFactory? fabrica, String? ruta}) async {
  final f = fabrica ?? databaseFactory;
  return f.openDatabase(
    ruta ?? p.join(await f.getDatabasesPath(), 'miaa_local.db'),
    options: OpenDatabaseOptions(
      version: migraciones.length,
      onCreate: (bd, version) => _migrar(bd, 0, version),
      onUpgrade: _migrar,
    ),
  );
}

Future<void> _migrar(Database bd, int de, int a) async {
  for (var v = de; v < a; v++) {
    for (final sql in migraciones[v]) {
      await bd.execute(sql);
    }
  }
}
