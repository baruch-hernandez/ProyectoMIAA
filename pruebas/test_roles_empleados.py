"""El administrador asigna el rol (NOTIFICADOR o ADMIN) a los usuarios nuevos y puede cambiarlo.

Candados que se validan (los pone el backend, no solo la pantalla):
  - un rol que no existe se rechaza;
  - nadie puede cambiarse su propio rol ni darse de baja a sí mismo;
  - un administrador nuevo entra al panel web; un notificador nuevo, no.
"""
import re
import secrets

import pytest
from selenium.webdriver.common.by import By

from apoyo import ui
from apoyo.api import Api
from conftest import PASSWORD_TEMPORAL, captura


def _nuevo(admin, rol=None, etiqueta="rol"):
    username = f"qa_{etiqueta}_{secrets.token_hex(3)}"
    cuerpo = {"nombre": f"Prueba {etiqueta}", "username": username, "passwordTemporal": PASSWORD_TEMPORAL}
    if rol is not None:
        cuerpo["rol"] = rol
    return admin.post("/usuarios/empleados", json=cuerpo), username


def _baja(admin, id_):
    admin.put(f"/usuarios/empleados/{id_}/habilitado", json={"habilitado": False})


# ----------------------------- API -----------------------------
def test_alta_como_administrador(admin, config):
    r, username = _nuevo(admin, "ADMIN", "admin")
    assert r.status_code == 201, r.text
    assert r.json()["rol"] == "ADMIN"
    try:
        datos = Api(config.api).entrar(username, PASSWORD_TEMPORAL)
        assert datos["user"]["role"] == "ADMIN", "el login debe regresar el rol asignado"
        empleados = admin.get("/usuarios/empleados").json()["empleados"]
        assert any(e["username"] == username and e["rol"] == "ADMIN" for e in empleados), \
            "el nuevo administrador debe aparecer en la lista de empleados"
    finally:
        _baja(admin, r.json()["id"])


def test_sin_rol_queda_como_notificador(admin):
    r, _ = _nuevo(admin, None, "sinrol")
    assert r.status_code == 201 and r.json()["rol"] == "NOTIFICADOR"
    _baja(admin, r.json()["id"])


def test_rol_inventado_se_rechaza(admin):
    r, _ = _nuevo(admin, "SUPERUSUARIO", "malo")
    assert r.status_code == 400


def test_cambiar_el_rol_de_otro_aplica_de_inmediato(admin, crear_notificador, config):
    n = crear_notificador("ascenso", requisitos=False)
    api = Api(config.api)
    api.entrar(n["username"], n["password"])
    assert api.get("/usuarios/empleados").status_code == 403, "como notificador no ve el panel"

    r = admin.put(f"/usuarios/empleados/{n['id']}",
                  json={"nombre": n["nombre"], "username": n["username"], "email": None, "rol": "ADMIN"})
    assert r.status_code == 200 and r.json()["rol"] == "ADMIN"
    # Con el MISMO token: el backend lee el rol de la base en cada petición
    assert api.get("/usuarios/empleados").status_code == 200, "el ascenso debe aplicar sin volver a entrar"

    admin.put(f"/usuarios/empleados/{n['id']}",
              json={"nombre": n["nombre"], "username": n["username"], "email": None, "rol": "NOTIFICADOR"})
    assert api.get("/usuarios/empleados").status_code == 403, "y quitárselo también aplica al instante"


def test_nadie_se_cambia_su_propio_rol_ni_se_da_de_baja(admin):
    yo = admin.get("/usuarios/yo").json()
    r = admin.put(f"/usuarios/empleados/{yo['id']}",
                  json={"nombre": yo["nombre"], "username": yo["username"], "email": yo["email"], "rol": "NOTIFICADOR"})
    assert r.status_code == 409, "un admin no debe poder quitarse a sí mismo el rol"
    assert admin.put(f"/usuarios/empleados/{yo['id']}/habilitado", json={"habilitado": False}).status_code == 409
    assert admin.get("/usuarios/yo").json()["rol"] == "ADMIN"


# ----------------------------- Interfaz (Selenium) -----------------------------
@pytest.mark.ui
def test_alta_de_administrador_desde_el_panel(navegador, config, admin):
    ui.abrir_login(navegador, config.front)
    ui.login(navegador, config.admin_usuario, config.admin_password)
    ui.esperar_ruta(navegador, "/admin")
    navegador.get(config.front + "/admin/empleados/nuevo")

    username = f"qa_adminui_{secrets.token_hex(2)}"
    ui.escribir(ui.visible(navegador, (By.ID, "nombre")), "Prueba Admin UI")
    ui.escribir(navegador.find_element(By.ID, "username"), username)
    assert navegador.find_element(By.ID, "nuevo-NOTIFICADOR").is_selected(), "por defecto debe ser notificador"
    navegador.find_element(By.CSS_SELECTOR, "label[for=nuevo-ADMIN]").click()
    ui.esperar_texto(navegador, "Dáselo solo a quien lo necesite")  # advertencia al elegir administrador
    captura(navegador, "roles_alta_administrador")
    ui.boton_con_texto(navegador, "Dar de alta como administrador").click()

    ui.esperar_texto(navegador, "ya puede entrar")
    ui.esperar_texto(navegador, "administrador, en este panel web")
    texto = navegador.find_element(By.TAG_NAME, "body").text
    temporal = re.search(r"Contraseña temporal\s+(\S+)", texto).group(1)
    captura(navegador, "roles_administrador_creado")

    # El nuevo administrador SÍ entra al panel web (primero le pide crear su contraseña)
    from conftest import abrir_chrome
    otro = abrir_chrome()
    try:
        ui.abrir_login(otro, config.front)
        ui.login(otro, username, temporal)
        ui.esperar_ruta(otro, "/cuenta/requisitos")
        ui.esperar_texto(otro, "Crea tu contraseña")
    finally:
        otro.quit()
        nuevo = next(e for e in admin.get("/usuarios/empleados").json()["empleados"] if e["username"] == username)
        _baja(admin, nuevo["id"])


@pytest.mark.ui
def test_en_su_propia_ficha_no_puede_cambiarse_el_rol(navegador, config, admin):
    yo = admin.get("/usuarios/yo").json()
    ui.abrir_login(navegador, config.front)
    ui.login(navegador, config.admin_usuario, config.admin_password)
    ui.esperar_ruta(navegador, "/admin")
    navegador.get(f"{config.front}/admin/empleados/{yo['id']}")
    ui.esperar_texto(navegador, "eres tú")
    assert "Dar de baja" not in navegador.find_element(By.TAG_NAME, "body").text
    ui.boton_con_texto(navegador, "Editar datos").click()
    assert not navegador.find_element(By.ID, "ed-NOTIFICADOR").is_enabled(), "el selector de rol debe estar bloqueado"
    ui.esperar_texto(navegador, "No puedes cambiar tu propio rol")
    captura(navegador, "roles_propia_ficha")
