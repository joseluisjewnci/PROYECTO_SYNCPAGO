import hashlib
import hmac
import threading
import time
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session
from app.config.settings import ACCESS_TOKEN_MINUTOS, BLOQUEO_MINUTOS, CODIGO_MAX_INTENTOS, CODIGO_MINUTOS, MAX_INTENTOS_LOGIN, SECRET_KEY, SESION_MAXIMA_HORAS
from app.utils.email_service import enviar_correo, plantilla_codigo
from app.utils.rate_limit import permitir, liberar, registrar_intento, marcar_usado
from app.utils.tokens import crear_token, validar_token, generar_codigo, generar_jti, huella_codigo, codigo_coincide
from app.config.settings import TELEGRAM_BOT_USUARIO
from app.controllers.notificacion_controller import telegram_disponible
from app.utils.auditoria import registrar_evento
from app.utils.security import cifrar_contrasena, verificar_contrasena, generar_sesion_id, hash_sesion_id

# Hash de una contraseña inventada: hace que el login tarde lo mismo cuando el correo NO existe
_HASH_FALSO = cifrar_contrasena("contrasena-inventada-solo-para-igualar-tiempos")

# =========================================================
# OBTENER TODOS LOS USUARIOS
# =========================================================
def obtener_todos_usuarios(db: Session):
    sql = text("""
        SELECT id_usuario, nombre, correo, telefono, fecha_registro 
        FROM usuarios 
        ORDER BY id_usuario ASC;
    """)

    resultado = db.execute(sql)

    return [dict(row._mapping) for row in resultado]


# =========================================================
# OBTENER UN USUARIO POR ID
# =========================================================
def obtener_usuario(db: Session, id_usuario: int):
    sql = text("""
        SELECT id_usuario, nombre, correo, telefono, fecha_registro 
        FROM usuarios 
        WHERE id_usuario = :id_usuario;
    """)

    resultado = db.execute(sql, {"id_usuario": id_usuario})
    fila = resultado.fetchone()

    if fila:
        return dict(fila._mapping)

    return None


# =========================================================
# OBTENER UN USUARIO POR CORREO
# Se obtiene la contraseña para poder compararla
# =========================================================
def obtener_usuario_por_correo(db: Session, correo: str):
    sql = text("""
        SELECT id_usuario, nombre, correo, contrasena, telefono, fecha_registro, -- MODIFICADO - SEGURIDAD
               intentos_fallidos, -- CREADA - SEGURIDAD
               COALESCE(CAST(CEIL(EXTRACT(EPOCH FROM (bloqueado_hasta - LOCALTIMESTAMP)) / 60) AS INTEGER), 0) AS minutos_bloqueo -- CREADA - SEGURIDAD
        FROM usuarios 
        WHERE LOWER(correo) = :correo -- MODIFICADO - CORREO MINUSCULAS
        ORDER BY id_usuario -- CREADA - CORREO MINUSCULAS
        LIMIT 1 /* CREADA - CORREO MINUSCULAS */
    """)

    resultado = db.execute(sql, {"correo": (correo or "").strip().lower()})
    fila = resultado.fetchone()

    if fila:
        return dict(fila._mapping)

    return None


# =========================================================
# REGISTRAR UN NUEVO USUARIO
# Recibe la contraseña YA preparada por _preparar_contrasena() (hash Argon2id).
# Solo se llama después de verificar los tokens (ver confirmar_registro).
# =========================================================
def registrar_nuevo_usuario(
    db: Session,
    nombre: str,
    correo: str,
    contrasena: str,
    telefono: str = None
):
    sql = text("""
        INSERT INTO usuarios (nombre, correo, contrasena, telefono)
        VALUES (:nombre, :correo, :contrasena, :telefono)
        RETURNING id_usuario, nombre, correo, telefono, fecha_registro;
    """)

    resultado = db.execute(sql, {
        "nombre": nombre,
        "correo": (correo or "").strip().lower(),
        "contrasena": contrasena,
        "telefono": telefono
    })

    db.commit()

    usuario_creado = resultado.fetchone()

    if usuario_creado:
        return dict(usuario_creado._mapping)

    return None


