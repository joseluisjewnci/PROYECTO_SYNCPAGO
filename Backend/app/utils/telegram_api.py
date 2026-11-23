# =========================================================
# LLAMADAS A LA API DE TELEGRAM (sin librerías externas)
# =========================================================
import json
import urllib.error
import urllib.request

from app.config.settings import TELEGRAM_BOT_TOKEN


class TelegramBloqueado(Exception):
    # El usuario bloqueó el bot o eliminó el chat: ya no se le puede escribir
    pass


def llamar_api(metodo: str, datos: dict, espera: int = 15) -> dict:
    cuerpo = json.dumps(datos).encode("utf-8")
    peticion = urllib.request.Request(
        "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/" + metodo,
        data=cuerpo,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(peticion, timeout=espera) as respuesta:
            return json.loads(respuesta.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        if error.code == 403:
            # 403 = el usuario bloqueó el bot. Se lanza un error propio SIN el token en el mensaje
            raise TelegramBloqueado("HTTP 403") from None
        raise RuntimeError("Telegram respondió HTTP " + str(error.code)) from None


def enviar_mensaje(chat_id: int, texto: str, teclado: dict = None) -> None:
    datos = {"chat_id": chat_id, "text": texto}
    if teclado is not None:
        datos["reply_markup"] = teclado
    llamar_api("sendMessage", datos)
