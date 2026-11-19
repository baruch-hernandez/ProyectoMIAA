"""Sprint 6 — Historia 6 (lado servidor): bandeja del admin y avisos en tiempo real.

  1.1  GET /reportes (ADMIN): cada renglón trae miniatura, coordenadas, autor y hora de captura,
       ordenado por hora de captura (la más nueva primero).
  1.2  GET /reportes/{id}/miniatura: JPEG chico; lo ve el admin o el autor, nadie más.
  1.3  GET /reportes/eventos (Server-Sent Events): solo ADMIN (401 sin token, 403 notificador).
  1.4 / 2.5  Un reporte nuevo llega al admin al instante, igual por POST /reportes (en línea) que por
       /reportes/sync (cola sin conexión); reenviar el mismo clientSyncId NO repite el aviso.

  pytest test_s6_avisos.py -s
"""
from __future__ import annotations

import base64
import json
import queue
import threading
from datetime import timedelta

import pytest

from apoyo.api import Api
from test_s4_sync_reportes import png_hd, reporte, sincronizar, utc


class Escucha:
    """Un admin con el panel abierto: lee los eventos del canal en otro hilo."""

    def __init__(self, api: Api):
        self.eventos: queue.Queue = queue.Queue()
        self.r = api.sesion.get(f"{api.base}/reportes/eventos", stream=True, timeout=(10, 120),
                                headers={"Authorization": f"Bearer {api.token}", "Accept": "text/event-stream"})
        assert self.r.status_code == 200, self.r.text
        assert self.r.headers["Content-Type"].startswith("text/event-stream")
        threading.Thread(target=self._leer, daemon=True).start()

    def _leer(self):
        nombre, datos = None, []
        try:
            for linea in self.r.iter_lines(chunk_size=1, decode_unicode=True):
                if linea == "":
                    if datos:
                        self.eventos.put((nombre, json.loads("\n".join(datos))))
                    nombre, datos = None, []
                elif linea.startswith("event:"):
                    nombre = linea[6:].strip()
                elif linea.startswith("data:"):
                    datos.append(linea[5:].strip())
        except Exception:  # noqa: BLE001 — se cerró al terminar la prueba
            pass

    def siguiente(self, segundos: float = 10) -> tuple[str, dict]:
        return self.eventos.get(timeout=segundos)

    def silencio(self, segundos: float = 3) -> bool:
        try:
            self.eventos.get(timeout=segundos)
            return False
        except queue.Empty:
            return True

    def cerrar(self):
        self.r.close()


@pytest.fixture
def escucha(admin):
    e = Escucha(admin)
    yield e
    e.cerrar()


@pytest.fixture(scope="module")
def notificador(crear_notificador, config) -> tuple[Api, dict]:
    datos = crear_notificador("avisos", requisitos=False)
    api = Api(config.api)
    api.entrar(datos["username"], datos["password"])
    return api, datos


# ---------------------------------------------------------------------------
# 1.3 y 1.4 / 2.5
# ---------------------------------------------------------------------------
def test_solo_el_admin_se_suscribe_a_los_avisos(notificador, config):
    api, _ = notificador
    assert api.get("/reportes/eventos").status_code == 403
    assert Api(config.api).get("/reportes/eventos").status_code == 401


def test_reporte_en_linea_y_sin_conexion_avisan_una_sola_vez(escucha, notificador):
    api, datos = notificador

    # Cola sin conexión de la app (POST /reportes/sync)
    lote = [reporte(semilla=60)]
    r = sincronizar(api, lote)
    assert r.status_code == 200 and r.json()["rechazados"] == [], r.text
    id_sync = r.json()["sincronizados"][0]["id"]
    nombre, aviso = escucha.siguiente()
    assert nombre == "nuevo-reporte"
    assert aviso["id"] == id_sync and aviso["autorId"] == datos["id"] and aviso["autor"] == datos["nombre"]
    assert aviso["miniatura"] == f"/reportes/{id_sync}/miniatura"
    assert aviso["latitud"] and aviso["longitud"] and aviso["fechaCaptura"].endswith("Z")

    # Se perdió la respuesta y la app lo vuelve a mandar: el mismo reporte, sin aviso repetido
    assert sincronizar(api, lote).json()["sincronizados"][0]["id"] == id_sync
    assert escucha.silencio(), "un reenvío no debe volver a avisar"

    # En línea (POST /reportes, como la web)
    meta, archivos = reporte(semilla=61)
    meta.pop("clientSyncId")
    meta["fotos"] = [{"datos": "data:image/png;base64," + base64.b64encode(next(iter(archivos.values()))).decode(),
                      "fechaCaptura": utc(), "origenFecha": "EXIF"}]
    r = api.post("/reportes", json=meta)
    assert r.status_code == 201, r.text
    nombre, aviso = escucha.siguiente()
    assert (nombre, aviso["id"]) == ("nuevo-reporte", r.json()["id"])


def test_un_reporte_rechazado_no_avisa(escucha, notificador):
    api, _ = notificador
    r = sincronizar(api, [reporte(semilla=62, latitud=19.43, longitud=-99.13)])  # CDMX: fuera del estado
    assert r.json()["sincronizados"] == []
    assert escucha.silencio()


# ---------------------------------------------------------------------------
# 1.1 y 1.2
# ---------------------------------------------------------------------------
def test_bandeja_ordenada_por_captura_con_miniatura(admin, notificador, crear_notificador, config):
    api, datos = notificador
    # Se sincronizan al revés: primero el capturado hace 10 min, luego el de hace 1 h
    for semilla, hace in ((63, 10), (64, 60)):
        r = sincronizar(api, [reporte(semilla=semilla, fechaCaptura=utc(timedelta(minutes=hace)))])
        assert r.json()["rechazados"] == [], r.text

    r = admin.get("/reportes", params={"empleadoId": datos["id"], "tamano": 100})
    assert r.status_code == 200, r.text
    filas = r.json()["reportes"]
    capturas = [f["fechaCaptura"] for f in filas]
    assert capturas == sorted(capturas, reverse=True), "de la captura más nueva a la más vieja"

    fila = filas[0]
    mini = admin.get(fila["miniatura"])
    assert mini.status_code == 200 and mini.headers["Content-Type"] == "image/jpeg"
    assert mini.content[:2] == b"\xff\xd8" and len(mini.content) < 60_000, "JPEG chico, no la foto completa"
    assert len(mini.content) < len(png_hd(63)) / 10

    assert api.get(fila["miniatura"]).status_code == 200, "el autor también la ve"
    otro = crear_notificador("avisosotro", requisitos=False)
    ajeno = Api(config.api)
    ajeno.entrar(otro["username"], otro["password"])
    assert ajeno.get(fila["miniatura"]).status_code == 404, "otro notificador ni sabe que existe"