# =========================================================
# AUTENTICAR / LOGIN DE USUARIO
# Verificación contra el hash guardado. Para DESACTIVAR el hash (modo exposición),
# comentar la línea marcada "COMENTAR PARA DESACTIVAR EL HASH".
# =========================================================
def autenticar_usuario(db: Session, correo: str, contrasena: str):
    correo = (correo or "").strip().lower()

    usuario = obtener_usuario_por_correo(db, correo)

    if not usuario:
        verificar_contrasena(_HASH_FALSO, contrasena)  # mismo tiempo que con un usuario real
        registrar_evento("LOGIN_FALLIDO", correo=correo if "@" in correo else None, exito=False, detalle="Correo no registrado", limite_clave="login-desconocido")
        return None

    if usuario["minutos_bloqueo"] > 0:
        registrar_evento("LOGIN_BLOQUEADO", id_usuario=usuario["id_usuario"], correo=correo, exito=False, detalle="Intento con la cuenta bloqueada", limite_clave="login-bloqueado:" + str(usuario["id_usuario"]), limite_segundos=60)
        raise ErrorVerificacion("Demasiados intentos fallidos. Intenta de nuevo en " + str(usuario["minutos_bloqueo"]) + " minuto(s).", "ACCOUNT_LOCKED", 429)

    contrasena_correcta = usuario["contrasena"] == contrasena
    contrasena_correcta = verificar_contrasena(usuario["contrasena"], contrasena)

    if not contrasena_correcta:
        bloqueada = _registrar_intento_fallido(db, usuario["id_usuario"])
        registrar_evento("LOGIN_FALLIDO", id_usuario=usuario["id_usuario"], correo=correo, exito=False, detalle="Contraseña incorrecta")
        if bloqueada:
            registrar_evento("CUENTA_BLOQUEADA", id_usuario=usuario["id_usuario"], correo=correo, exito=False, detalle="Bloqueo por " + str(MAX_INTENTOS_LOGIN) + " intentos fallidos")
        return None

    # No enviamos la contraseña al frontend
    usuario.pop("contrasena", None)
    usuario.pop("intentos_fallidos", None)
    usuario.pop("minutos_bloqueo", None)

    return usuario


# =========================================================
# VERIFICACIÓN POR CÓDIGO DE 6 DÍGITOS: REGISTRO EN 2 PASOS Y RECUPERACIÓN
# =========================================================
class ErrorVerificacion(Exception):
    # Error controlado: lleva el mensaje, un código de error y el código HTTP para la respuesta
    def __init__(self, mensaje: str, error: str, code: int = 400):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.error = error
        self.code = code


def _preparar_contrasena(contrasena: str) -> str:
    # ÚNICO lugar donde se hashea una contraseña nueva (registro y recuperación).
    contrasena_a_guardar = contrasena  # comportamiento original, sin hash
    contrasena_a_guardar = cifrar_contrasena(contrasena)
    return contrasena_a_guardar


def _huella_contrasena(contrasena_guardada: str) -> str:
    # Huella (HMAC con la SECRET_KEY) de la contraseña guardada. Entra en la huella del código de
    # recuperación: cuando la contraseña cambia, la huella cambia y el código deja de servir (uso único).
    return hmac.new(SECRET_KEY.encode("utf-8"), contrasena_guardada.encode("utf-8"), hashlib.sha256).hexdigest()[:16]


def _enviar_codigo_por_correo(destino: str, asunto: str, titulo: str, introduccion: str, codigo: str) -> None:
    texto, pagina = plantilla_codigo(titulo, introduccion, codigo, CODIGO_MINUTOS)
    enviar_correo(destino, asunto, texto, pagina)


def _enviar_codigo_en_segundo_plano(destino: str, asunto: str, titulo: str, introduccion: str, codigo: str, clave_limite: str) -> None:
    # Se envía en un hilo aparte para que la respuesta tarde lo mismo exista o no el correo
    def tarea():
        try:
            _enviar_codigo_por_correo(destino, asunto, titulo, introduccion, codigo)
        except Exception as error:
            print("No se pudo enviar el correo de recuperación:", type(error).__name__, str(error)[:150])
            liberar(clave_limite)
    threading.Thread(target=tarea, daemon=True).start()


def _contar_intento_codigo(jti: str) -> None:
    # Cada sobre admite CODIGO_MAX_INTENTOS intentos: después hay que pedir un código nuevo
    if not registrar_intento("codigo:" + jti, CODIGO_MAX_INTENTOS, CODIGO_MINUTOS * 60):
        raise ErrorVerificacion("Demasiados intentos con este código. Solicita uno nuevo.", "CODE_ATTEMPTS_EXCEEDED", 429)


