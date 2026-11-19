"""Sprint 6 — Historia 6 (web del admin, E2E con Selenium): bandeja de reportes y avisos en vivo.

  2.1  Tabla con miniatura (carga diferida), incidencia, notificador, coordenadas con enlace al mapa
       y hora de captura en hora de Aguascalientes.
  2.2  Al tocar la miniatura: visor con la foto completa, precisión GPS y hora de captura original.
  2.3  El panel queda escuchando el canal en vivo ("Avisos en vivo").
  2.4  Al llegar un reporte (de la cola sin conexión de la app): aviso fijo, contador de no leídos,
       fila nueva arriba sin recargar, y botón para silenciar el sonido (se recuerda).

  pytest test_s6_e2e_bandeja.py -s     (MIAA_HEADLESS=0 para ver el navegador)
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from apoyo.api import Api
from apoyo.ui import abrir_login, login, local_storage, sin_carga
from conftest import captura
from test_s4_sync_reportes import reporte, sincronizar, utc

GPS_FOTO = {"latitud": 21.8818, "longitud": -102.2916, "precisionGps": 4.5}


def reporte_con_gps(semilla: int, hace_min: int = 5):
    meta, archivos = reporte(semilla=semilla, fechaCaptura=utc(timedelta(minutes=hace_min)))
    meta["fotos"][0].update(GPS_FOTO)
    return meta, archivos


def subir(movil: Api, semilla: int) -> dict:
    r = sincronizar(movil, [reporte_con_gps(semilla)])
    assert r.status_code == 200 and r.json()["rechazados"] == [], r.text
    return r.json()["sincronizados"][0]


def test_bandeja_y_aviso_en_vivo(navegador, config, crear_notificador):
    espera = WebDriverWait(navegador, 20, poll_frequency=0.25)
    datos = crear_notificador("bandeja", requisitos=False)
    movil = Api(config.api)
    movil.entrar(datos["username"], datos["password"])
    subir(movil, 80)  # uno que ya estaba antes de abrir el panel

    abrir_login(navegador, config.front)
    login(navegador, config.admin_usuario, config.admin_password)
    sin_carga(navegador)
    espera.until(EC.text_to_be_present_in_element((By.CSS_SELECTOR, "aside [role=status]"), "Avisos en vivo"))

    # 2.4 sonido: el botón lo silencia y se recuerda en el navegador
    sonido = navegador.find_element(By.CSS_SELECTOR, "aside button[aria-pressed]")
    if sonido.get_attribute("aria-pressed") == "false":
        sonido.click()  # que empiece con sonido
    sonido.click()
    assert sonido.get_attribute("aria-pressed") == "false" and local_storage(navegador, "miaa.avisos.silencio") == "1"
    sonido.click()
    assert sonido.get_attribute("aria-pressed") == "true" and local_storage(navegador, "miaa.avisos.silencio") == "0"

    # 2.3 / 2.4: llega un reporte de la cola sin conexión con el panel abierto
    nuevo = subir(movil, 81)
    aviso = espera.until(EC.visibility_of_element_located((By.XPATH, f"//*[@role='status'][contains(., 'Nuevo reporte {nuevo['folio']}')]")))
    assert datos["nombre"] in aviso.text
    primera = navegador.find_element(By.CSS_SELECTOR, "tbody tr")
    assert nuevo["folio"] in primera.text and "Nuevo" in primera.text, "la fila nueva va arriba, sin recargar"
    assert navegador.find_element(By.CSS_SELECTOR, "[aria-label='1 reportes nuevos sin ver']")

    # 2.1: notificador, coordenadas con enlace al mapa y hora de captura en hora de Aguascalientes
    assert datos["nombre"] in primera.text
    enlace = primera.find_element(By.CSS_SELECTOR, "a[href*='openstreetmap.org']")
    assert "21.881800" in enlace.text and "-102.291600" in enlace.text
    hora_ags = datetime.now(timezone(timedelta(hours=-6))).strftime("%d/%m/%Y")  # Ags: UTC-6, sin horario de verano
    assert hora_ags in primera.find_element(By.TAG_NAME, "time").text
    captura(navegador, "s6_bandeja_aviso_en_vivo")

    # 2.1 miniatura con carga diferida (blob ya descargado) y 2.2 visor con los datos técnicos
    mini = primera.find_element(By.CSS_SELECTOR, f"button[aria-label='Ver la evidencia de {nuevo['folio']}']")
    espera.until(lambda _: mini.find_elements(By.CSS_SELECTOR, "img[src^='blob:']"))
    mini.click()
    visor = espera.until(EC.visibility_of_element_located((By.CSS_SELECTOR, "[role=dialog][aria-label='Evidencia del reporte']")))
    espera.until(lambda _: "PRECISIÓN GPS" in visor.text.upper())  # las etiquetas van en mayúsculas por CSS
    assert "±4.5 m" in visor.text and "(Aguascalientes)" in visor.text and "Z" in visor.text  # hora original UTC
    assert visor.find_element(By.CSS_SELECTOR, "img[src^='data:image/']")
    captura(navegador, "s6_visor_evidencia")
    navegador.find_element(By.TAG_NAME, "body").send_keys(Keys.ESCAPE)
    espera.until(EC.invisibility_of_element(visor))

    # Desde otra pantalla: el contador sigue sumando y "Ver reporte" lleva al detalle
    navegador.find_element(By.CSS_SELECTOR, "aside a[href='/admin/empleados']").click()
    otro = subir(movil, 82)
    espera.until(EC.visibility_of_element_located((By.XPATH, f"//*[@role='status'][contains(., 'Nuevo reporte {otro['folio']}')]")))
    navegador.find_element(By.XPATH, "//button[normalize-space()='Ver reporte']").click()
    espera.until(EC.url_contains(f"/admin/reportes/{otro['id']}"))
