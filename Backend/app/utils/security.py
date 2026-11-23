import hashlib
import hmac
import re
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

# =========================================================
# CONFIGURACIÓN DEL HASHING
# =========================================================
# Argon2id con los parámetros por defecto de argon2-cffi.
# El hash resultante mide 97 caracteres.
_hasher = PasswordHasher()


PERMITIR_TEXTO_PLANO_LEGACY = False

# Formato del hash PBKDF2 antiguo de este proyecto: 32 hex de salt + ":" + 64 hex de clave.
_PATRON_PBKDF2 = re.compile(r"^[0-9a-f]{32}:[0-9a-f]{64}$")


# =========================================================
# DETECTAR EL FORMATO DE LO QUE HAY GUARDADO
# =========================================================
def _es_argon2(stored_password: str) -> bool:
    return stored_password.startswith("$argon2")


def _es_pbkdf2(stored_password: str) -> bool:
    return bool(_PATRON_PBKDF2.match(stored_password))


# =========================================================
# CIFRAR CONTRASEÑA (HASHING)
# =========================================================
def cifrar_contrasena(password: str) -> str:
    # Argon2id genera internamente un salt aleatorio distinto en cada llamada
    # y lo incluye dentro del texto del hash: no hay que guardarlo aparte.
    return _hasher.hash(password)


# =========================================================
# VERIFICAR HASH PBKDF2 ANTIGUO (SOLO COMPATIBILIDAD)
# =========================================================
def _verificar_pbkdf2(stored_password: str, provided_password: str) -> bool:
    try:
        # Recuperamos el salt y la clave original que guardamos en la BD
        salt_hex, key_hex = stored_password.split(':')
        salt = bytes.fromhex(salt_hex)
        key = bytes.fromhex(key_hex)
        # Volvemos a cifrar la contraseña ingresada en el login con el mismo salt e iteraciones
        new_key = hashlib.pbkdf2_hmac('sha256', provided_password.encode('utf-8'), salt, 100000)
        # Comparamos en tiempo constante (evita ataques de temporización)
        return hmac.compare_digest(new_key, key)
    except Exception:
        return False


# =========================================================
# VERIFICAR CONTRASEÑA
# =========================================================
def verificar_contrasena(stored_password: str, provided_password: str) -> bool:
    # Si en la BD no hay un texto válido, nunca se autentica
    if not isinstance(stored_password, str) or not stored_password:
        return False

    # Caso 1: hash Argon2id (formato nuevo)
    if _es_argon2(stored_password):
        try:
            return _hasher.verify(stored_password, provided_password)
        except (VerificationError, InvalidHashError):
            # VerifyMismatchError (contraseña incorrecta) hereda de VerificationError
            return False

    # Caso 2: hash PBKDF2 antiguo "salt:clave"
    if _es_pbkdf2(stored_password):
        return _verificar_pbkdf2(stored_password, provided_password)

    # Caso 3: texto plano legacy (usuarios anteriores al hashing)
    if PERMITIR_TEXTO_PLANO_LEGACY:
        return hmac.compare_digest(
            stored_password.encode("utf-8"),
            provided_password.encode("utf-8")
        )

    return False


# =========================================================
# ¿EL HASH GUARDADO DEBE ACTUALIZARSE?
# =========================================================
def necesita_rehash(stored_password: str) -> bool:
    # Texto plano o PBKDF2 antiguo -> sí, hay que pasarlo a Argon2id
    if not _es_argon2(stored_password):
        return True
    # Argon2id con parámetros más débiles que los actuales -> también
    try:
        return _hasher.check_needs_rehash(stored_password)
    except InvalidHashError:
        return True


# =========================================================
# IDENTIFICADOR DE SESIÓN
# =========================================================
def generar_sesion_id() -> str:
    # Texto aleatorio e impredecible: es el "sid" que lleva el token de acceso
    return secrets.token_urlsafe(32)


def hash_sesion_id(sesion_id: str) -> str:
    # En la BD solo se guarda el hash SHA-256 (64 caracteres hex) del sid, nunca el sid
    return hashlib.sha256(sesion_id.encode("utf-8")).hexdigest()