def _exigir_un_solo_uso(jti: str) -> None:
    if not marcar_usado("usado:" + jti, CODIGO_MINUTOS * 60):
        raise ErrorVerificacion("Este código ya fue usado. Solicita uno nuevo.", "CODE_ALREADY_USED", 400)


# ---------------------------------------------------------
# REGISTRO, PASO 1: validar datos y enviar el código al correo (NO inserta nada)
# ---------------------------------------------------------
def iniciar_registro(db: Session, nombre: str, correo: str, contrasena: str, telefono: Optional[str]):
    correo = (correo or "").strip().lower()
    if obtener_usuario_por_correo(db, correo):
        raise ErrorVerificacion("El correo electrónico ya se encuentra registrado", "EMAIL_ALREADY_EXISTS", 400)

    if telefono:
        existe = db.execute(text("SELECT 1 FROM usuarios WHERE telefono = :telefono LIMIT 1;"), {"telefono": telefono}).fetchone()
        if existe:
            raise ErrorVerificacion("El teléfono ya se encuentra registrado", "PHONE_ALREADY_EXISTS", 400)

    if not permitir("registro:" + correo, 60):
        raise ErrorVerificacion("Espera un minuto antes de pedir otro código.", "TOO_MANY_REQUESTS", 429)

    codigo = generar_codigo()
    jti = generar_jti()
    # El sobre lleva los datos del registro (con la contraseña YA hasheada) y la huella del código, no el código
    token_pendiente = crear_token("registro_pendiente", {
        "nombre": nombre,
        "correo": correo,
        "telefono": telefono,
        "contrasena": _preparar_contrasena(contrasena),
        "jti": jti,
        "ch": huella_codigo("registro", correo, codigo, jti),
    }, minutos=CODIGO_MINUTOS)

    try:
        _enviar_codigo_por_correo(correo, codigo + " es tu código de verificación de SYNCPAGO", "Verifica tu correo", "Usa este código para terminar tu registro en SYNCPAGO.", codigo)
    except Exception as error:
        print("No se pudo enviar el correo de verificación:", type(error).__name__, str(error)[:150])
        liberar("registro:" + correo)
        raise ErrorVerificacion("No se pudo enviar el correo. Intenta de nuevo más tarde.", "EMAIL_SEND_FAILED", 502)

    # Con teléfono (y Telegram habilitado) se pide además comprobar el número con el bot de Telegram
    requiere_telegram = bool(telefono and telegram_disponible())
    return {
        "token_pendiente": token_pendiente,
        "expira_minutos": CODIGO_MINUTOS,
        "requiere_telegram": requiere_telegram,
        "bot_url": ("https://t.me/" + TELEGRAM_BOT_USUARIO) if requiere_telegram else None,
    }


# ---------------------------------------------------------
# REGISTRO, PASO 2: verificar el código y SOLO entonces crear la cuenta
# ---------------------------------------------------------
def confirmar_registro(db: Session, token_pendiente: str, codigo: str, token_telegram: Optional[str] = None):
    pendiente = validar_token(token_pendiente, "registro_pendiente")
    if not pendiente or not pendiente.get("jti"):
        raise ErrorVerificacion("El código venció o el registro no es válido. Vuelve a llenar el formulario.", "REGISTRATION_EXPIRED", 400)

    _contar_intento_codigo(pendiente["jti"])
    if not codigo_coincide(pendiente.get("ch", ""), "registro", pendiente["correo"], codigo, pendiente["jti"]):
        registrar_evento("CODIGO_INVALIDO", correo=pendiente["correo"], exito=False, detalle="Código de registro incorrecto", limite_clave="codigo:" + pendiente["jti"])
        raise ErrorVerificacion("El código no es correcto.", "CODE_INVALID", 400)

    # Si dio teléfono, el token que entregó el bot debe ser de ESE número. Se revisa antes de gastar el código:
    # así, si falta o está mal, la persona puede corregirlo sin pedir otro código.
    chat_id = None
    if pendiente.get("telefono") and telegram_disponible():
        datos_tg = validar_token(token_telegram, "verificar_telegram")
        if not datos_tg or datos_tg.get("telefono") != pendiente["telefono"] or not datos_tg.get("chat_id"):
            raise ErrorVerificacion("Falta el token de Telegram o no corresponde a tu teléfono. Abre el bot, comparte tu número y pega el token.", "TELEGRAM_TOKEN_INVALID", 400)
        chat_id = int(datos_tg["chat_id"])
        if db.execute(text("SELECT 1 FROM usuarios WHERE telegram_chat_id = :chat LIMIT 1;"), {"chat": chat_id}).fetchone():
            raise ErrorVerificacion("Esa cuenta de Telegram ya está vinculada a otro usuario.", "TELEGRAM_ALREADY_LINKED", 400)
    _exigir_un_solo_uso(pendiente["jti"])
    if obtener_usuario_por_correo(db, pendiente["correo"]):
        raise ErrorVerificacion("El correo electrónico ya se encuentra registrado", "EMAIL_ALREADY_EXISTS", 400)

    usuario = registrar_nuevo_usuario(
        db=db,
        nombre=pendiente["nombre"],
        correo=pendiente["correo"],
        contrasena=pendiente["contrasena"],
        telefono=pendiente.get("telefono"),
    )
    if chat_id and usuario:
        # Número comprobado con Telegram: queda verificado y el Telegram vinculado y activo
        db.execute(text("UPDATE usuarios SET telegram_chat_id = :chat, telegram_activo = TRUE, telefono_verificado = TRUE WHERE id_usuario = :id_usuario;"), {"chat": chat_id, "id_usuario": usuario["id_usuario"]})
        db.commit()
        registrar_evento("TELEFONO_VERIFICADO", id_usuario=usuario["id_usuario"], correo=pendiente["correo"], detalle="Verificado con Telegram al registrarse")
    if usuario:
        registrar_evento("REGISTRO_CONFIRMADO", id_usuario=usuario["id_usuario"], correo=pendiente["correo"], detalle="Cuenta creada con correo verificado")
    return usuario


