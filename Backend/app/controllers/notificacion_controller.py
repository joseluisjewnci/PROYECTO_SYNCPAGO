# =========================================================
# NOTIFICACIONES OPCIONALES: TELEGRAM Y GOOGLE CALENDAR
# =========================================================
# Todo es voluntario y se identifica SIEMPRE por el usuario de la sesión (nunca por un id que mande el cliente):
# los avisos de un usuario solo pueden ir al Telegram y al calendario que ese mismo usuario vinculó.
import threading
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple
from zoneinfo import ZoneInfo

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config.settings import GOOGLE_ACTIVO, TELEGRAM_ACTIVO, TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USUARIO, VINCULO_TELEGRAM_MINUTOS, ZONA_HORARIA
from app.utils import google_calendar as google
from app.utils.auditoria import registrar_evento
from app.utils.cifrado import cifrar_texto, descifrar_texto
from app.utils.rate_limit import marcar_usado, registrar_intento
from app.utils.telegram_api import TelegramBloqueado, enviar_mensaje
from app.utils.telegram_vinculo import crear_codigo_vinculo, firma_valida, leer_codigo_vinculo
from app.utils.tokens import crear_token, generar_jti, validar_token

CLASES_VALIDAS = ("vital", "entretenimiento", "varios")


class ErrorNotificacion(Exception):
    # Error controlado: mensaje para el usuario, código de error y código HTTP
    def __init__(self, mensaje: str, error: str, code: int = 400):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.error = error
        self.code = code


def _ahora_local() -> datetime:
    # Las fechas de la BD no llevan zona horaria: se comparan contra la hora de ZONA_HORARIA (sin zona)
    try:
        return datetime.now(ZoneInfo(ZONA_HORARIA)).replace(tzinfo=None)
    except Exception:
        # Windows sin base de zonas (pip install tzdata la agrega): se usa UTC-5 como respaldo
        return datetime.now(timezone(timedelta(hours=-5))).replace(tzinfo=None)


def _clases_a_lista(texto: Optional[str]) -> List[str]:
    return [c for c in (texto or "").split(",") if c in CLASES_VALIDAS]


def telegram_disponible() -> bool:
    return bool(TELEGRAM_ACTIVO and TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USUARIO)


def _fila_usuario(db: Session, id_usuario: int) -> Optional[dict]:
    fila = db.execute(text(
        "SELECT id_usuario, nombre, telefono, telefono_verificado, telegram_chat_id, telegram_activo, notif_clases, google_refresh_token, google_calendario_id "
        "FROM usuarios WHERE id_usuario = :id_usuario;"
    ), {"id_usuario": id_usuario}).fetchone()
    return dict(fila._mapping) if fila else None


# =========================================================
# ESTADO Y PREFERENCIAS
# =========================================================
def obtener_estado(db: Session, id_usuario: int) -> dict:
    fila = _fila_usuario(db, id_usuario)
    if not fila:
        raise ErrorNotificacion("Usuario no encontrado", "USER_NOT_FOUND", 404)
    # Nunca se devuelve el chat_id ni el token de Google: solo si existen
    return {
        "clases": _clases_a_lista(fila["notif_clases"]),
        "telegram": {
            "disponible": telegram_disponible(),
            "vinculado": fila["telegram_chat_id"] is not None,
            "activo": bool(fila["telegram_activo"]) and fila["telegram_chat_id"] is not None,
            "bot_usuario": TELEGRAM_BOT_USUARIO or None,
        },
        "google": {
            "disponible": GOOGLE_ACTIVO,
            "conectado": bool(fila["google_refresh_token"]),
        },
        "telefono": {
            "registrado": bool(fila["telefono"]),
            "verificado": bool(fila["telefono_verificado"]),
            "terminacion": str(fila["telefono"])[-4:] if fila["telefono"] else None,  # nunca el número completo
        },
        "zona_horaria": ZONA_HORARIA,
    }


def guardar_preferencias(db: Session, id_usuario: int, clases: List[str]) -> List[str]:
    limpias = []
    for clase in clases:
        if clase not in CLASES_VALIDAS:
            raise ErrorNotificacion("Clase de gasto no válida: " + str(clase)[:30], "INVALID_CLASS", 422)
        if clase not in limpias:
            limpias.append(clase)
    db.execute(text("UPDATE usuarios SET notif_clases = :clases WHERE id_usuario = :id_usuario;"), {"clases": ",".join(limpias), "id_usuario": id_usuario})
    db.commit()
    programar_sincronizacion_total(id_usuario)  # los eventos de clases desactivadas se quitan del calendario
    return limpias


