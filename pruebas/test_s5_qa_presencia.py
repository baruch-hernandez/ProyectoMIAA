"""Sprint 5 — QA 3.1: Presencia en tiempo real, transición automática a INACTIVO y permisos.

Valida:
1. Actualización sucesiva de coordenadas y timestamp UTC en /heartbeat.
2. Transición automática a INACTIVO al expirar segundos-en-linea (verificando API y BD usuario_presencia).
3. Rechazo 403 para NOTIFICADOR, 401 sin token en /cuadrillas, y rechazo 400 para rol LECTURISTA.
"""
from __future__ import annotations

import os
import time
from datetime import datetime, timedelta, timezone

import psycopg
import pytest

from apoyo.api import Api

PUNTO_1 = {"latitud": 21.8818, "longitud": -102.2916, "precision": 6}
PUNTO_2 = {"latitud": 21.8900, "longitud": -102.3000, "precision": 4}
CUADRILLAS = "/cuadrillas"


@pytest.fixture()
def notificador(crear_notificador, config) -> tuple[Api, dict]:
    datos = crear_notificador("presencia", requisitos=False)
    api = Api(config.api)
    api.entrar(datos["username"], datos["password"])
    return api, datos


def buscar_en_mapa(admin: Api, empleado_id: int) -> dict:
    r = admin.get(CUADRILLAS)
    assert r.status_code == 200, r.text
    return next(e for e in r.json() if e["empleadoId"] == empleado_id)


def test_3_1_actualizacion_coordenadas_y_timestamp_utc(notificador, admin):
    api, datos = notificador

    # 1. Primer latido con coordenadas
    r1 = api.post("/heartbeat", json=PUNTO_1)
    assert r1.status_code == 204, r1.text
    estado_1 = buscar_en_mapa(admin, datos["id"])

    assert estado_1["estadoConexion"] == "ACTIVO"
    assert (estado_1["latitud"], estado_1["longitud"]) == (PUNTO_1["latitud"], PUNTO_1["longitud"])
    assert estado_1["ultimaConexion"].endswith("Z")
    ts_1 = datetime.fromisoformat(estado_1["ultimaConexion"].replace("Z", "+00:00"))
    assert abs(datetime.now(timezone.utc) - ts_1) < timedelta(seconds=30)

    time.sleep(1.1)

    # 2. Segundo latido desplazado -> actualiza punto y timestamp mayor
    r2 = api.post("/heartbeat", json=PUNTO_2)
    assert r2.status_code == 204, r2.text
    estado_2 = buscar_en_mapa(admin, datos["id"])

    assert (estado_2["latitud"], estado_2["longitud"]) == (PUNTO_2["latitud"], PUNTO_2["longitud"])
    ts_2 = datetime.fromisoformat(estado_2["ultimaConexion"].replace("Z", "+00:00"))
    assert ts_2 > ts_1, "El timestamp ultimaConexion debe avanzar con el nuevo latido"


def test_3_1_transicion_automatica_a_inactivo_por_tiempo(notificador, admin):
    api, datos = notificador
    umbral = int(os.environ.get("MIAA_SEGUNDOS_EN_LINEA", "60"))

    assert api.post("/heartbeat", json=PUNTO_1).status_code == 204
    assert buscar_en_mapa(admin, datos["id"])["estadoConexion"] == "ACTIVO"

    # Esperar umbral + 2 s para que expire la ventana y corra el @Scheduled
    espera = umbral + 2
    print(f"\n  Esperando {espera} s para transición automática a INACTIVO...")
    time.sleep(espera)

    tras_espera = buscar_en_mapa(admin, datos["id"])
    assert tras_espera["estadoConexion"] == "INACTIVO"
    assert tras_espera["tieneUbicacion"] is True
    assert (tras_espera["latitud"], tras_espera["longitud"]) == (PUNTO_1["latitud"], PUNTO_1["longitud"])

    # Comprobación directa en PostgreSQL de que @Scheduled ejecutó el UPDATE en usuario_presencia
    db_pass = os.environ.get("DB_PASSWORD")
    if db_pass:
        with psycopg.connect(
            host="localhost",
            port=5432,
            dbname="miaa_pruebas",
            user="postgres",
            password=db_pass,
        ) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT estado_conexion FROM usuario_presencia WHERE usuario_id = %s", (datos["id"],))
                fila = cur.fetchone()
                assert fila is not None and fila[0] == "INACTIVO", f"BD aún dice {fila}"


def test_3_1_permisos_y_rechazo_rol_lecturista(notificador, admin, config):
    api, _ = notificador

    # Rol de campo -> 403 Forbidden
    assert api.get(CUADRILLAS).status_code == 403

    # Sin token -> 401 Unauthorized
    assert Api(config.api).get(CUADRILLAS).status_code == 401

    # Rol viejo LECTURISTA -> 400 Bad Request
    r_lecturista = admin.post(
        "/empleados",
        json={
            "nombre": "Prueba Lecturista",
            "username": "qa_lecturista_invalido",
            "email": "lecturista@pruebas.miaa.local",
            "passwordTemporal": "Temporal2026",
            "rol": "LECTURISTA",
        },
    )
    assert r_lecturista.status_code == 400