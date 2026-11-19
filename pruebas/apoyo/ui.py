"""Ayudas de Selenium para las pantallas de MIAA (selectores en un solo lugar)."""
from __future__ import annotations

from selenium.common.exceptions import StaleElementReferenceException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

USUARIO = (By.ID, "login-usuario")
PASSWORD = (By.ID, "login-password")
ENTRAR = (By.CSS_SELECTOR, "form button[type=submit]")
ALERTA = (By.CSS_SELECTOR, "[role=alert]")


def esperar(driver, condicion, segundos: float = 15):
    # Si React vuelve a dibujar el elemento mientras se espera, se reintenta en vez de tronar
    return WebDriverWait(driver, segundos, ignored_exceptions=(StaleElementReferenceException,)).until(condicion)


def sin_carga(driver, segundos: float = 30):
    """Espera a que se vaya la gota de carga: mientras se ve, tapa la pantalla y no deja dar clic
    (sale un momento en cada cambio de pantalla y mientras se espera al servidor)."""
    esperar(driver, lambda d: not d.find_elements(By.CSS_SELECTOR, "[data-gota-carga]"), segundos)


def visible(driver, localizador, segundos: float = 15):
    elemento = esperar(driver, EC.visibility_of_element_located(localizador), segundos)
    sin_carga(driver)
    return elemento


def esperar_texto(driver, texto: str, segundos: float = 15):
    """Espera a que el texto aparezca en cualquier parte de la página."""
    esperar(driver, lambda d: texto in d.find_element(By.TAG_NAME, "body").text, segundos)


def esperar_ruta(driver, ruta: str, segundos: float = 15):
    esperar(driver, lambda d: d.current_url.split("?")[0].rstrip("/").endswith(ruta.rstrip("/")), segundos)


def abrir_login(driver, front: str):
    driver.get(front + "/")
    visible(driver, USUARIO)


def escribir(elemento, texto: str):
    elemento.clear()
    elemento.send_keys(texto)


def login(driver, usuario: str, password: str):
    """Llena el formulario de login (ya abierto), da Entrar y espera la respuesta del servidor."""
    escribir(visible(driver, USUARIO), usuario)
    escribir(driver.find_element(*PASSWORD), password)
    boton = driver.find_element(*ENTRAR)
    esperar(driver, lambda d: boton.is_enabled())
    sin_carga(driver)
    boton.click()
    # Mientras el servidor contesta, el botón dice "Entrando…". Si entró, el formulario desaparece.
    def termino(d):
        botones = d.find_elements(*ENTRAR)
        return not botones or "Entrando" not in botones[0].text
    esperar(driver, termino, 30)


def texto_alerta(driver, contiene: str | None = None, segundos: float = 15) -> str:
    """Texto del aviso (role=alert). Si se da `contiene`, espera a que aparezca ese texto."""
    def listo(d):
        textos = [e.text for e in d.find_elements(*ALERTA) if e.is_displayed() and e.text.strip()]
        if contiene is None:
            return textos[0] if textos else False
        return next((t for t in textos if contiene in t), False)
    return esperar(driver, listo, segundos)


def boton_con_texto(driver, texto: str):
    """El primer botón VISIBLE con ese texto (hay layouts con el mismo botón para celular y escritorio)."""
    def buscar(d):
        botones = d.find_elements(By.XPATH, f"//button[contains(normalize-space(.), '{texto}')]")
        return next((b for b in botones if b.is_displayed()), False)
    boton = esperar(driver, buscar)
    sin_carga(driver)
    return boton


def session_storage(driver, llave: str):
    return driver.execute_script("return window.sessionStorage.getItem(arguments[0]);", llave)


def local_storage(driver, llave: str):
    return driver.execute_script("return window.localStorage.getItem(arguments[0]);", llave)
