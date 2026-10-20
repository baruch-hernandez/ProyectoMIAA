"""Cliente pequeño de la API de MIAA para las pruebas.

Cada instancia es "un equipo": tiene su propia IP simulada (cabecera X-Forwarded-For).
El backend solo cree esa cabecera con el perfil "pruebas" (ver application-pruebas.properties).
"""
from __future__ import annotations

import base64
import itertools
import json
import random
import threading

import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 198.18.0.0/15 es el rango reservado para pruebas de rendimiento (RFC 2544): nunca es una IP real.
# Se empieza en un punto al azar para que dos corridas seguidas no compartan contadores del rate limit.
_contador = itertools.count(random.randint(0, 60_000))
_candado = threading.Lock()


def nueva_ip() -> str:
    with _candado:
        n = next(_contador) % 65_000
    return f"198.{18 + n // 32_500}.{(n % 32_500) // 250}.{n % 250 + 1}"


def payload_jwt(token: str) -> dict:
    """Lee (sin verificar) la parte del medio del JWT. Solo para revisar exp/iat en las pruebas."""
    parte = token.split(".")[1]
    parte += "=" * (-len(parte) % 4)
    return json.loads(base64.urlsafe_b64decode(parte))


class Api:
    def __init__(self, base: str, ip: str | None = None, timeout: float = 30):
        self.base = base.rstrip("/")
        self.ip = ip or nueva_ip()
        self.timeout = timeout
        self.token: str | None = None
        self.sesion = requests.Session()
        self.sesion.verify = False  # certificado autofirmado de desarrollo
        # Sin proxies ni certificados del sistema: las pruebas hablan directo con la API local
        # (si no, una variable REQUESTS_CA_BUNDLE o un proxy de la red anulan el verify=False)
        self.sesion.trust_env = False
        self.sesion.headers["X-Forwarded-For"] = self.ip

    # ---------- peticiones ----------
    def _pedir(self, metodo: str, ruta: str, **kw) -> requests.Response:
        headers = kw.pop("headers", {})
        if self.token and "Authorization" not in headers:
            headers["Authorization"] = f"Bearer {self.token}"
        return self.sesion.request(metodo, self.base + ruta, headers=headers, timeout=self.timeout, **kw)

    def get(self, ruta, **kw):
        return self._pedir("GET", ruta, **kw)

    def post(self, ruta, **kw):
        return self._pedir("POST", ruta, **kw)

    def put(self, ruta, **kw):
        return self._pedir("PUT", ruta, **kw)

    # ---------- atajos ----------
    def login(self, usuario: str, password: str) -> requests.Response:
        return self.sesion.post(f"{self.base}/auth/login", json={"username": usuario, "password": password},
                                timeout=self.timeout)

    def entrar(self, usuario: str, password: str) -> dict:
        """Inicia sesión y guarda el token. Regresa el JSON de la respuesta."""
        r = self.login(usuario, password)
        assert r.status_code == 200, f"No pude entrar como {usuario}: {r.status_code} {r.text}"
        datos = r.json()
        self.token = datos["token"]
        return datos
