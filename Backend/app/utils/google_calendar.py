# =========================================================
# CLIENTE MÍNIMO DE GOOGLE (OAuth 2.0 + Calendar API v3) CON urllib
# =========================================================
# Permiso pedido: calendar.app.created -> SOLO calendarios que crea esta aplicación (el calendario
# "SYNCPAGO") y sus eventos. No puede leer ni modificar el calendario personal del usuario.
# Nunca se maneja la contraseña de Google: el usuario se autentica en la página de Google.
import base64
import hashlib
import hmac
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from typing import Optional, Tuple

from app.config.settings import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, SECRET_KEY, ZONA_HORARIA

URL_AUTORIZACION = "https://accounts.google.com/o/oauth2/v2/auth"
URL_TOKEN = "https://oauth2.googleapis.com/token"
URL_REVOCAR = "https://oauth2.googleapis.com/revoke"
API = "https://www.googleapis.com/calendar/v3"
PERMISO = "https://www.googleapis.com/auth/calendar.app.created"
MAX_AVISO_MINUTOS = 40320


class GoogleSinAcceso(Exception):
    # El usuario revocó el permiso o el token ya no vale: hay que volver a conectar
    pass


class GoogleCalendarioNoExiste(Exception):
    # El calendario SYNCPAGO fue borrado desde Google
    pass


class GoogleError(Exception):
    pass


def _http(metodo: str, url: str, formulario: Optional[dict] = None, cuerpo: Optional[dict] = None, token: Optional[str] = None, espera: int = 15) -> Tuple[int, dict]:
    # Devuelve (código HTTP, JSON de la respuesta). Los errores HTTP NO lanzan excepción: se devuelven.
    datos = None
    cabeceras = {}
    if formulario is not None:
        datos = urllib.parse.urlencode(formulario).encode("utf-8")
        cabeceras["Content-Type"] = "application/x-www-form-urlencoded"
    elif cuerpo is not None:
        datos = json.dumps(cuerpo).encode("utf-8")
        cabeceras["Content-Type"] = "application/json"
    if token:
        cabeceras["Authorization"] = "Bearer " + token
    peticion = urllib.request.Request(url, data=datos, headers=cabeceras, method=metodo)
    try:
        with urllib.request.urlopen(peticion, timeout=espera) as respuesta:
            crudo = respuesta.read().decode("utf-8")
            return respuesta.status, (json.loads(crudo) if crudo else {})
    except urllib.error.HTTPError as error:
        try:
            return error.code, json.loads(error.read().decode("utf-8") or "{}")
        except Exception:
            return error.code, {}


# ---------------------------------------------------------------- OAuth 2.0
def url_autorizacion(estado: str) -> str:
    parametros = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": PERMISO,
        "access_type": "offline",  # pide el refresh token
        "prompt": "consent",  # fuerza a Google a entregar un refresh token nuevo
        "state": estado,
    }
    return URL_AUTORIZACION + "?" + urllib.parse.urlencode(parametros)


def intercambiar_codigo(codigo: str) -> dict:
    estado, datos = _http("POST", URL_TOKEN, formulario={
        "code": codigo,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    })
    if estado != 200 or "access_token" not in datos:
        raise GoogleError("Google rechazó el código de autorización (HTTP " + str(estado) + ")")
    return datos


_cache_acceso: dict = {}  # id_usuario -> (access_token, vence en tiempo monotónico)


def token_de_acceso(id_usuario: int, refresh_token: str) -> str:
    # El access token dura ~1 hora: se reutiliza y se renueva con el refresh token cuando vence
    guardado = _cache_acceso.get(id_usuario)
    if guardado and guardado[1] > time.monotonic() + 60:
        return guardado[0]
    estado, datos = _http("POST", URL_TOKEN, formulario={
        "refresh_token": refresh_token,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "grant_type": "refresh_token",
    })
    if estado in (400, 401) and datos.get("error") == "invalid_grant":
        _cache_acceso.pop(id_usuario, None)
        raise GoogleSinAcceso("El permiso de Google ya no es válido")
    if estado != 200 or "access_token" not in datos:
        raise GoogleError("No se pudo renovar el acceso a Google (HTTP " + str(estado) + ")")
    _cache_acceso[id_usuario] = (datos["access_token"], time.monotonic() + int(datos.get("expires_in", 3600)))
    return datos["access_token"]


def olvidar_acceso(id_usuario: int) -> None:
    _cache_acceso.pop(id_usuario, None)