# ---------------------------------------------------------
# RECUPERACIÓN, PASO 1: enviar el código al correo (la respuesta es igual exista o no el correo)
# ---------------------------------------------------------
def solicitar_recuperacion(db: Session, correo: str) -> dict:
    correo = (correo or "").strip().lower()
    if not permitir("recuperar:" + correo, 60):
        raise ErrorVerificacion("Espera un minuto antes de pedir otro código.", "TOO_MANY_REQUESTS", 429)

    usuario = obtener_usuario_por_correo(db, correo)
    codigo = generar_codigo()
    jti = generar_jti()
    # Si el correo no existe se entrega igual un sobre con la misma forma (no se envía nada):
    # así no se puede averiguar qué correos están registrados.
    huella_clave = _huella_contrasena(usuario["contrasena"]) if usuario else ""
    sobre = crear_token("recuperacion_pendiente", {
        "correo": correo,
        "jti": jti,
        "ch": huella_codigo("recuperacion", correo, codigo, jti, huella_clave),
    }, minutos=CODIGO_MINUTOS)
    if usuario:
        registrar_evento("RECUPERACION_SOLICITADA", id_usuario=usuario["id_usuario"], correo=correo, detalle="Código de recuperación enviado")
        _enviar_codigo_en_segundo_plano(correo, codigo + " es tu código para recuperar tu contraseña de SYNCPAGO", "Recupera tu contraseña", "Usa este código para crear una contraseña nueva en SYNCPAGO.", codigo, "recuperar:" + correo)
    return {"token_recuperacion": sobre, "expira_minutos": CODIGO_MINUTOS}


# ---------------------------------------------------------
# RECUPERACIÓN, PASO 2: verificar el código y cambiar la contraseña de ESE usuario
# ---------------------------------------------------------
def confirmar_recuperacion(db: Session, token_recuperacion: str, codigo: str, contrasena_nueva: str) -> None:
    sobre = validar_token(token_recuperacion, "recuperacion_pendiente")
    if not sobre or not sobre.get("jti"):
        raise ErrorVerificacion("El código venció. Solicita uno nuevo.", "CODE_EXPIRED", 400)

    _contar_intento_codigo(sobre["jti"])
    correo = sobre["correo"]
    usuario = obtener_usuario_por_correo(db, correo)
    huella_clave = _huella_contrasena(usuario["contrasena"]) if usuario else ""
    # Si el usuario ya cambió la contraseña con este código, la huella es otra y el código no coincide (uso único)
    if not usuario or not codigo_coincide(sobre.get("ch", ""), "recuperacion", correo, codigo, sobre["jti"], huella_clave):
        registrar_evento("CODIGO_INVALIDO", id_usuario=usuario["id_usuario"] if usuario else None, correo=correo, exito=False, detalle="Código de recuperación incorrecto", limite_clave="codigo:" + sobre["jti"])
        raise ErrorVerificacion("El código no es correcto o ya fue usado.", "CODE_INVALID", 400)
    _exigir_un_solo_uso(sobre["jti"])

    # ÚNICO UPDATE del sistema: solo la contraseña de este usuario, y solo si no cambió mientras tanto
    resultado = db.execute(
        text("UPDATE usuarios SET contrasena = :nueva, sesion_id = NULL, intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id_usuario = :id_usuario AND contrasena = :actual;"),
        {"nueva": _preparar_contrasena(contrasena_nueva), "id_usuario": usuario["id_usuario"], "actual": usuario["contrasena"]},
    )
    db.commit()
    if resultado.rowcount != 1:
        raise ErrorVerificacion("El código ya fue usado o no es válido. Solicita uno nuevo.", "CODE_INVALID", 400)
    registrar_evento("CONTRASENA_CAMBIADA", id_usuario=usuario["id_usuario"], correo=correo, detalle="Contraseña cambiada con código de recuperación; sesión cerrada")


