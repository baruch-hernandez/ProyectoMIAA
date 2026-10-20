"""Configuración común de las pruebas del Sprint 1 (punto 5).

Todo se ajusta con variables de entorno (valores por defecto entre corchetes):
  MIAA_FRONT            [https://localhost:5173]        front (npm run dev:https)
  MIAA_API              [https://localhost:8500/api/v1]  API (perfiles https,pruebas)
  MIAA_ADMIN_USUARIO    [admin]      MIAA_ADMIN_PASSWORD [admin123]
  MIAA_INTENTOS_MAXIMOS [5]          debe coincidir con miaa.login.intentos-maximos
  MIAA_HEADLESS         [1]          0 = ver el navegador mientras corre
  MIAA_CHROME / MIAA_CHROMEDRIVER    rutas opcionales (por defecto Selenium los encuentra solo)
"""
from __future__ import annotations

import os
import re
import secrets
import time
from pathlib import Path

import pytest

from apoyo.api import Api, nueva_ip

CARPETA_REPORTES = Path(__file__).parent / "reportes"
CARPETA_CAPTURAS = CARPETA_REPORTES / "capturas"


class Config:
    front = os.environ.get("MIAA_FRONT", "https://localhost:5173").rstrip("/")
    api = os.environ.get("MIAA_API", "https://localhost:8500/api/v1").rstrip("/")
    admin_usuario = os.environ.get("MIAA_ADMIN_USUARIO", "admin")
    admin_password = os.environ.get("MIAA_ADMIN_PASSWORD", "admin123")
    intentos_maximos = int(os.environ.get("MIAA_INTENTOS_MAXIMOS", "5"))
    headless = os.environ.get("MIAA_HEADLESS", "1") != "0"
    chrome = os.environ.get("MIAA_CHROME")
    chromedriver = os.environ.get("MIAA_CHROMEDRIVER")
    # Lo descubre la revisión inicial (cuántos logins por IP permite el backend antes del 429)
    max_por_ip: int | None = None


@pytest.fixture(scope="session")
def config() -> type[Config]:
    return Config


# ---------------------------------------------------------------------------
# Revisión antes de empezar: ¿el backend responde y tiene el perfil "pruebas"?
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session", autouse=True)
def revisar_entorno():
    sonda = Api(Config.api)
    try:
        sonda.login("sonda_que_no_existe", "x")
    except Exception as e:  # noqa: BLE001
        pytest.exit(f"No hay respuesta de la API en {Config.api} ({e}). ¿Está corriendo el backend?", 2)

    # Contar cuántos intentos deja pasar desde una IP (usuario inexistente: no gasta BCrypt)
    limite = None
    for intento in range(1, 201):
        r = sonda.login(f"sonda_{intento}", "x")
        if r.status_code == 429:
            limite = intento  # contando el login de arriba, pasaron `intento` antes del 429
            break
    if limite is not None:
        otra = Api(Config.api).login("sonda_otra_ip", "x")
        if otra.status_code == 429:
            pytest.exit("El backend NO está usando la IP de cada usuario (X-Forwarded-For): todas las pruebas "
                        "compartirían el mismo límite. Arráncalo con los perfiles https,pruebas:\n"
                        '  .\\mvnw spring-boot:run "-Dspring-boot.run.profiles=https,pruebas"', 2)
    Config.max_por_ip = limite
    CARPETA_CAPTURAS.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
@pytest.fixture
def nueva_api(config):
    """Fábrica: cada llamada es un "equipo" distinto (otra IP)."""
    return lambda: Api(config.api, nueva_ip())


@pytest.fixture(scope="session")
def admin() -> Api:
    a = Api(Config.api)
    a.entrar(Config.admin_usuario, Config.admin_password)
    return a


PASSWORD_TEMPORAL = "Temporal2026"
PASSWORD_DEFINITIVA = "Campo2026x"