def revocar(token: str) -> None:
    # Anula el permiso en Google. Si falla no importa: igual se borra lo guardado aquí.
    try:
        _http("POST", URL_REVOCAR, formulario={"token": token})
    except Exception:
        pass


# ---------------------------------------------------------------- Calendario
def crear_calendario(acceso: str) -> str:
    estado, datos = _http("POST", API + "/calendars", cuerpo={"summary": "SYNCPAGO", "timeZone": ZONA_HORARIA, "description": "Vencimientos y recordatorios de SYNCPAGO"}, token=acceso)
    if estado not in (200, 201) or "id" not in datos:
        raise GoogleError("No se pudo crear el calendario SYNCPAGO (HTTP " + str(estado) + ")")
    return datos["id"]


def borrar_calendario(acceso: str, calendario_id: str) -> None:
    _http("DELETE", API + "/calendars/" + urllib.parse.quote(calendario_id, safe=""), token=acceso)


# ---------------------------------------------------------------- Eventos
def id_evento(id_gasto: int) -> str:
    # Google permite elegir el ID del evento. Se DERIVA del gasto con
    # HMAC: el mismo gasto siempre da el mismo ID, así que modificar no duplica y no hace falta guardarlo.
    resumen = hmac.new(SECRET_KEY.encode("utf-8"), ("gasto:" + str(int(id_gasto))).encode("ascii"), hashlib.sha256).digest()[:15]
    return "sp" + base64.b32hexencode(resumen).decode("ascii").lower().rstrip("=")


def cuerpo_evento(id_gasto: int, detalle: str, clase: str, precio, vence: datetime, antelacion: int, estado: str) -> dict:
    return {
        "summary": "Pago: " + detalle + " - $" + "{:,.0f}".format(float(precio)),
        "description": "\n".join([
            "Gasto registrado en SYNCPAGO",
            "Clase: " + str(clase),
            "Valor: $" + "{:,.2f}".format(float(precio)),
            "Estado: " + str(estado),
            "Este evento lo administra SYNCPAGO: si lo cambias en Google, se sobrescribe al editar el gasto.",
        ]),
        # El evento empieza en el VENCIMIENTO; el aviso de Google se dispara "antelacion" minutos antes
        "start": {"dateTime": vence.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": ZONA_HORARIA},
        "end": {"dateTime": (vence + timedelta(minutes=30)).strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": ZONA_HORARIA},
        "reminders": {"useDefault": False, "overrides": [{"method": "popup", "minutes": min(int(antelacion), MAX_AVISO_MINUTOS)}]},
        # Marca privada que identifica los eventos creados por SYNCPAGO
        "extendedProperties": {"private": {"origen": "syncpago", "id_gasto": str(int(id_gasto))}},
        "status": "confirmed",
    }


def guardar_evento(acceso: str, calendario_id: str, evento_id: str, cuerpo: dict) -> None:
    # "Upsert": actualiza el evento si existe; si no existe lo crea con ese mismo ID. Nunca duplica.
    base = API + "/calendars/" + urllib.parse.quote(calendario_id, safe="") + "/events"
    estado, _ = _http("PUT", base + "/" + evento_id, cuerpo=cuerpo, token=acceso)
    if estado == 200:
        return
    if estado in (404, 410):
        estado, _ = _http("POST", base, cuerpo=dict(cuerpo, id=evento_id), token=acceso)
        if estado in (200, 201):
            return
        if estado == 409:
            # Ese ID ya existió y el evento fue cancelado: se "revive" con el mismo ID
            estado, _ = _http("PATCH", base + "/" + evento_id, cuerpo=cuerpo, token=acceso)
            if estado == 200:
                return
        if estado == 404:
            raise GoogleCalendarioNoExiste("El calendario SYNCPAGO ya no existe en Google")
    if estado in (401, 403):
        raise GoogleSinAcceso("Google rechazó el acceso (HTTP " + str(estado) + ")")
    raise GoogleError("No se pudo guardar el evento (HTTP " + str(estado) + ")")


def borrar_evento(acceso: str, calendario_id: str, evento_id: str) -> None:
    estado, _ = _http("DELETE", API + "/calendars/" + urllib.parse.quote(calendario_id, safe="") + "/events/" + evento_id, token=acceso)
    if estado in (200, 204, 404, 410):  # 404/410 = ya no existía: el resultado es el mismo
        return
    if estado in (401, 403):
        raise GoogleSinAcceso("Google rechazó el acceso (HTTP " + str(estado) + ")")
    raise GoogleError("No se pudo borrar el evento (HTTP " + str(estado) + ")")
