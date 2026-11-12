"""Sprint 4 — tareas 3.3 y 3.4 (lado servidor): POST /api/v1/reportes/sync.

Lo que manda la app cuando recupera la señal: una parte "reportes" (JSON, lista) y una parte binaria
por foto. Se revisa:
  3.3  un reporte hecho sin conexión horas antes se guarda con SU hora de captura;
       el mismo clientSyncId dos veces no duplica el reporte;
       sin coordenadas, sin imagen o con la hora fuera de UTC se rechaza (y no tumba al resto del lote).
  3.4  ráfaga de 10 reportes en lotes, repitiendo un lote como si se cortara la red: quedan 10,
       y cada foto guardada es idéntica byte por byte a la enviada.

  pytest test_s4_sync_reportes.py -s
"""
from __future__ import annotations

import base64
import hashlib
import json
import random
import struct
import uuid
import zlib
from datetime import datetime, timedelta, timezone

import pytest

from apoyo.api import Api

CENTRO_AGS = (21.8818, -102.2916)


def png_hd(semilla: int) -> bytes:
    """PNG de 1280×720 (lo mínimo que acepta el backend), distinto para cada semilla."""
    ancho, alto = 1280, 720
    azar = random.Random(semilla)
    lisa = b"\x00" + bytes([semilla % 256, 90, 160]) * ancho
    filas = [lisa if y % 90 else b"\x00" + azar.randbytes(ancho * 3) for y in range(alto)]

    def bloque(tipo: bytes, datos: bytes) -> bytes:
        return struct.pack(">I", len(datos)) + tipo + datos + struct.pack(">I", zlib.crc32(tipo + datos))

    return (b"\x89PNG\r\n\x1a\n"
            + bloque(b"IHDR", struct.pack(">IIBBBBB", ancho, alto, 8, 2, 0, 0, 0))
            + bloque(b"IDAT", zlib.compress(b"".join(filas)))
            + bloque(b"IEND", b""))


def utc(hace: timedelta = timedelta()) -> str:
    return (datetime.now(timezone.utc) - hace).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def reporte(semilla: int = 1, **cambios) -> tuple[dict, dict[str, bytes]]:
    """(metadatos, {parte: bytes}) de un reporte válido, como lo arma la app."""
    sync_id = str(uuid.uuid4())
    parte = f"{sync_id}-0"
    meta = {
        "clientSyncId": sync_id,
        "fechaCaptura": utc(timedelta(minutes=5)),
        "calle": "Av. Madero", "numeroExterior": str(100 + semilla), "colonia": "Centro",
        "codigoPostal": "20000", "municipio": "Aguascalientes", "tipoPredio": "HABITACIONAL",
        "descripcion": f"Fuga en la toma, reporte sin conexión #{semilla}.",
        "latitud": CENTRO_AGS[0], "longitud": CENTRO_AGS[1],
        "fotos": [{"parte": parte, "fechaCaptura": utc(timedelta(minutes=6)),
                   "origenFecha": "OBTURADOR", "origenFoto": "CAMARA"}],
    }
    meta.update(cambios)
    return meta, {parte: png_hd(semilla)}


def sincronizar(api: Api, lote: list[tuple[dict, dict[str, bytes]]]):
    partes = [("reportes", (None, json.dumps([m for m, _ in lote]), "application/json"))]
    for _, archivos in lote:
        partes += [(nombre, (f"{nombre}.png", datos, "image/png")) for nombre, datos in archivos.items()]
    return api.post("/reportes/sync", files=partes)


@pytest.fixture(scope="module")
def notificador(crear_notificador, config) -> Api:
    datos = crear_notificador("sync", requisitos=False)
    api = Api(config.api)
    api.entrar(datos["username"], datos["password"])
    return api


def mis_reportes_con(api: Api, ids: set[int]) -> list[dict]:
    r = api.get("/reportes/mios")
    assert r.status_code == 200, r.text
    return [x for x in r.json() if x["id"] in ids]