# =========================================================
# SESIÓN ÚNICA CON TOKEN DE ACCESO (JWT + identificador de sesión en la BD)
# =========================================================
def _registrar_intento_fallido(db: Session, id_usuario: int) -> bool:
    # Suma un intento fallido; al llegar al máximo bloquea el login y reinicia el contador (todo en un solo UPDATE)
    db.execute(
        text(
            "UPDATE usuarios "
            "SET intentos_fallidos = CASE WHEN intentos_fallidos + 1 >= :maximo THEN 0 ELSE intentos_fallidos + 1 END, "
            "bloqueado_hasta = CASE WHEN intentos_fallidos + 1 >= :maximo THEN LOCALTIMESTAMP + (:minutos * INTERVAL '1 minute') ELSE bloqueado_hasta END "
            "WHERE id_usuario = :id_usuario;"
        ),
        {"maximo": MAX_INTENTOS_LOGIN, "minutos": BLOQUEO_MINUTOS, "id_usuario": id_usuario},
    )
    db.commit()
    # Solo lectura: ¿este fallo fue el que activó el bloqueo? (sirve para dejar el evento en la auditoría)
    return db.execute(text("SELECT 1 FROM usuarios WHERE id_usuario = :id_usuario AND bloqueado_hasta > LOCALTIMESTAMP;"), {"id_usuario": id_usuario}).fetchone() is not None


def iniciar_sesion(db: Session, usuario: dict) -> dict:
    # Crea una sesión nueva: guarda el hash del sid (esto cierra cualquier sesión anterior del usuario),
    # reinicia el contador de intentos y entrega el token de acceso.
    sesion_id = generar_sesion_id()
    db.execute(
        text("UPDATE usuarios SET sesion_id = :sesion_hash, intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id_usuario = :id_usuario;"),
        {"sesion_hash": hash_sesion_id(sesion_id), "id_usuario": usuario["id_usuario"]},
    )
    db.commit()
    registrar_evento("LOGIN_OK", id_usuario=usuario["id_usuario"], correo=usuario.get("correo"), detalle="Sesión iniciada")
    token = crear_token(
        "acceso",
        {"uid": usuario["id_usuario"], "sid": sesion_id, "ini": int(time.time())},
        minutos=ACCESS_TOKEN_MINUTOS,
    )
    return {"usuario": usuario, "token": token, "expira_minutos": ACCESS_TOKEN_MINUTOS}


def cerrar_sesion(db: Session, id_usuario: int) -> None:
    # Borra el sid de la BD: el token que tenía el usuario deja de servir al instante
    db.execute(
        text("UPDATE usuarios SET sesion_id = NULL WHERE id_usuario = :id_usuario;"),
        {"id_usuario": id_usuario},
    )
    db.commit()
    registrar_evento("LOGOUT", id_usuario=id_usuario, detalle="Sesión cerrada")


def renovar_sesion(sesion: dict) -> dict:
    # Entrega un token nuevo con el MISMO sid mientras la sesión no supere su duración máxima absoluta
    datos = sesion["token"]
    inicio = datos.get("ini")
    if not isinstance(inicio, int) or time.time() - inicio > SESION_MAXIMA_HORAS * 3600:
        raise ErrorVerificacion("La sesión alcanzó su duración máxima. Inicia sesión de nuevo.", "SESSION_MAX_AGE", 401)
    token = crear_token(
        "acceso",
        {"uid": datos["uid"], "sid": datos["sid"], "ini": inicio},
        minutos=ACCESS_TOKEN_MINUTOS,
    )
    return {"token": token, "expira_minutos": ACCESS_TOKEN_MINUTOS}

