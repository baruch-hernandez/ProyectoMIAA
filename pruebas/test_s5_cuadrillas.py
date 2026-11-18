"""Sprint 5 — Historia 5 (lado servidor): latido con ubicación y mapa de cuadrillas del admin.

  1.2  POST /usuarios/heartbeat, con o sin coordenadas; fuera de Aguascalientes → 400
  1.5  GET /admin/cuadrillas/ubicaciones: solo ADMIN; estado, rol, coordenadas y última conexión
  2.2  al cerrar sesión pasa a INACTIVO al instante (se conserva el último punto, en gris)

  pytest test_s5_cuadrillas.py -s
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from apoyo.api import Api

CENTRO_AGS = {"latitud": 21.8818, "longitud": -102.2916, "precision": 6}
CUADRILLAS = "/admin/cuadrillas/ubicaciones"


@pytest.fixture()
def notificador(crear_notificador, config) -> tuple[Api, dict]:
    datos = crear_notificador("cuadrilla", requisitos=False)
    api = Api(config.api)
    api.entrar(datos["username"], datos["password"])
    return api, datos


def en_el_mapa(admin: Api, id_: int) -> dict:
    r = admin.get(CUADRILLAS)
    assert r.status_code == 200, r.text
    return next(e for e in r.json() if e["empleadoId"] == id_)


def test_latido_con_coordenadas_sale_activo_en_el_mapa(notificador, admin):
    api, datos = notificador

    assert api.post("/usuarios/heartbeat", json=CENTRO_AGS).status_code == 204

    yo = en_el_mapa(admin, datos["id"])
    assert yo["estadoConexion"] == "ACTIVO"
    assert yo["rol"] == "NOTIFICADOR" and yo["nombre"]
    assert (yo["latitud"], yo["longitud"]) == (CENTRO_AGS["latitud"], CENTRO_AGS["longitud"])
    conexion = datetime.fromisoformat(yo["ultimaConexion"].replace("Z", "+00:00"))
    assert abs(datetime.now(timezone.utc) - conexion) < timedelta(seconds=30), "en UTC y reciente"
    assert "direccionGeocodificada" in yo  # null en pruebas: no se le pide a Nominatim
    print(f"\n  {yo['nombre']}: {yo['estadoConexion']} en {yo['latitud']}, {yo['longitud']} · {yo['ultimaConexion']}")


def test_latido_sin_cuerpo_cuenta_y_no_borra_el_ultimo_punto(notificador, admin):
    api, datos = notificador
    assert api.post("/usuarios/heartbeat", json=CENTRO_AGS).status_code == 204

    assert api.post("/usuarios/heartbeat").status_code == 204  # así va casi siempre (ahorra datos)

    yo = en_el_mapa(admin, datos["id"])
    assert yo["estadoConexion"] == "ACTIVO" and yo["latitud"] == CENTRO_AGS["latitud"]


def test_coordenadas_fuera_de_aguascalientes_se_rechazan(notificador, admin):
    api, datos = notificador

    r = api.post("/usuarios/heartbeat", json={"latitud": 19.43, "longitud": -99.13, "precision": 5})  # CDMX

    assert r.status_code == 400, r.text
    assert en_el_mapa(admin, datos["id"])["tieneUbicacion"] is False


def test_al_cerrar_sesion_pasa_a_inactivo_con_su_ultimo_punto(notificador, admin):
    api, datos = notificador
    assert api.post("/usuarios/heartbeat", json=CENTRO_AGS).status_code == 204

    assert api.post("/auth/logout").status_code == 204

    yo = en_el_mapa(admin, datos["id"])
    assert yo["estadoConexion"] == "INACTIVO"
    assert yo["tieneUbicacion"] is True, "se sigue viendo dónde estuvo (en gris)"


def test_solo_el_admin_ve_las_ubicaciones(notificador, config):
    api, _ = notificador
    assert api.get(CUADRILLAS).status_code == 403
    assert Api(config.api).get(CUADRILLAS).status_code == 401  # config.api ya trae /api/v1