# ---------------------------------------------------------------------------
# 3.3
# ---------------------------------------------------------------------------
def test_reporte_offline_con_hora_desfasada_se_guarda_con_su_hora(notificador):
    hace_6h = utc(timedelta(hours=6))
    meta, archivos = reporte(fechaCaptura=hace_6h)

    r = sincronizar(notificador, [(meta, archivos)])

    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["rechazados"] == []
    [ok] = cuerpo["sincronizados"]
    assert ok["clientSyncId"] == meta["clientSyncId"] and ok["folio"].startswith("R-")
    detalle = notificador.get(f"/reportes/{ok['id']}").json()
    capturado = datetime.fromisoformat(detalle["fechaCaptura"].replace("Z", "+00:00"))
    assert abs(capturado - datetime.fromisoformat(hace_6h.replace("Z", "+00:00"))) < timedelta(seconds=1)
    print(f"\n  guardado {ok['folio']} con hora de captura {detalle['fechaCaptura']} (6 h antes de llegar)")


def test_mismo_client_sync_id_dos_veces_no_duplica(notificador):
    lote = [reporte(semilla=7)]

    primero = sincronizar(notificador, lote).json()["sincronizados"]
    segundo = sincronizar(notificador, lote)  # la respuesta "se perdió": la app lo reenvía igual

    assert segundo.status_code == 200, segundo.text
    assert segundo.json()["sincronizados"] == primero, "el reintento responde éxito con el mismo id"
    mismos = [x for x in notificador.get("/reportes/mios").json() if x["descripcion"] == lote[0][0]["descripcion"]]
    assert [x["id"] for x in mismos] == [primero[0]["id"]], "una sola fila en PostgreSQL"


def test_el_client_sync_id_de_otro_notificador_no_se_puede_reusar(notificador, crear_notificador, config):
    lote = [reporte(semilla=8)]
    assert sincronizar(notificador, lote).json()["sincronizados"]

    otro_datos = crear_notificador("sync2", requisitos=False)
    otro = Api(config.api)
    otro.entrar(otro_datos["username"], otro_datos["password"])
    r = sincronizar(otro, lote).json()

    assert r["sincronizados"] == []
    assert r["rechazados"][0]["clientSyncId"] == lote[0][0]["clientSyncId"]


@pytest.mark.parametrize("nombre, cambio, campo", [
    ("sin coordenadas", {"latitud": None, "longitud": None}, "latitud"),
    ("sin imagen", {"fotos": []}, "fotos"),
    ("hora local sin zona", {"fechaCaptura": "2026-11-11T10:00:00"}, "fechaCaptura"),
    ("hora con otra zona", {"fechaCaptura": "2026-11-11T10:00:00-06:00"}, "fechaCaptura"),
    ("sin hora", {"fechaCaptura": None}, "fechaCaptura"),
])
def test_campos_requeridos_se_rechazan_sin_tumbar_el_lote(notificador, nombre, cambio, campo):
    malo = reporte(semilla=20, **cambio)
    bueno = reporte(semilla=21)

    r = sincronizar(notificador, [malo, bueno])

    assert r.status_code == 200, r.text
    cuerpo = r.json()
    [rechazo] = cuerpo["rechazados"]
    assert rechazo["clientSyncId"] == malo[0]["clientSyncId"]
    assert campo in rechazo["errores"], f"{nombre}: {rechazo}"
    assert [s["clientSyncId"] for s in cuerpo["sincronizados"]] == [bueno[0]["clientSyncId"]]
    print(f"\n  {nombre}: {rechazo['errores'][campo]}")


def test_foto_anunciada_que_no_llego_se_rechaza(notificador):
    meta, _ = reporte(semilla=30)
    r = sincronizar(notificador, [(meta, {})]).json()
    assert r["sincronizados"] == [] and "fotos" in r["rechazados"][0]["errores"]


def test_coordenadas_fuera_de_aguascalientes_se_rechazan(notificador):
    r = sincronizar(notificador, [reporte(semilla=31, latitud=19.43, longitud=-99.13)]).json()  # CDMX
    assert r["sincronizados"] == []
    assert r["rechazados"][0]["errores"]  # el filtro rápido del DTO ya la saca


