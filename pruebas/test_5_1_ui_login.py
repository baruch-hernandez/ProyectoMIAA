"""5.1 — Pruebas de INTEGRACIÓN del front con Selenium (navegador real → Vite → API → base).

Cubren 3.1 (login web), 3.2 (token en sessionStorage), 3.3 (ruteo por rol) y 3.4 (errores en la UI).
Cada paso importante deja una captura en reportes/capturas/ como evidencia.
"""
import pytest
from selenium.webdriver.common.by import By

from apoyo import ui
from conftest import abrir_chrome, captura

pytestmark = pytest.mark.ui


def test_admin_entra_al_panel_y_el_token_queda_en_session_storage(navegador, config):
    ui.abrir_login(navegador, config.front)
    ui.login(navegador, config.admin_usuario, config.admin_password)
    ui.esperar_ruta(navegador, "/admin")
    ui.visible(navegador, (By.XPATH, "//h1[normalize-space()='Reportes']"))

    token = ui.session_storage(navegador, "token")
    assert token and token.count(".") == 2, "el JWT debe quedar en sessionStorage"
    assert ui.local_storage(navegador, "token") is None, "el JWT NO debe quedar en localStorage"
    captura(navegador, "5.1_admin_en_panel")


def test_contrasena_incorrecta_muestra_error(navegador, config):
    ui.abrir_login(navegador, config.front)
    ui.login(navegador, config.admin_usuario, "incorrecta-123")
    assert "Credenciales inválidas" in ui.texto_alerta(navegador, "Credenciales")
    assert navegador.current_url.rstrip("/").endswith(config.front.split("//")[1].split("/")[0]) \
        or navegador.current_url.endswith("/")
    captura(navegador, "5.1_contrasena_incorrecta")


def test_cuenta_bloqueada_muestra_aviso_y_cuenta_regresiva(navegador, config, admin, crear_notificador):
    n = crear_notificador("bloqueoui")
    ui.abrir_login(navegador, config.front)
    for intento in range(1, config.intentos_maximos + 1):
        ui.login(navegador, n["username"], "incorrecta-1")
        if intento == config.intentos_maximos - 1:
            ui.texto_alerta(navegador, "Te queda 1 intento")
            captura(navegador, "5.1_ultimo_intento")
    ui.esperar_texto(navegador, "Cuenta bloqueada")
    ui.esperar_texto(navegador, "Tiempo restante")
    captura(navegador, "5.1_cuenta_bloqueada")
    admin.post(f"/usuarios/empleados/{n['id']}/desbloquear")


def test_rate_limit_deshabilita_el_boton_con_cuenta_regresiva(config):
    if config.max_por_ip is None:
        pytest.skip("el rate limit no está activo en el backend")
    driver = abrir_chrome()  # IP propia: no afecta a las demás pruebas
    try:
        ui.abrir_login(driver, config.front)
        for i in range(config.max_por_ip + 1):
            ui.login(driver, f"no_existe_{i}", "x1x1x1")
            ui.texto_alerta(driver)
        ui.esperar_texto(driver, "Demasiados intentos")
        boton = driver.find_element(*ui.ENTRAR)
        ui.esperar(driver, lambda d: "Espera" in boton.text)
        assert not boton.is_enabled(), "el botón debe quedar deshabilitado mientras corre la espera"
        captura(driver, "5.1_rate_limit_429")
    finally:
        driver.quit()


def test_notificador_no_puede_usar_el_panel_web(navegador, config, crear_notificador):
    """3.3: el panel web es solo para administradores; el notificador usa la app móvil."""
    n = crear_notificador("sinweb", requisitos=False)
    ui.abrir_login(navegador, config.front)
    ui.login(navegador, n["username"], n["password"])
    assert "Acceso denegado" in ui.texto_alerta(navegador, "Acceso denegado")
    assert ui.session_storage(navegador, "token") is None, "al negarle el acceso se debe borrar su sesión"
    navegador.get(config.front + "/admin")
    ui.visible(navegador, ui.USUARIO)  # sigue en el login
    captura(navegador, "5.1_notificador_sin_acceso_web")


def test_ruta_protegida_sin_sesion_regresa_al_login(navegador, config):
    navegador.get(config.front + "/admin/empleados")
    ui.visible(navegador, ui.USUARIO)
    assert "/admin" not in navegador.current_url


def test_cerrar_sesion_borra_el_token(navegador, config):
    ui.abrir_login(navegador, config.front)
    ui.login(navegador, config.admin_usuario, config.admin_password)
    ui.esperar_ruta(navegador, "/admin")
    ui.boton_con_texto(navegador, "Cerrar sesión").click()
    ui.visible(navegador, ui.USUARIO)
    assert ui.session_storage(navegador, "token") is None
    navegador.get(config.front + "/admin")
    ui.visible(navegador, ui.USUARIO)  # ya no puede volver sin iniciar sesión
    captura(navegador, "5.1_sesion_cerrada")


def test_la_sesion_no_sobrevive_a_otra_pestana_nueva(config):
    """sessionStorage es por pestaña: un navegador nuevo (otra persona en la misma PC) no hereda la sesión."""
    d1 = abrir_chrome()
    d2 = abrir_chrome()
    try:
        ui.abrir_login(d1, config.front)
        ui.login(d1, config.admin_usuario, config.admin_password)
        ui.esperar_ruta(d1, "/admin")
        d2.get(config.front + "/admin")
        ui.visible(d2, ui.USUARIO)
    finally:
        d1.quit()
        d2.quit()
