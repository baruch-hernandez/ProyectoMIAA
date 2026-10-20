"""5.3 — Concurrencia básica: 100 usuarios activos iniciando sesión al mismo tiempo (RNF-05).

Dos niveles:
  1. API: 100 usuarios (cada uno con su propia IP) hacen login + consulta + latido A LA VEZ.
     Es lo que mide la capacidad del backend (BCrypt, JWT, base de datos).
  2. Selenium: N navegadores reales en paralelo (10 por defecto) entran al panel.
     Abrir 100 Chrome reales necesitaría ~15 GB de RAM: con 10 basta para probar la interfaz
     bajo concurrencia; la carga fuerte la pone el nivel 1.

Variables: MIAA_USUARIOS_CARGA [100], MIAA_NAVEGADORES [10], MIAA_P95_MAX_MS [5000].
Resultados en reportes/carga_api.csv y reportes/carga_navegadores.csv.
"""
import csv
import os
import statistics
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import pytest
from selenium.webdriver.common.by import By

from apoyo import ui
from apoyo.api import Api
from conftest import CARPETA_REPORTES, abrir_chrome, captura

pytestmark = pytest.mark.carga

USUARIOS = int(os.environ.get("MIAA_USUARIOS_CARGA", "100"))
NAVEGADORES = int(os.environ.get("MIAA_NAVEGADORES", "10"))
P95_MAX_MS = float(os.environ.get("MIAA_P95_MAX_MS", "5000"))
PASSWORD_CARGA = "Carga2026"


def percentil(valores, p):
    orden = sorted(valores)
    k = max(0, min(len(orden) - 1, round(p / 100 * len(orden) + 0.5) - 1))
    return orden[k]


def resumen(nombre, tiempos_ms):
    return (f"{nombre:<10} n={len(tiempos_ms):<4} promedio={statistics.mean(tiempos_ms):7.0f} ms  "
            f"p50={percentil(tiempos_ms, 50):7.0f}  p95={percentil(tiempos_ms, 95):7.0f}  "
            f"máx={max(tiempos_ms):7.0f}")


@pytest.fixture(scope="module")
def usuarios_carga(admin, config):
    """Crea (o reinicia) carga_001 … carga_100 con la misma contraseña temporal."""
    existentes = {e["username"]: e["id"] for e in admin.get("/usuarios/empleados").json()["empleados"]}

    def preparar(i):
        username = f"carga_{i:03d}"
        if username in existentes:
            id_ = existentes[username]
            admin.put(f"/usuarios/empleados/{id_}/habilitado", json={"habilitado": True})
            r = admin.post(f"/usuarios/empleados/{id_}/password", json={"passwordTemporal": PASSWORD_CARGA})
        else:
            r = admin.post("/usuarios/empleados", json={
                "nombre": f"Carga {i:03d}", "username": username, "passwordTemporal": PASSWORD_CARGA})
            id_ = r.json().get("id") if r.ok else None
        assert r.ok, f"No se pudo preparar {username}: {r.status_code} {r.text}"
        return username, id_

    with ThreadPoolExecutor(max_workers=10) as pool:
        return dict(pool.map(preparar, range(1, USUARIOS + 1)))