def test_hora_de_captura_del_futuro_se_rechaza(notificador):
    r = sincronizar(notificador, [reporte(semilla=32, fechaCaptura=utc(-timedelta(hours=2)))]).json()
    assert r["sincronizados"] == []
    assert "futuro" in r["rechazados"][0]["motivo"]


def test_lista_del_admin_por_paginas(notificador, admin):
    assert not sincronizar(notificador, [reporte(semilla=40), reporte(semilla=41), reporte(semilla=42)]).json()["rechazados"]

    p0 = admin.get("/reportes", params={"pagina": 0, "tamano": 2}).json()
    p1 = admin.get("/reportes", params={"pagina": 1, "tamano": 2}).json()

    assert len(p0["reportes"]) == 2 and p0["hayMas"] is True and p0["total"] >= 3 and p0["empleados"] >= 1
    assert not {r["id"] for r in p0["reportes"]} & {r["id"] for r in p1["reportes"]}, "sin repetidos entre páginas"
    fechas = [r["fechaCreacion"] for r in p0["reportes"] + p1["reportes"]]
    assert fechas == sorted(fechas, reverse=True), "del más nuevo al más viejo"
    assert p0["reportes"][0]["totalFotos"] == 1


def test_mandar_la_ubicacion_cuenta_como_latido(crear_notificador, admin, config):
    datos = crear_notificador("latidoubic", requisitos=False)
    api = Api(config.api)
    api.entrar(datos["username"], datos["password"])
    assert api.delete("/usuarios/yo/conexion").status_code == 204  # inactivo

    r = api.post("/ubicacion", json={"latitud": CENTRO_AGS[0], "longitud": CENTRO_AGS[1], "precision": 5})

    assert r.status_code == 204, r.text
    [yo] = [e for e in admin.get("/usuarios/empleados").json()["empleados"] if e["id"] == datos["id"]]
    assert yo["activo"] is True, "sin POST /usuarios/yo/conexion, solo con la ubicación"


def test_sin_token_no_entra(config):
    assert sincronizar(Api(config.api), [reporte()]).status_code == 401


# ---------------------------------------------------------------------------
# 3.4 (servidor): ráfaga de 10 con un lote repetido por reconexión
# ---------------------------------------------------------------------------
def test_rafaga_de_10_con_reintento_no_duplica_y_las_fotos_llegan_intactas(notificador):
    lote = [reporte(semilla=100 + i, fechaCaptura=utc(timedelta(minutes=60 - i))) for i in range(10)]
    huellas = {m["clientSyncId"]: hashlib.sha256(next(iter(a.values()))).hexdigest() for m, a in lote}

    r1 = sincronizar(notificador, lote[:5])
    # Se "cortó" la señal al recibir la respuesta del 2.º lote: la app lo vuelve a mandar completo
    r2 = sincronizar(notificador, lote[5:])
    r2_bis = sincronizar(notificador, lote[5:])

    for r in (r1, r2, r2_bis):
        assert r.status_code == 200 and r.json()["rechazados"] == [], r.text
    assert r2_bis.json()["sincronizados"] == r2.json()["sincronizados"]
    ids = {s["clientSyncId"]: s["id"] for r in (r1, r2) for s in r.json()["sincronizados"]}
    assert len(ids) == 10 and len(set(ids.values())) == 10
    assert len(mis_reportes_con(notificador, set(ids.values()))) == 10, "ni uno más ni uno menos"

    for sync_id, id_ in ids.items():
        [foto] = notificador.get(f"/reportes/{id_}").json()["fotos"]
        guardada = base64.b64decode(foto["datos"].split(",", 1)[1])
        assert hashlib.sha256(guardada).hexdigest() == huellas[sync_id], f"foto alterada en {sync_id}"
    print(f"\n  10 reportes en 3 peticiones (1 repetida), 10 filas, 10 fotos idénticas")
