# =========================================================
# CIFRADO DE SECRETOS GUARDADOS EN LA BASE DE DATOS
# =========================================================
# El refresh token de Google permite actuar sobre el calendario del usuario, así que NO se guarda
# en texto plano: se cifra con Fernet usando una clave que vive solo en el .env.
# Si alguien copia la base de datos, sin la clave no puede leer los tokens.
import base64
import hashlib
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from app.config.settings import CLAVE_CIFRADO, SECRET_KEY


def _fernet() -> Fernet:
    # Se usa CLAVE_CIFRADO si existe; si no, se deriva de SECRET_KEY (cambiar SECRET_KEY invalida los tokens guardados)
    semilla = (CLAVE_CIFRADO or ("syncpago-cifrado|" + SECRET_KEY)).encode("utf-8")
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(semilla).digest()))


def cifrar_texto(texto: str) -> str:
    return _fernet().encrypt(texto.encode("utf-8")).decode("utf-8")


def descifrar_texto(cifrado: Optional[str]) -> Optional[str]:
    # None si no hay texto o si no se puede descifrar
    if not cifrado:
        return None
    try:
        return _fernet().decrypt(cifrado.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError):
        return None