# =========================================================
# TELEGRAM: VINCULAR, ACTIVAR, DESACTIVAR, DESVINCULAR
# =========================================================
def crear_enlace_telegram(db: Session, id_usuario: int) -> dict:
    if not telegram_disponible():
        raise ErrorNotificacion("Telegram no está habilitado en este servidor.", "TELEGRAM_UNAVAILABLE", 503)
    fila = _fila_usuario(db, id_usuario)
    if not fila:
        raise ErrorNotificacion("Usuario no encontrado", "USER_NOT_FOUND", 404)
    codigo = crear_codigo_vinculo(id_usuario, fila["telegram_chat_id"])
    return {"url": "https://t.me/" + TELEGRAM_BOT_USUARIO + "?start=" + codigo, "expira_minutos": VINCULO_TELEGRAM_MINUTOS}


def vincular_telegram(db: Session, chat_id: int, codigo: str) -> Tuple[bool, str, bool]:
    # Lo llama el BOT cuando alguien pulsa "Iniciar" con un código. Devuelve (éxito, mensaje para el chat, ¿pedir el número?).
    if not registrar_intento("vinculo-chat:" + str(chat_id), 10, 600):
        return False, "Demasiados intentos. Espera unos minutos.", False
    leido = leer_codigo_vinculo(codigo)
    if not leido:
        return False, "El enlace no es válido. Genera uno nuevo desde SYNCPAGO (Recordatorios).", False
    id_usuario, vence, cuerpo, firma = leido
    if vence < int(datetime.now(timezone.utc).timestamp()):
        return False, "El enlace venció. Genera uno nuevo desde SYNCPAGO (Recordatorios).", False
    fila = _fila_usuario(db, id_usuario)
    # La firma incluye el chat actual del usuario: si ya se usó este enlace, el chat cambió y no coincide
    if not fila or not firma_valida(cuerpo, firma, fila["telegram_chat_id"]):
        return False, "El enlace no es válido o ya fue usado. Genera uno nuevo desde SYNCPAGO (Recordatorios).", False
    otro = db.execute(text("SELECT 1 FROM usuarios WHERE telegram_chat_id = :chat AND id_usuario <> :id_usuario LIMIT 1;"), {"chat": chat_id, "id_usuario": id_usuario}).fetchone()
    if otro:
        return False, "Esta cuenta de Telegram ya está vinculada a otro usuario de SYNCPAGO. Desvincúlala allí primero.", False
    db.execute(text("UPDATE usuarios SET telegram_chat_id = :chat, telegram_activo = TRUE WHERE id_usuario = :id_usuario;"), {"chat": chat_id, "id_usuario": id_usuario})
    db.commit()
    registrar_evento("TELEGRAM_VINCULADO", id_usuario=id_usuario, detalle="Cuenta de Telegram vinculada")
    # Si el teléfono aún no está verificado, el bot pide compartir el contacto para comprobarlo (opcional)
    return True, "Listo, " + str(fila["nombre"]).split(" ")[0] + ": tu Telegram quedó vinculado a SYNCPAGO y recibirás tus recordatorios aquí.\n\nSi no fuiste tú, escribe /detener.", not fila["telefono_verificado"]


def _ultimos_10(telefono) -> str:
    digitos = "".join(c for c in str(telefono or "") if c.isdigit())
    return digitos[-10:]


