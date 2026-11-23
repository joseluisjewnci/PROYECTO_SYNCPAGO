# =========================================================
# CÓDIGO DE VINCULACIÓN CON TELEGRAM
# =========================================================
# El usuario (ya con sesión iniciada en SYNCPAGO) recibe un enlace  t.me/<bot>?start=<código>.
# Al pulsar "Iniciar" en Telegram, el bot recibe el código junto con el chat_id REAL de quien
# pulsó: así se comprueba que la cuenta de Telegram la controla quien tiene la sesión.
# El código (38 caracteres, cabe en el límite de 64 de Telegram) no se guarda en ningún lado:
#   usuario (8 bytes) + vencimiento (4 bytes) + firma HMAC (16 bytes), en base64 seguro para URL.
# La firma incluye el chat vinculado en ese momento: al vincular, cambia y el código deja de servir.
import base64
import hashlib
import hmac
import time
from typing import Optional

from app.config.settings import SECRET_KEY, VINCULO_TELEGRAM_MINUTOS


def _firma(cuerpo: bytes, chat_actual: Optional[int]) -> bytes:
    mensaje = b"telegram-vinculo|" + cuerpo + b"|" + str(chat_actual or 0).encode("ascii")
    return hmac.new(SECRET_KEY.encode("utf-8"), mensaje, hashlib.sha256).digest()[:16]


def crear_codigo_vinculo(id_usuario: int, chat_actual: Optional[int], ahora: Optional[float] = None) -> str:
    vence = int((ahora if ahora is not None else time.time()) + VINCULO_TELEGRAM_MINUTOS * 60)
    cuerpo = int(id_usuario).to_bytes(8, "big") + vence.to_bytes(4, "big")
    return base64.urlsafe_b64encode(cuerpo + _firma(cuerpo, chat_actual)).decode("ascii").rstrip("=")


def leer_codigo_vinculo(codigo: str) -> Optional[tuple]:
    # Devuelve (id_usuario, vence, cuerpo, firma) sin validar la firma todavía (falta saber el chat actual del usuario)
    try:
        crudo = base64.urlsafe_b64decode(codigo + "=" * (-len(codigo) % 4))
    except Exception:
        return None
    if len(crudo) != 28:
        return None
    cuerpo, firma = crudo[:12], crudo[12:]
    return int.from_bytes(cuerpo[:8], "big"), int.from_bytes(cuerpo[8:], "big"), cuerpo, firma


def firma_valida(cuerpo: bytes, firma: bytes, chat_actual: Optional[int]) -> bool:
    return hmac.compare_digest(_firma(cuerpo, chat_actual), firma)
