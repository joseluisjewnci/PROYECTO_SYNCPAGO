# =========================================================
# BOT DE TELEGRAM: VINCULAR LA CUENTA Y RECIBIR RECORDATORIOS
# =========================================================
# Telegram NO permite escribirle a alguien por su número: el bot solo puede escribir a un chat
# donde el usuario ya habló con él. Por eso la vinculación es así:
#   1) En SYNCPAGO (con sesión iniciada) el usuario pide el enlace  t.me/<bot>?start=<código>.
#   2) Al pulsar "Iniciar", Telegram entrega al bot ese código junto con el chat_id REAL de quien pulsó.
#   3) El bot valida el código (firmado, de un solo uso, 10 min) y guarda ese chat_id en SU usuario.
# El bot trabaja por "long polling": el backend le pregunta a Telegram si hay mensajes nuevos.
import threading
import time

from app.config.settings import TELEGRAM_ACTIVO, TELEGRAM_BOT_TOKEN
from app.utils.telegram_api import enviar_mensaje, llamar_api

BOTON_CONTACTO = {
    "keyboard": [[{"text": "Compartir mi número", "request_contact": True}]],
    "resize_keyboard": True,
    "one_time_keyboard": True,
}

AYUDA = (
    "Soy el bot de recordatorios de SYNCPAGO.\n\n"
    "Para vincular tu cuenta entra a SYNCPAGO > Recordatorios > Vincular Telegram y abre el enlace que te damos.\n"
    "Escribe /detener para dejar de recibir avisos."
)


def procesar_actualizacion(update: dict) -> None:
    mensaje = update.get("message")
    if not mensaje:
        return
    chat = mensaje.get("chat", {})
    if chat.get("type") != "private":  # solo chats privados, nunca grupos
        return
    chat_id = chat.get("id")
    texto = (mensaje.get("text") or "").strip()
    # Se importa aquí para que el bot no cree una dependencia circular al cargar el módulo
    from app.config.database import SessionLocal
    from app.controllers.notificacion_controller import desactivar_telegram_por_chat, procesar_contacto_telegram, vincular_telegram

    contacto = mensaje.get("contact")
    if contacto:
        # El contacto debe ser del propio usuario que escribe, no el de otra persona
        if contacto.get("user_id") != mensaje.get("from", {}).get("id"):
            enviar_mensaje(chat_id, "Debes compartir TU propio contacto con el botón.")
            return
        db = SessionLocal()
        try:
            respuesta, token = procesar_contacto_telegram(db, chat_id, str(contacto.get("phone_number", "")))
        finally:
            db.close()
        enviar_mensaje(chat_id, respuesta, {"remove_keyboard": True})
        if token:
            enviar_mensaje(chat_id, token)
        return

    if texto.startswith("/start") and len(texto.split()) == 2:
        db = SessionLocal()
        try:
            exito, respuesta, pedir_numero = vincular_telegram(db, chat_id, texto.split()[1])
        finally:
            db.close()
        enviar_mensaje(chat_id, respuesta)
        if exito and pedir_numero:
            enviar_mensaje(chat_id, "Si quieres verificar también tu número de teléfono, pulsa el botón (opcional).", BOTON_CONTACTO)
        return

    if texto.startswith("/detener"):
        db = SessionLocal()
        try:
            hubo = desactivar_telegram_por_chat(db, chat_id)
        finally:
            db.close()
        enviar_mensaje(chat_id, "Listo, ya no recibirás recordatorios. Puedes reactivarlos en SYNCPAGO > Recordatorios." if hubo else "Este chat no está vinculado a ninguna cuenta de SYNCPAGO.")
        return

    if texto.startswith("/start"):
        # "/start" sin código: es el flujo del REGISTRO (comprobar el número antes de crear la cuenta)
        enviar_mensaje(chat_id, "Hola, soy el bot de SYNCPAGO. Para comprobar tu número de teléfono pulsa el botón.\n\n" + AYUDA, BOTON_CONTACTO)
        return

    enviar_mensaje(chat_id, AYUDA)


def _bucle() -> None:
    offset = 0
    while True:
        try:
            respuesta = llamar_api(
                "getUpdates",
                {"offset": offset, "timeout": 25, "allowed_updates": ["message"]},
                espera=40,
            )
            for update in respuesta.get("result", []):
                offset = update["update_id"] + 1
                try:
                    procesar_actualizacion(update)
                except Exception as error:
                    print("Telegram: error procesando un mensaje:", type(error).__name__)
        except Exception as error:
            # Se imprime solo el tipo de error: el mensaje podría contener el token del bot
            print("Telegram: error de conexión:", type(error).__name__)
            time.sleep(5)


def iniciar_bot_telegram() -> None:
    if not TELEGRAM_ACTIVO:
        print("Telegram desactivado (TELEGRAM_ACTIVO=false): no se podrá vincular Telegram")
        return
    if not TELEGRAM_BOT_TOKEN:
        print("Telegram activo pero falta TELEGRAM_BOT_TOKEN: el bot NO se inició")
        return
    threading.Thread(target=_bucle, daemon=True).start()
    print("Bot de Telegram iniciado")