def procesar_contacto_telegram(db: Session, chat_id: int, telefono: str) -> Tuple[str, Optional[str]]:
    # Lo llama el BOT cuando alguien comparte SU contacto (Telegram garantiza que el número es el de esa cuenta).
    # Devuelve (mensaje, token). El token solo existe en el flujo del REGISTRO (la cuenta aún no existe).
    telefono = _ultimos_10(telefono)
    if len(telefono) != 10:
        return "No pude leer un número de teléfono válido.", None
    fila = db.execute(text("SELECT id_usuario, telefono FROM usuarios WHERE telegram_chat_id = :chat LIMIT 1;"), {"chat": chat_id}).fetchone()
    if not fila:
        # Registro en curso: el token firmado liga ese número con esta cuenta de Telegram
        token = crear_token("verificar_telegram", {"telefono": telefono, "chat_id": chat_id}, minutos=VINCULO_TELEGRAM_MINUTOS)
        return "Número comprobado. Copia este token y pégalo en SYNCPAGO (vale " + str(VINCULO_TELEGRAM_MINUTOS) + " minutos):", token
    usuario = dict(fila._mapping)
    if usuario["telefono"] and _ultimos_10(usuario["telefono"]) != telefono:
        return "Ese número no coincide con el teléfono de tu cuenta de SYNCPAGO.", None
    if not usuario["telefono"]:
        repetido = db.execute(text("SELECT 1 FROM usuarios WHERE telefono = :telefono AND id_usuario <> :id_usuario LIMIT 1;"), {"telefono": telefono, "id_usuario": usuario["id_usuario"]}).fetchone()
        if repetido:
            return "Ese número ya está registrado en otra cuenta de SYNCPAGO.", None
    db.execute(text("UPDATE usuarios SET telefono = :telefono, telefono_verificado = TRUE WHERE id_usuario = :id_usuario;"), {"telefono": telefono, "id_usuario": usuario["id_usuario"]})
    db.commit()
    registrar_evento("TELEFONO_VERIFICADO", id_usuario=usuario["id_usuario"], detalle="Verificado con Telegram")
    return "Número verificado ✓. Ya aparece como verificado en SYNCPAGO.", None


def cambiar_activo_telegram(db: Session, id_usuario: int, activo: bool) -> None:
    fila = _fila_usuario(db, id_usuario)
    if not fila or fila["telegram_chat_id"] is None:
        raise ErrorNotificacion("Primero vincula tu cuenta de Telegram.", "TELEGRAM_NOT_LINKED", 400)
    db.execute(text("UPDATE usuarios SET telegram_activo = :activo WHERE id_usuario = :id_usuario;"), {"activo": activo, "id_usuario": id_usuario})
    db.commit()


def desvincular_telegram(db: Session, id_usuario: int) -> None:
    db.execute(text("UPDATE usuarios SET telegram_chat_id = NULL, telegram_activo = FALSE WHERE id_usuario = :id_usuario;"), {"id_usuario": id_usuario})
    db.commit()
    registrar_evento("TELEGRAM_DESVINCULADO", id_usuario=id_usuario, detalle="Cuenta de Telegram desvinculada")


def desactivar_telegram_por_chat(db: Session, chat_id: int) -> bool:
    # Lo usa el comando /detener del bot: apaga los avisos de quien escribe, sin desvincular
    resultado = db.execute(text("UPDATE usuarios SET telegram_activo = FALSE WHERE telegram_chat_id = :chat;"), {"chat": chat_id})
    db.commit()
    return resultado.rowcount > 0


def enviar_prueba_telegram(db: Session, id_usuario: int) -> None:
    fila = _fila_usuario(db, id_usuario)
    if not fila or fila["telegram_chat_id"] is None:
        raise ErrorNotificacion("Primero vincula tu cuenta de Telegram.", "TELEGRAM_NOT_LINKED", 400)
    try:
        enviar_mensaje(fila["telegram_chat_id"], "Mensaje de prueba de SYNCPAGO: tus recordatorios llegarán aquí.")
    except TelegramBloqueado:
        desvincular_telegram(db, id_usuario)
        raise ErrorNotificacion("Telegram no permite escribirte (bloqueaste el bot). Vuelve a vincular tu cuenta.", "TELEGRAM_BLOCKED", 409)
    except Exception:
        raise ErrorNotificacion("No se pudo contactar a Telegram. Intenta de nuevo.", "TELEGRAM_FAILED", 502)


