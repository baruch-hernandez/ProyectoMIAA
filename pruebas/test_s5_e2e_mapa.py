"""Sprint 5 — QA 3.3: E2E Web & Móvil en el mapa administrativo (/admin/mapa).

Valida:
1. Visualización del marcador en VERDE (#0fa987) cuando el notificador manda latido activo.
2. Apertura del popup al seleccionar al empleado: rol, estado ACTIVO, hora local America/Mexico_City y coordenadas (6 decimales).
3. Transición visual en tiempo real de VERDE (#0fa987) a GRIS (#64748b) tras logout del notificador.
4. Transición visual de VERDE a GRIS al perder conectividad (dejar de mandar latidos).
5. Filtro por estado (ACTIVO / INACTIVO) y búsqueda por nombre.
"""
from __future__ import annotations

import os
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait

from apoyo.api import Api
from apoyo.ui import abrir_login, login, sin_carga
from conftest import captura

PUNTO_AGS = {"latitud": 21.8818, "longitud": -102.2916, "precision": 5}
COLOR_VERDE = "#0fa987"
COLOR_GRIS = "#64748b"


def esperar_color_marcador(driver, color_esperado: str, timeout: float = 10.0):
    def _tiene_color(d):
        paths = d.find_elements(By.CSS_SELECTOR, "path.leaflet-interactive")
        return any((p.get_attribute("fill") or "").lower() == color_esperado for p in paths)

    WebDriverWait(driver, timeout, poll_frequency=0.25).until(_tiene_color)


def test_3_3_e2e_mapa_marcador_popup_y_transicion_logout(navegador, config, crear_notificador):
    umbral = int(os.environ.get("MIAA_SEGUNDOS_EN_LINEA", "3"))

    # 1. Crear y autenticar notificador móvil
    datos = crear_notificador("e2e_mapa", requisitos=False)
    movil = Api(config.api)
    movil.entrar(datos["username"], datos["password"])

    # 2. Abrir panel web como ADMIN y navegar a /admin/mapa ANTES del latido
    abrir_login(navegador, config.front)
    login(navegador, config.admin_usuario, config.admin_password)
    navegador.get(f"{config.front}/admin/mapa")

    buscador = WebDriverWait(navegador, 15).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, "input#buscar-cuadrilla"))
    )
    buscador.clear()
    buscador.send_keys(datos["nombre"])

    # 3. Mandar latido con coordenadas ya con el mapa abierto (evita que expire antes de cargar)
    assert movil.post("/usuarios/heartbeat", json=PUNTO_AGS).status_code == 204
    hora_latido = datetime.now(ZoneInfo("America/Mexico_City"))

    # 4. Verificar marcador en VERDE (#0fa987)[cite: 41]
    esperar_color_marcador(navegador, COLOR_VERDE, timeout=10)
    captura(navegador, "s5_e2e_1_marcador_verde")

    # Refrescar latido para mantenerlo activo mientras se abre el popup
    assert movil.post("/usuarios/heartbeat").status_code == 204

    # 5. Clic en el botón de la lista lateral para abrir el popup y revisar datos[cite: 41]
    boton_empleado = WebDriverWait(navegador, 10).until(
        EC.element_to_be_clickable(
            (By.XPATH, f"//section[@aria-label='Notificadores']//button[contains(., '{datos['nombre']}')]")
        )
    )
    sin_carga(navegador)
    boton_empleado.click()

    popup = WebDriverWait(navegador, 10).until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, ".leaflet-popup-content"))
    )
    texto_popup = popup.text

    assert datos["nombre"] in texto_popup
    assert "Notificador" in texto_popup
    assert "ACTIVO" in texto_popup
    assert "21.881800, -102.291600" in texto_popup

    hhmm_actual = hora_latido.strftime("%H:%M")
    hhmm_anterior = (hora_latido - timedelta(minutes=1)).strftime("%H:%M")
    assert f"Hoy {hhmm_actual} h" in texto_popup or f"Hoy {hhmm_anterior} h" in texto_popup, (
        f"Hora inesperada en popup: {texto_popup}"
    )
    captura(navegador, "s5_e2e_2_popup_activo")

    # 6. Cierre de sesión en la app móvil -> marcador pasa a GRIS (#64748b) en 1-3 s
    assert movil.post("/auth/logout").status_code == 204
    esperar_color_marcador(navegador, COLOR_GRIS, timeout=8)
    captura(navegador, "s5_e2e_3_marcador_gris_logout")

    # 7. Reconectar, volver a VERDE y simular pérdida de conectividad (sin latidos)
    movil.entrar(datos["username"], datos["password"])
    assert movil.post("/usuarios/heartbeat", json=PUNTO_AGS).status_code == 204
    esperar_color_marcador(navegador, COLOR_VERDE, timeout=8)

    time.sleep(umbral + 2)
    esperar_color_marcador(navegador, COLOR_GRIS, timeout=8)
    captura(navegador, "s5_e2e_4_marcador_gris_sin_red")

    # 8. Validar filtro select#filtro-cuadrilla[cite: 41]
    selector = Select(navegador.find_element(By.CSS_SELECTOR, "select#filtro-cuadrilla"))
    selector.select_by_value("ACTIVO")
    time.sleep(0.4)
    assert len(navegador.find_elements(By.CSS_SELECTOR, "path.leaflet-interactive")) == 0

    selector.select_by_value("INACTIVO")
    time.sleep(0.4)
    esperar_color_marcador(navegador, COLOR_GRIS, timeout=5)