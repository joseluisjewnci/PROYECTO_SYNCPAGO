# =========================================================
# TOKENS JWT (verificación de correo, Telegram, registro y recuperación)
# =========================================================
# Un JWT es un texto firmado con la SECRET_KEY del servidor. Quien lo recibe puede
# leerlo, pero no puede modificarlo sin que la firma deje de ser válida.
# Cada token lleva un "propósito" para que uno no se pueda usar en lugar de otro.
import hashlib
import hmac
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt

from app.config.settings import SECRET_KEY, JWT_ALGORITHM, TOKEN_MINUTOS


def crear_token(proposito: str, datos: dict, minutos: int = TOKEN_MINUTOS) -> str:
    ahora = datetime.now(timezone.utc)
    payload = dict(datos)
    payload["prop"] = proposito
    payload["iat"] = ahora
    payload["exp"] = ahora + timedelta(minutes=minutos)
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)


def validar_token(token: Optional[str], proposito: str) -> Optional[dict]:
    # Devuelve el contenido del token si es válido, no venció y es del propósito esperado.
    # Devuelve None en cualquier otro caso (firma falsa, vencido, otro propósito, vacío).
    if not isinstance(token, str) or not token.strip():
        return None
    try:
        payload = jwt.decode(
            token.strip(),
            SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["exp", "iat"]},
        )
    except jwt.PyJWTError:
        return None
    if payload.get("prop") != proposito:
        return None
    return payload


# =========================================================
# CÓDIGOS DE 6 DÍGITOS (el JWT largo sigue siendo solo para la sesión y los sobres)
# =========================================================
# El código NO se guarda: el servidor guarda su HUELLA dentro de un
# sobre JWT firmado que vence en CODIGO_MINUTOS. Como el HMAC usa la clave secreta del
# servidor, quien tenga el sobre no puede probar el millón de combinaciones por su cuenta.
_PATRON_CODIGO = re.compile(r"^[0-9]{6}$")


def generar_codigo() -> str:
    # secrets usa el generador criptográfico del sistema (random no es apto para esto)
    return "{:06d}".format(secrets.randbelow(1000000))


def generar_jti() -> str:
    # Identificador único del sobre: sirve para contar intentos y marcarlo como usado
    return secrets.token_urlsafe(9)


def huella_codigo(proposito: str, correo: str, codigo: str, jti: str, extra: str = "") -> str:
    # proposito: "registro" o "recuperacion" -> un código de un proceso no sirve en el otro
    mensaje = "|".join(["codigo", proposito, correo, codigo, jti, extra])
    return hmac.new(SECRET_KEY.encode("utf-8"), mensaje.encode("utf-8"), hashlib.sha256).hexdigest()


def codigo_coincide(huella: str, proposito: str, correo: str, codigo, jti: str, extra: str = "") -> bool:
    if not isinstance(codigo, str) or not _PATRON_CODIGO.match(codigo.strip()):
        return False
    esperada = huella_codigo(proposito, correo, codigo.strip(), jti, extra)
    return hmac.compare_digest(esperada, str(huella))