# ----------------------------------------------------------------------------
# AVISOS POR TELEGRAM (los ejecuta el planificador cada minuto)
# ----------------------------------------------------------------------------
def _texto_recordatorio(fila: dict, ahora: datetime) -> str:
    faltan = int((fila["fecha_vencimiento"] - ahora).total_seconds() // 60)
    if faltan >= 120:
        cuando = "en " + str(faltan // 60) + " h"
    elif faltan >= 1:
        cuando = "en " + str(faltan) + " min"
    else:
        cuando = "ahora"
    return "\n".join([
        "Recordatorio de pago - SYNCPAGO",
        str(fila["detalle"]) + " (" + str(fila["clase"]) + ")",
        "Valor: $" + "{:,.0f}".format(float(fila["precio"])),
        "Vence: " + fila["fecha_vencimiento"].strftime("%d/%m/%Y %H:%M") + " (" + cuando + ")",
    ])


def enviar_recordatorios_telegram(db: Session, ahora: Optional[datetime] = None) -> int:
    ahora = ahora or _ahora_local()
    # Hora del aviso = vencimiento - tiempo_antelacion. Se avisa si ya llegó esa hora, el gasto sigue pendiente
    # y todavía no vence, y NO se avisó ya para ese mismo instante (si se edita el gasto, el instante cambia).
    # Solo se leen avisos del propio usuario dueño de cada gasto (tipo_gasto.id_usuario).
    filas = db.execute(text(
        "SELECT r.id_recordatorio, u.id_usuario, u.telegram_chat_id, tg.detalle, tg.clase, g.fecha_vencimiento, g.precio, "
        "       (g.fecha_vencimiento - (r.tiempo_antelacion * INTERVAL '1 minute')) AS fecha_notificacion "
        "FROM recordatorio r "
        "INNER JOIN gasto g ON r.id_gasto = g.id_gasto "
        "INNER JOIN tipo_gasto tg ON g.id_tipo = tg.id_tipo "
        "INNER JOIN usuarios u ON tg.id_usuario = u.id_usuario "
        "WHERE g.estado = 'pendiente' AND u.telegram_activo = TRUE AND u.telegram_chat_id IS NOT NULL "
        "AND POSITION(',' || tg.clase || ',' IN ',' || u.notif_clases || ',') > 0 "
        "AND (g.fecha_vencimiento - (r.tiempo_antelacion * INTERVAL '1 minute')) <= :ahora "
        "AND g.fecha_vencimiento > :ahora "
        "AND r.telegram_notificado_para IS DISTINCT FROM (g.fecha_vencimiento - (r.tiempo_antelacion * INTERVAL '1 minute')) "
        "ORDER BY fecha_notificacion ASC LIMIT 200;"
    ), {"ahora": ahora})
    pendientes = [dict(f._mapping) for f in filas]
    enviados = 0
    for fila in pendientes:
        try:
            enviar_mensaje(fila["telegram_chat_id"], _texto_recordatorio(fila, ahora))
        except TelegramBloqueado:
            # El usuario bloqueó el bot: se apaga y desvincula para no insistir
            db.execute(text("UPDATE usuarios SET telegram_activo = FALSE, telegram_chat_id = NULL WHERE id_usuario = :id_usuario;"), {"id_usuario": fila["id_usuario"]})
            db.commit()
            continue
        except Exception as error:
            print("Telegram: no se pudo enviar un recordatorio:", type(error).__name__)  # se reintenta en el siguiente minuto
            continue
        db.execute(text("UPDATE recordatorio SET telegram_notificado_para = :para WHERE id_recordatorio = :id;"), {"para": fila["fecha_notificacion"], "id": fila["id_recordatorio"]})
        db.commit()
        enviados += 1
    return enviados


# =========================================================
# GOOGLE CALENDAR: CONECTAR Y DESCONECTAR
# =========================================================
def iniciar_conexion_google(id_usuario: int) -> dict:
    if not GOOGLE_ACTIVO:
        raise ErrorNotificacion("Google Calendar no está configurado en este servidor.", "GOOGLE_UNAVAILABLE", 503)
    # "state" es un JWT de 10 minutos firmado con SECRET_KEY: liga la respuesta de Google a ESTE usuario
    estado = crear_token("google_estado", {"uid": id_usuario, "jti": generar_jti()}, minutos=10)
    return {"url": google.url_autorizacion(estado)}


def completar_conexion_google(db: Session, codigo: str, estado: str) -> int:
    datos = validar_token(estado, "google_estado")
    if not datos or not marcar_usado("google:" + str(datos.get("jti")), 600):
        raise ErrorNotificacion("La conexión venció o no es válida. Inténtalo de nuevo.", "GOOGLE_STATE_INVALID", 400)
    id_usuario = int(datos["uid"])
    fila = _fila_usuario(db, id_usuario)
    if not fila:
        raise ErrorNotificacion("Usuario no encontrado", "USER_NOT_FOUND", 404)
    try:
        tokens = google.intercambiar_codigo(codigo)
    except google.GoogleError:
        raise ErrorNotificacion("Google rechazó la autorización. Inténtalo de nuevo.", "GOOGLE_CODE_REJECTED", 400)
    refresco = tokens.get("refresh_token")
    if not refresco:
        raise ErrorNotificacion("Google no entregó un permiso permanente. Revoca SYNCPAGO en tu cuenta de Google e inténtalo otra vez.", "GOOGLE_NO_REFRESH", 400)
    # Se reutiliza el calendario SYNCPAGO anterior si el usuario ya lo tenía; si no, se crea uno nuevo
    calendario_id = fila["google_calendario_id"] or google.crear_calendario(tokens["access_token"])
    db.execute(text("UPDATE usuarios SET google_refresh_token = :token, google_calendario_id = :cal WHERE id_usuario = :id_usuario;"), {"token": cifrar_texto(refresco), "cal": calendario_id, "id_usuario": id_usuario})
    db.commit()
    registrar_evento("GOOGLE_CONECTADO", id_usuario=id_usuario, detalle="Google Calendar conectado")
    google.olvidar_acceso(id_usuario)
    programar_sincronizacion_total(id_usuario)  # sube los gastos que ya existían
    return id_usuario


def _limpiar_conexion_google(db: Session, id_usuario: int) -> None:
    db.execute(text("UPDATE usuarios SET google_refresh_token = NULL, google_calendario_id = NULL WHERE id_usuario = :id_usuario;"), {"id_usuario": id_usuario})
    db.commit()
    google.olvidar_acceso(id_usuario)


def desconectar_google(db: Session, id_usuario: int) -> None:
    fila = _fila_usuario(db, id_usuario)
    refresco = descifrar_texto(fila["google_refresh_token"]) if fila else None
    if refresco:
        try:
            if fila["google_calendario_id"]:
                # Se borra SOLO el calendario "SYNCPAGO" que creó la aplicación (y con él sus eventos)
                google.borrar_calendario(google.token_de_acceso(id_usuario, refresco), fila["google_calendario_id"])
        except Exception as error:
            print("Google Calendar: no se pudo borrar el calendario al desconectar:", type(error).__name__)
        google.revocar(refresco)
    _limpiar_conexion_google(db, id_usuario)
    registrar_evento("GOOGLE_DESCONECTADO", id_usuario=id_usuario, detalle="Google Calendar desconectado")


# =========================================================
# GOOGLE CALENDAR: SINCRONIZAR GASTOS <-> EVENTOS
# =========================================================
# Relación gasto -> evento: el ID del evento se DERIVA del id_gasto (ver google_calendar.id_evento).
# Por eso "crear", "editar" y "reprogramar" son la misma operación (guardar) y nunca duplican,
# y para borrar basta con el id del gasto. Pagado o cancelado -> el evento se borra.
def _credenciales_google(db: Session, fila: dict) -> Optional[Tuple[str, str]]:
    refresco = descifrar_texto(fila["google_refresh_token"])
    if not refresco:
        return None  # no conectado (o la clave de cifrado cambió)
    try:
        acceso = google.token_de_acceso(fila["id_usuario"], refresco)
    except google.GoogleSinAcceso:
        # El usuario revocó el permiso desde Google: se limpia aquí y el panel pedirá reconectar
        _limpiar_conexion_google(db, fila["id_usuario"])
        return None
    calendario_id = fila["google_calendario_id"]
    if not calendario_id:
        calendario_id = google.crear_calendario(acceso)
        db.execute(text("UPDATE usuarios SET google_calendario_id = :cal WHERE id_usuario = :id_usuario;"), {"cal": calendario_id, "id_usuario": fila["id_usuario"]})
        db.commit()
    return acceso, calendario_id


def _datos_gasto(db: Session, id_gasto: int) -> Optional[dict]:
    fila = db.execute(text(
        "SELECT g.id_gasto, g.fecha_vencimiento, g.precio, g.estado, tg.detalle, tg.clase, tg.id_usuario, "
        "COALESCE((SELECT r.tiempo_antelacion FROM recordatorio r WHERE r.id_gasto = g.id_gasto ORDER BY r.id_recordatorio DESC LIMIT 1), 120) AS tiempo_antelacion "
        "FROM gasto g INNER JOIN tipo_gasto tg ON g.id_tipo = tg.id_tipo WHERE g.id_gasto = :id_gasto;"
    ), {"id_gasto": id_gasto}).fetchone()
    return dict(fila._mapping) if fila else None


def sincronizar_gasto(db: Session, id_gasto: int) -> None:
    gasto = _datos_gasto(db, id_gasto)
    if not gasto:
        return
    usuario = _fila_usuario(db, gasto["id_usuario"])  # el calendario es el del DUEÑO del gasto
    if not usuario or not usuario["google_refresh_token"]:
        return
    credenciales = _credenciales_google(db, usuario)
    if not credenciales:
        return
    acceso, calendario_id = credenciales
    evento = google.id_evento(id_gasto)
    quiere_evento = gasto["estado"] in ("pendiente", "vencido") and gasto["clase"] in _clases_a_lista(usuario["notif_clases"])
    if not quiere_evento:
        google.borrar_evento(acceso, calendario_id, evento)
        return
    cuerpo = google.cuerpo_evento(id_gasto, gasto["detalle"], gasto["clase"], gasto["precio"], gasto["fecha_vencimiento"], gasto["tiempo_antelacion"], gasto["estado"])
    try:
        google.guardar_evento(acceso, calendario_id, evento, cuerpo)
    except google.GoogleCalendarioNoExiste:
        # El usuario borró el calendario SYNCPAGO en Google: se crea uno nuevo y se reintenta una vez
        db.execute(text("UPDATE usuarios SET google_calendario_id = NULL WHERE id_usuario = :id_usuario;"), {"id_usuario": usuario["id_usuario"]})
        db.commit()
        usuario["google_calendario_id"] = None
        acceso, calendario_id = _credenciales_google(db, usuario)
        google.guardar_evento(acceso, calendario_id, evento, cuerpo)


def quitar_evento(db: Session, id_usuario: int, id_gasto: int) -> None:
    # Se usa cuando el gasto se elimina: el evento se identifica solo con el id del gasto
    usuario = _fila_usuario(db, id_usuario)
    if not usuario or not usuario["google_refresh_token"]:
        return
    credenciales = _credenciales_google(db, usuario)
    if credenciales:
        google.borrar_evento(credenciales[0], credenciales[1], google.id_evento(id_gasto))


def sincronizar_todo(db: Session, id_usuario: int) -> int:
    # Reconcilia los gastos recientes y futuros del usuario con su calendario (conectar, cambiar clases, botón "Sincronizar")
    usuario = _fila_usuario(db, id_usuario)
    if not usuario or not usuario["google_refresh_token"]:
        return 0
    desde = _ahora_local() - timedelta(days=7)
    ids = [f[0] for f in db.execute(text(
        "SELECT g.id_gasto FROM gasto g INNER JOIN tipo_gasto tg ON g.id_tipo = tg.id_tipo "
        "WHERE tg.id_usuario = :id_usuario AND g.fecha_vencimiento >= :desde ORDER BY g.fecha_vencimiento ASC LIMIT 300;"
    ), {"id_usuario": id_usuario, "desde": desde})]
    for id_gasto in ids:
        sincronizar_gasto(db, id_gasto)
    return len(ids)


# ----------------------------------------------------------------------------
# EJECUCIÓN EN SEGUNDO PLANO: guardar un gasto no debe esperar a Google ni fallar si Google falla
# ----------------------------------------------------------------------------
def _en_segundo_plano(funcion, *argumentos) -> None:
    def tarea():
        from app.config.database import SessionLocal
        db = SessionLocal()  # sesión propia: la de la petición ya se cerró
        try:
            funcion(db, *argumentos)
        except Exception as error:
            print("Google Calendar: error al sincronizar:", type(error).__name__, str(error)[:120])
        finally:
            db.close()
    threading.Thread(target=tarea, daemon=True).start()


def programar_sincronizacion_gasto(id_gasto: int) -> None:
    _en_segundo_plano(sincronizar_gasto, id_gasto)


def programar_quitar_evento(id_usuario: int, id_gasto: int) -> None:
    _en_segundo_plano(quitar_evento, id_usuario, id_gasto)


def programar_sincronizacion_total(id_usuario: int) -> None:
    _en_segundo_plano(sincronizar_todo, id_usuario)
