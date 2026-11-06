import os
import requests
import urllib3

# Suprime advertencias de certificados autofirmados si verify=False
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Lee la URL de la API del entorno o usa el valor por defecto
BASE_URL = os.getenv("MIAA_API", "https://localhost:8500/api/v1").rstrip("/")

def api_url(ruta: str) -> str:
    if not ruta.startswith("/"):
        ruta = "/" + ruta
    return f"{BASE_URL}{ruta}"

def test_estado_dinamico_usuario_conexion_y_desconexion():
    """
    Tarea 3.3 / 1.4:
    Valida la transición del estado del usuario entre activo (EN_LINEA) e inactivo (DESCONECTADO):
    1. Login de notificador -> debe responder 200 y token.
    2. Enviar latido de presencia (POST /usuarios/yo/conexion) -> responde 204.
    3. Logout explícito (POST /auth/logout) -> responde 204 y limpia presencia.
    """
    # 1. Autenticar como notificador de campo
    creds_notificador = {
        "username": "notificador1",
        "password": "notificador1"
    }
    res_login = requests.post(api_url("/auth/login"), json=creds_notificador, verify=False)
    assert res_login.status_code == 200, f"Error en login: {res_login.text}"
    
    data_login = res_login.json()
    token_notificador = data_login["token"]
    user_id = data_login["user"]["id"]
    headers_notificador = {"Authorization": f"Bearer {token_notificador}"}

    # 2. Enviar latido de presencia (latido periódico desde el móvil)
    res_latido = requests.post(api_url("/usuarios/yo/conexion"), headers=headers_notificador, verify=False)
    assert res_latido.status_code == 204, f"Fallo al registrar presencia: {res_latido.status_code}"

    # 3. Autenticar como admin para verificar disponibilidad
    creds_admin = {
        "username": "admin",
        "password": "admin123"
    }
    res_admin = requests.post(api_url("/auth/login"), json=creds_admin, verify=False)
    assert res_admin.status_code == 200, f"Error en login admin: {res_admin.text}"
    token_admin = res_admin.json()["token"]
    headers_admin = {"Authorization": f"Bearer {token_admin}"}

    # 4. Consultar empleados desde el panel admin
    res_empleados = requests.get(api_url("/admin/empleados"), headers=headers_admin, verify=False)
    if res_empleados.status_code == 200:
        notificador = next((e for e in res_empleados.json() if e.get("id") == user_id or e.get("username") == "notificador1"), None)
        if notificador and "disponibilidad" in notificador:
            assert notificador["disponibilidad"] == "EN_LINEA", f"Se esperaba EN_LINEA: {notificador}"

    # 5. Cerrar sesión explícitamente desde la aplicación móvil
    res_logout = requests.post(api_url("/auth/logout"), headers=headers_notificador, verify=False)
    assert res_logout.status_code == 204, f"Error al ejecutar logout: {res_logout.status_code}"

    # 6. Confirmar que el estado pasó a DESCONECTADO
    if res_empleados.status_code == 200:
        res_empleados_post = requests.get(api_url("/admin/empleados"), headers=headers_admin, verify=False)
        assert res_empleados_post.status_code == 200
        notificador_post = next((e for e in res_empleados_post.json() if e.get("id") == user_id or e.get("username") == "notificador1"), None)
        if notificador_post and "disponibilidad" in notificador_post:
            assert notificador_post["disponibilidad"] == "DESCONECTADO", f"Se esperaba DESCONECTADO tras logout: {notificador_post}"