@pytest.fixture(scope="session")
def crear_notificador(admin):
    """Fábrica de notificadores nuevos (usuario único por corrida). Al final se dan de baja.

    crear_notificador("bloqueo")                 → con contraseña temporal y aviso pendiente
    crear_notificador("rol", requisitos=False)   → ya cambió su contraseña y aceptó el aviso
    Regresa {"id", "username", "password", "nombre"}.
    """
    creados: list[int] = []

    def crear(etiqueta: str, requisitos: bool = True) -> dict:
        username = f"qa_{re.sub(r'[^a-z0-9]', '', etiqueta.lower())[:12]}_{secrets.token_hex(3)}"
        r = admin.post("/usuarios/empleados", json={
            "nombre": f"Prueba {etiqueta}", "username": username,
            "email": f"{username}@pruebas.miaa.local", "passwordTemporal": PASSWORD_TEMPORAL})
        assert r.status_code == 201, f"No se pudo crear {username}: {r.status_code} {r.text}"
        datos = {"id": r.json()["id"], "username": username, "password": PASSWORD_TEMPORAL,
                 "nombre": f"Prueba {etiqueta}"}
        creados.append(datos["id"])
        if not requisitos:
            u = Api(Config.api)
            u.entrar(username, PASSWORD_TEMPORAL)
            r = u.put("/usuarios/yo/password", json={"actual": PASSWORD_TEMPORAL, "nueva": PASSWORD_DEFINITIVA})
            assert r.status_code == 200, r.text
            version = u.get("/usuarios/yo").json()["avisoPrivacidadVersion"]
            r = u.post("/usuarios/yo/aviso-privacidad", json={"version": version})
            assert r.status_code == 200, r.text
            datos["password"] = PASSWORD_DEFINITIVA
        return datos

    yield crear
    for id_ in creados:  # que no queden cuentas de prueba activas
        admin.put(f"/usuarios/empleados/{id_}/habilitado", json={"habilitado": False})


# ---------------------------------------------------------------------------
# Navegador (Selenium)
# ---------------------------------------------------------------------------
def abrir_chrome(ip: str | None = None):
    """Chrome con el certificado de desarrollo aceptado y su propia IP simulada."""
    from selenium import webdriver
    from selenium.webdriver.chrome.service import Service

    opciones = webdriver.ChromeOptions()
    opciones.accept_insecure_certs = True  # certificado autofirmado de desarrollo
    if Config.headless:
        opciones.add_argument("--headless=new")
    for arg in ("--window-size=1366,900", "--no-sandbox", "--disable-dev-shm-usage",
                "--disable-search-engine-choice-screen", "--lang=es-MX"):
        opciones.add_argument(arg)
    extra = os.environ.get("MIAA_CHROME_ARGS")
    if extra:
        for arg in extra.split():
            opciones.add_argument(arg)
    if Config.chrome:
        opciones.binary_location = Config.chrome
    servicio = Service(Config.chromedriver) if Config.chromedriver else Service()
    driver = webdriver.Chrome(options=opciones, service=servicio)
    driver.set_page_load_timeout(60)
    # Cada navegador manda su propia IP (X-Forwarded-For) → el rate limit lo cuenta aparte
    driver.execute_cdp_cmd("Network.enable", {})
    driver.execute_cdp_cmd("Network.setExtraHTTPHeaders", {"headers": {"X-Forwarded-For": ip or nueva_ip()}})
    return driver


@pytest.fixture
def navegador(request):
    driver = abrir_chrome()
    request.node._navegador = driver
    yield driver
    driver.quit()


def captura(driver, nombre: str) -> Path:
    """Guarda una captura como evidencia en reportes/capturas/."""
    CARPETA_CAPTURAS.mkdir(parents=True, exist_ok=True)
    ruta = CARPETA_CAPTURAS / f"{time.strftime('%Y%m%d-%H%M%S')}_{nombre}.png"
    driver.save_screenshot(str(ruta))
    return ruta


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Si una prueba con navegador falla, se guarda la pantalla para ver qué pasó."""
    resultado = yield
    reporte = resultado.get_result()
    driver = getattr(item, "_navegador", None)
    if reporte.when == "call" and reporte.failed and driver is not None:
        try:
            captura(driver, f"FALLA_{item.name}")
        except Exception:  # noqa: BLE001
            pass
