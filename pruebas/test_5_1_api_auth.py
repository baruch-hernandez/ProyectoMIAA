"""5.1 — Pruebas de INTEGRACIÓN del backend: el flujo de autenticación completo por HTTP.

Corren contra la API real (con base de datos), igual que la usaría el front o la app de Flutter.
Cubren los criterios de aceptación: login, JWT de 24 h, roles, rate limit, bloqueo y logout.
"""
import pytest

from apoyo.api import Api, payload_jwt


# ----------------------------- 2.1 Login -----------------------------
def test_login_correcto_regresa_token_y_rol(admin, config, nueva_api):
    r = nueva_api().login(config.admin_usuario, config.admin_password)
    assert r.status_code == 200
    datos = r.json()
    assert datos["token"].count(".") == 2, "el token debe ser un JWT (3 partes)"
    assert datos["user"]["role"] == "ADMIN"
    assert isinstance(datos["user"]["id"], int)


def test_el_token_dura_24_horas(admin):
    p = payload_jwt(admin.token)
    assert p["exp"] - p["iat"] == 24 * 60 * 60
    assert p["rol"] == "ADMIN"


def test_contrasena_incorrecta_responde_401(config, nueva_api):
    r = nueva_api().login(config.admin_usuario, "no-es-esta-1")
    assert r.status_code == 401
    assert "Credenciales inválidas" in r.json()["message"]


def test_usuario_inexistente_da_el_mismo_mensaje(nueva_api):
    """Mismo mensaje que con contraseña mala: un atacante no sabe qué usuarios existen."""
    r = nueva_api().login("nadie_se_llama_asi", "x1x1x1")
    assert r.status_code == 401
    assert r.json()["message"].startswith("Credenciales inválidas")


def test_campos_vacios_responden_400(nueva_api):
    assert nueva_api().login("", "").status_code == 400


def test_la_api_nunca_regresa_contrasenas(admin):
    for ruta in ("/usuarios/yo", "/usuarios/empleados"):
        texto = admin.get(ruta).text.lower()
        assert '"password"' not in texto, f"{ruta} expone la contraseña"
        assert "$2a$" not in texto and "$2b$" not in texto, f"{ruta} expone un hash BCrypt"


# ----------------------------- 2.3 Middleware JWT -----------------------------
def test_sin_token_responde_401(nueva_api):
    assert nueva_api().get("/usuarios/yo").status_code == 401


def test_token_alterado_responde_401(admin, nueva_api):
    api = nueva_api()
    cabeza, cuerpo, firma = admin.token.split(".")
    api.token = f"{cabeza}.{cuerpo}.{firma[:-4]}AAAA"
    assert api.get("/usuarios/yo").status_code == 401


def test_notificador_no_entra_a_endpoints_de_admin(crear_notificador, config):
    n = crear_notificador("rol", requisitos=False)
    api = Api(config.api)
    datos = api.entrar(n["username"], n["password"])
    assert datos["user"]["role"] == "NOTIFICADOR"
    r = api.get("/usuarios/empleados")
    assert r.status_code == 403
    assert r.json().get("codigo") != "REQUISITO_PENDIENTE", "debe ser 403 por ROL, no por requisitos"


def test_admin_no_entra_a_endpoints_de_notificador(admin):
    assert admin.get("/reportes/mios").status_code == 403


# ----------------------------- 1.6 Bloqueo de cuenta -----------------------------
def test_bloqueo_tras_intentos_fallidos_y_desbloqueo(admin, crear_notificador, config):
    n = crear_notificador("bloqueo")
    api = Api(config.api)
    maximo = config.intentos_maximos

    respuestas = [api.login(n["username"], "incorrecta1") for _ in range(maximo)]
    for r in respuestas[:-1]:
        assert r.status_code == 401
    assert "Te queda" in respuestas[-2].json()["message"], "debe avisar cuántos intentos quedan"

    bloqueada = respuestas[-1]
    assert bloqueada.status_code == 423, f"el intento {maximo} debe bloquear: {bloqueada.text}"
    assert bloqueada.json()["codigo"] == "CUENTA_BLOQUEADA"
    assert bloqueada.json()["segundos"] > 0

    # Mientras dure el bloqueo, ni la contraseña correcta deja entrar
    assert api.login(n["username"], n["password"]).status_code == 423

    # El admin la desbloquea y ya puede entrar
    assert admin.post(f"/usuarios/empleados/{n['id']}/desbloquear").status_code == 200
    assert api.login(n["username"], n["password"]).status_code == 200


# ----------------------------- 1.5 Rate limit -----------------------------
def test_rate_limit_por_ip(config, nueva_api):
    if config.max_por_ip is None:
        pytest.fail("El backend nunca respondió 429 en 200 intentos: el rate limit del login no está activo")
    equipo = nueva_api()
    for i in range(config.max_por_ip):
        assert equipo.login(f"rl_{i}", "x").status_code == 401
    r = equipo.login("rl_extra", "x")
    assert r.status_code == 429
    assert r.json()["codigo"] == "DEMASIADOS_INTENTOS"
    assert int(r.headers["Retry-After"]) > 0
    # Otro equipo no paga los intentos del primero
    assert nueva_api().login("rl_otro", "x").status_code == 401


def test_el_rate_limit_es_solo_para_el_login(config, admin):
    """Las demás rutas no cuentan como intentos de login."""
    for _ in range((config.max_por_ip or 10) + 2):
        assert admin.get("/usuarios/yo").status_code == 200


# ----------------------------- 2.2 / 2.4 Logout y disponibilidad -----------------------------
def _disponibilidad(admin, id_):
    empleados = admin.get("/usuarios/empleados").json()["empleados"]
    return next(e for e in empleados if e["id"] == id_)["disponibilidad"]


def test_login_latido_y_logout_cambian_la_disponibilidad(admin, crear_notificador, config):
    n = crear_notificador("presencia", requisitos=False)
    api = Api(config.api)
    api.entrar(n["username"], n["password"])
    assert _disponibilidad(admin, n["id"]) == "EN_LINEA", "al iniciar sesión debe quedar en línea"

    assert api.post("/usuarios/yo/conexion").status_code == 204, "el latido debe responder 204"
    assert _disponibilidad(admin, n["id"]) == "EN_LINEA"

    assert api.post("/auth/logout").status_code == 204
    assert _disponibilidad(admin, n["id"]) == "DESCONECTADO", "al cerrar sesión debe salir desconectado"
