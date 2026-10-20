"""5.4 — El aviso de privacidad se muestra y se exige al ingresar a la plataforma (RNF-06).

Reglas que se validan:
  - Lo tiene que aceptar todo NOTIFICADOR antes de usar cualquier otra función (el admin no).
  - Mientras no lo acepte, el backend le responde 403 REQUISITO_PENDIENTE (no basta con esconderlo en el front).
  - Se guarda QUÉ versión aceptó y CUÁNDO; si el texto cambia de versión, se vuelve a pedir.
  - Una vez aceptado, no se vuelve a mostrar.
"""
import pytest
from selenium.webdriver.common.by import By

from apoyo import ui
from apoyo.api import Api
from conftest import PASSWORD_DEFINITIVA, captura


# ----------------------------- Backend -----------------------------
def test_sin_aceptar_el_aviso_el_backend_bloquea_todo_lo_demas(crear_notificador, config, admin):
    n = crear_notificador("avisoapi")
    api = Api(config.api)
    datos = api.entrar(n["username"], n["password"])
    assert datos["user"]["avisoPendiente"] is True

    # Se resuelve SOLO la contraseña temporal, para que lo único pendiente sea el aviso
    assert api.put("/usuarios/yo/password", json={"actual": n["password"], "nueva": PASSWORD_DEFINITIVA}).ok
    cuenta = api.get("/usuarios/yo").json()
    assert cuenta["debeCambiarPassword"] is False and cuenta["avisoPrivacidadPendiente"] is True

    r = api.get("/reportes/mios")
    assert r.status_code == 403 and r.json()["codigo"] == "REQUISITO_PENDIENTE"

    # Aceptar una versión que no es la vigente no cuenta
    assert api.post("/usuarios/yo/aviso-privacidad", json={"version": "1999-01"}).status_code == 409

    version = cuenta["avisoPrivacidadVersion"]
    r = api.post("/usuarios/yo/aviso-privacidad", json={"version": version})
    assert r.status_code == 200 and r.json()["avisoPrivacidadPendiente"] is False

    assert api.get("/reportes/mios").status_code == 200, "ya aceptado, debe poder usar la app"
    ficha = admin.get(f"/usuarios/empleados/{n['id']}").json()
    assert ficha["avisoPrivacidadFecha"], "debe quedar registrada la fecha en que lo aceptó"


def test_el_admin_no_tiene_que_aceptar_el_aviso(admin):
    assert admin.get("/usuarios/yo").json()["avisoPrivacidadPendiente"] is False


# ----------------------------- Interfaz (Selenium) -----------------------------
@pytest.mark.ui
def test_flujo_completo_del_aviso_en_la_web(navegador, config, crear_notificador, admin):
    n = crear_notificador("avisoui")
    ui.abrir_login(navegador, config.front)
    ui.login(navegador, n["username"], n["password"])

    # Paso 1: crear su contraseña (entró con una temporal)
    ui.esperar_ruta(navegador, "/cuenta/requisitos")
    ui.esperar_texto(navegador, "Crea tu contraseña")
    ui.escribir(ui.visible(navegador, (By.ID, "pw-actual")), n["password"])
    ui.escribir(navegador.find_element(By.ID, "pw-nueva"), PASSWORD_DEFINITIVA)
    ui.escribir(navegador.find_element(By.ID, "pw-confirmar"), PASSWORD_DEFINITIVA)
    ui.boton_con_texto(navegador, "Guardar nueva contraseña").click()

    # Paso 2: el aviso, con su versión, y el botón bloqueado hasta marcar la casilla
    ui.esperar_texto(navegador, "Aviso de privacidad")
    ui.esperar_texto(navegador, "Versión")
    boton = ui.boton_con_texto(navegador, "Aceptar y continuar")
    assert not boton.is_enabled(), "no debe poder aceptar sin marcar que lo leyó"
    captura(navegador, "5.4_aviso_mostrado")

    navegador.find_element(By.CSS_SELECTOR, "input[type=checkbox]").click()
    ui.esperar(navegador, lambda d: boton.is_enabled())
    captura(navegador, "5.4_aviso_marcado")
    boton.click()

    # Ya aceptado, sigue a su pantalla de inicio. Con la regla 3.3 actual, el notificador
    # no usa la web: termina en el login con "Acceso denegado" (debe entrar por la app móvil).
    ui.texto_alerta(navegador, "Acceso denegado", 20)
    captura(navegador, "5.4_aviso_aceptado")

    # El backend lo registró
    ficha = admin.get(f"/usuarios/empleados/{n['id']}").json()
    assert ficha["avisoPrivacidadFecha"], "el aviso aceptado no quedó guardado"
    assert ficha["debeCambiarPassword"] is False

    # Al volver a entrar ya NO se le pide otra vez
    ui.abrir_login(navegador, config.front)
    ui.login(navegador, n["username"], PASSWORD_DEFINITIVA)
    ui.texto_alerta(navegador, "Acceso denegado", 20)
    assert "/cuenta/requisitos" not in navegador.current_url


@pytest.mark.ui
def test_no_se_puede_saltar_el_aviso_escribiendo_otra_ruta(navegador, config, crear_notificador):
    n = crear_notificador("avisosalto")
    ui.abrir_login(navegador, config.front)
    ui.login(navegador, n["username"], n["password"])
    ui.esperar_ruta(navegador, "/cuenta/requisitos")
    navegador.get(config.front + "/reportes")  # intenta brincarse el aviso
    # Lo regresa a los requisitos o al login, pero nunca a la pantalla de reportes
    ui.esperar(navegador, lambda d: "/reportes" not in d.current_url or "/cuenta/requisitos" in d.current_url)
    assert "Mis reportes" not in navegador.find_element(By.TAG_NAME, "body").text