def test_100_usuarios_inician_sesion_al_mismo_tiempo(usuarios_carga, admin, config):
    salida = threading.Barrier(USUARIOS)  # todos arrancan en el mismo instante
    filas = []

    def usuario(username):
        api = Api(config.api)  # cada uno con su IP
        fila = {"usuario": username, "ip": api.ip}
        try:
            salida.wait(timeout=120)
            t0 = time.perf_counter()
            r = api.login(username, PASSWORD_CARGA)
            fila["login_ms"], fila["login_status"] = (time.perf_counter() - t0) * 1000, r.status_code
            if r.status_code == 200:
                api.token = r.json()["token"]
                t1 = time.perf_counter()
                r = api.get("/usuarios/yo")
                fila["yo_ms"], fila["yo_status"] = (time.perf_counter() - t1) * 1000, r.status_code
                t2 = time.perf_counter()
                r = api.post("/usuarios/yo/conexion")
                fila["latido_ms"], fila["latido_status"] = (time.perf_counter() - t2) * 1000, r.status_code
        except Exception as e:  # noqa: BLE001
            fila["error"] = repr(e)
        return fila

    inicio = time.perf_counter()
    with ThreadPoolExecutor(max_workers=USUARIOS) as pool:
        filas = list(pool.map(usuario, usuarios_carga))
    total_s = time.perf_counter() - inicio

    CARPETA_REPORTES.mkdir(exist_ok=True)
    columnas = ["usuario", "ip", "login_status", "login_ms", "yo_status", "yo_ms",
                "latido_status", "latido_ms", "error"]
    with open(CARPETA_REPORTES / "carga_api.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=columnas)
        w.writeheader()
        w.writerows(filas)

    fallas = [f for f in filas if f.get("error") or f.get("login_status") != 200
              or f.get("yo_status") != 200 or f.get("latido_status") != 204]
    logins = [f["login_ms"] for f in filas if "login_ms" in f]
    print(f"\n{USUARIOS} usuarios simultáneos en {total_s:.1f} s · fallas: {len(fallas)}")
    print(resumen("login", logins))
    for paso in ("yo", "latido"):
        tiempos = [f[f"{paso}_ms"] for f in filas if f"{paso}_ms" in f]
        if tiempos:
            print(resumen(paso, tiempos))

    assert not fallas, f"{len(fallas)} usuarios fallaron, p. ej.: {fallas[:3]}"
    assert percentil(logins, 95) <= P95_MAX_MS, f"el 95% de los logins debe tardar ≤ {P95_MAX_MS:.0f} ms"

    # 2.4 bajo carga: el admin ve a los 100 en línea
    empleados = admin.get("/usuarios/empleados").json()["empleados"]
    en_linea = sum(1 for e in empleados if e["username"] in usuarios_carga and e["disponibilidad"] == "EN_LINEA")
    print(f"En línea según el panel del admin: {en_linea}/{USUARIOS}")
    assert en_linea == USUARIOS


@pytest.mark.ui
def test_navegadores_en_paralelo_entran_al_panel(config):
    salida = threading.Barrier(NAVEGADORES)

    def sesion(n):
        driver = None
        try:
            driver = abrir_chrome()
            ui.abrir_login(driver, config.front)
            salida.wait(timeout=180)  # si un navegador no abre, los demás no se quedan esperando
            t0 = time.perf_counter()
            ui.login(driver, config.admin_usuario, config.admin_password)
            ui.esperar_ruta(driver, "/admin", 60)
            ui.visible(driver, (By.XPATH, "//h1[normalize-space()='Reportes']"), 60)
            ms = (time.perf_counter() - t0) * 1000
            if n == 0:
                captura(driver, "5.3_navegador_en_paralelo")
            return {"navegador": n + 1, "ms": round(ms), "ok": True}
        except Exception as e:  # noqa: BLE001
            return {"navegador": n + 1, "ms": None, "ok": False, "error": repr(e)[:200]}
        finally:
            if driver is not None:
                driver.quit()

    with ThreadPoolExecutor(max_workers=NAVEGADORES) as pool:
        filas = list(pool.map(sesion, range(NAVEGADORES)))

    with open(CARPETA_REPORTES / "carga_navegadores.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["navegador", "ok", "ms", "error"])
        w.writeheader()
        w.writerows(filas)
    tiempos = [f["ms"] for f in filas if f["ok"]]
    if tiempos:
        print("\n" + resumen("navegador", tiempos))
    fallas = [f for f in filas if not f["ok"]]
    assert not fallas, f"{len(fallas)} navegadores fallaron: {fallas[:2]}"
