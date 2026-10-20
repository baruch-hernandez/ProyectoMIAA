"""5.2 — La comunicación cliente-servidor viaja cifrada ÚNICAMENTE por HTTPS (RNF-03).

Pruebas a nivel de conexión (módulo ssl de Python) + una prueba con Selenium que revisa
que el navegador no haga ni una sola petición sin cifrar.
"""
import os
import socket
import ssl
import tempfile
from urllib.parse import urlparse

import pytest
import requests

from apoyo import ui
from conftest import captura


def _destino(url: str) -> tuple[str, int]:
    u = urlparse(url)
    return u.hostname, u.port or (443 if u.scheme == "https" else 80)


def _contexto_sin_verificar(**kw) -> ssl.SSLContext:
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE  # certificado autofirmado de desarrollo
    for k, v in kw.items():
        setattr(ctx, k, v)
    return ctx


def _handshake(host: str, puerto: int, ctx: ssl.SSLContext) -> ssl.SSLSocket:
    crudo = socket.create_connection((host, puerto), timeout=10)
    return ctx.wrap_socket(crudo, server_hostname=host)


@pytest.mark.parametrize("cual", ["api", "front"])
def test_negocia_tls_1_2_o_1_3(config, cual):
    host, puerto = _destino(config.api if cual == "api" else config.front)
    with _handshake(host, puerto, _contexto_sin_verificar()) as s:
        version, cifrado = s.version(), s.cipher()[0]
    print(f"\n{cual} {host}:{puerto} → {version} / {cifrado}")
    assert version in ("TLSv1.2", "TLSv1.3")


@pytest.mark.parametrize("vieja", ["TLSv1", "TLSv1_1"])
def test_la_api_rechaza_versiones_viejas_de_tls(config, vieja):
    host, puerto = _destino(config.api)
    version = getattr(ssl.TLSVersion, vieja)
    ctx = _contexto_sin_verificar(minimum_version=version, maximum_version=version)
    try:
        ctx.set_ciphers("DEFAULT:@SECLEVEL=0")  # que el CLIENTE sí se atreva a ofrecerla
    except ssl.SSLError:
        pass
    try:
        with _handshake(host, puerto, ctx) as s:
            pytest.fail(f"El servidor aceptó {s.version()}: debe rechazar TLS 1.0 y 1.1")
    except ssl.SSLError as e:
        if "NO_PROTOCOLS_AVAILABLE" in str(e).upper():
            pytest.skip(f"El OpenSSL de esta PC ya no puede ni ofrecer {vieja}: no se puede probar desde aquí")
        print(f"\n{vieja} rechazado por el servidor: {e.reason or e}")
    except (ConnectionResetError, OSError) as e:
        print(f"\n{vieja} rechazado (conexión cerrada): {e}")


def test_el_puerto_https_no_atiende_http_sin_cifrar(config):
    """Si alguien manda el login en texto plano al 8500, el servidor NO lo procesa."""
    host, puerto = _destino(config.api)
    with socket.create_connection((host, puerto), timeout=10) as s:
        s.sendall(f"POST {urlparse(config.api).path}/auth/login HTTP/1.1\r\nHost: {host}\r\n"
                  "Content-Type: application/json\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}".encode())
        try:
            respuesta = s.recv(4096)
        except (ConnectionResetError, socket.timeout):
            respuesta = b""
    primera = respuesta.split(b"\r\n", 1)[0].decode(errors="replace")
    print(f"\nRespuesta a HTTP plano: {primera or '(conexión cerrada)'}")
    assert b" 200 " not in respuesta[:20], "el puerto HTTPS respondió 200 a una petición sin cifrar"
    assert primera == "" or " 400" in primera


def test_http_redirige_a_https(config):
    host, puerto_https = _destino(config.api)
    puerto_http = int(os.environ.get("MIAA_PUERTO_REDIRECCION", "8090"))
    try:
        with requests.Session() as s:
            s.trust_env = False
            r = s.get(f"http://{host}:{puerto_http}{urlparse(config.api).path}/auth/login",
                      allow_redirects=False, timeout=10)
    except requests.ConnectionError:
        pytest.skip(f"No hay nada en el puerto {puerto_http} (miaa.https.puerto-redireccion=0 o perfil sin https)")
    assert r.status_code in (301, 302, 307, 308)
    destino = r.headers["Location"]
    print(f"\nhttp://{host}:{puerto_http} → {r.status_code} {destino}")
    assert destino.startswith("https://") and f":{puerto_https}" in destino


def test_el_certificado_es_valido_para_el_host(config):
    """Si la IP de la PC cambió y no se regeneró el certificado, aquí se nota."""
    host, puerto = _destino(config.api)
    with _handshake(host, puerto, _contexto_sin_verificar()) as s:
        der = s.getpeercert(binary_form=True)
    with tempfile.NamedTemporaryFile("w", suffix=".pem", delete=False) as f:
        f.write(ssl.DER_cert_to_PEM_cert(der))
    try:
        datos = ssl._ssl._test_decode_cert(f.name)  # noqa: SLF001 (lector interno de CPython)
    except Exception:  # noqa: BLE001
        pytest.skip("Esta versión de Python no permite leer el certificado")
    finally:
        os.unlink(f.name)
    nombres = [v for _, v in datos.get("subjectAltName", ())]
    print(f"\nEl certificado sirve para: {nombres} (vence {datos.get('notAfter')})")
    assert host in nombres, (f"El certificado no incluye '{host}'. Bórralo y vuelve a correr "
                             "backend\\generar-certificado.ps1 con la IP actual.")


def test_hsts_en_produccion(config):
    if os.environ.get("MIAA_ESPERAR_HSTS") != "1":
        pytest.skip("En desarrollo HSTS va apagado a propósito (ver LEEME). En producción: MIAA_ESPERAR_HSTS=1")
    with requests.Session() as s:
        s.trust_env = False
        r = s.get(config.front, timeout=10)
    assert "max-age=" in r.headers.get("Strict-Transport-Security", "")


@pytest.mark.ui
def test_el_navegador_solo_hace_peticiones_https(navegador, config):
    ui.abrir_login(navegador, config.front)
    ui.login(navegador, config.admin_usuario, config.admin_password)
    ui.esperar_ruta(navegador, "/admin")
    ui.boton_con_texto(navegador, "Cerrar sesión")  # el panel ya cargó
    info = navegador.execute_script("""
        return {
          protocolo: location.protocol,
          seguro: window.isSecureContext,
          recursos: performance.getEntriesByType('resource').map(r => r.name)
        };""")
    sin_cifrar = [u for u in info["recursos"] if u.startswith("http:") or u.startswith("ws:")]
    print(f"\n{len(info['recursos'])} peticiones revisadas; sin cifrar: {sin_cifrar or 'ninguna'}")
    assert info["protocolo"] == "https:"
    assert info["seguro"] is True, "la página no es un contexto seguro (el GPS no funcionaría)"
    assert any("/auth/login" in u for u in info["recursos"]), "no se vio la petición de login"
    assert not sin_cifrar
    captura(navegador, "5.2_panel_por_https")
