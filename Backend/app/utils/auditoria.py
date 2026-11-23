# Registro de eventos de seguridad: quién hizo qué, cuándo y desde dónde.
# Reglas de diseño:
#  1) NUNCA guarda contraseñas, códigos ni tokens: solo el tipo de evento y una nota corta.
#  2) Usa su PROPIA sesión de base de datos: el evento se guarda aunque la operación que lo causó falle o haga rollback.
#  3) Nunca rompe la operación principal: si no se puede guardar, solo avisa en consola.
#  4) Los eventos que un atacante puede provocar sin límite se limitan con "limite_clave".
from contextvars import ContextVar
from typing import Optional

from sqlalchemy import text

from app.utils.rate_limit import permitir

# La IP de quien hace la petición: la fija main.py (middleware) y se lee aquí sin pasarla por todas las funciones.
ip_cliente: ContextVar = ContextVar("ip_cliente", default=None)

# Los únicos tipos permitidos (el frontend sabe mostrar cada uno). Un tipo mal escrito se ignora, no se guarda.
TIPOS = (
    "LOGIN_OK",
    "LOGIN_FALLIDO",
    "LOGIN_BLOQUEADO",
    "CUENTA_BLOQUEADA",
    "LOGOUT",
    "REGISTRO_CONFIRMADO",
    "CODIGO_INVALIDO",
    "RECUPERACION_SOLICITADA",
    "CONTRASENA_CAMBIADA",
    "TELEFONO_VERIFICADO",
    "TELEGRAM_VINCULADO",
    "TELEGRAM_DESVINCULADO",
    "GOOGLE_CONECTADO",
    "GOOGLE_DESCONECTADO",
)


def registrar_evento(
    tipo: str,
    id_usuario: Optional[int] = None,
    correo: Optional[str] = None,
    exito: bool = True,
    detalle: Optional[str] = None,
    limite_clave: Optional[str] = None,
    limite_segundos: int = 1,
) -> None:
    # limite_clave: si se indica, solo se guarda un evento con esa clave cada "limite_segundos"
    if tipo not in TIPOS:
        print("Auditoría: tipo de evento desconocido, no se guardó:", str(tipo)[:40])
        return
    if limite_clave is not None and not permitir("auditoria:" + limite_clave, limite_segundos):
        return
    try:
        from app.config.database import SessionLocal  # se importa aquí para evitar importaciones circulares

        db = SessionLocal()
        try:
            db.execute(
                text(
                    "INSERT INTO eventos_seguridad (id_usuario, correo, tipo, exito, detalle, ip) "
                    "VALUES (:id_usuario, :correo, :tipo, :exito, :detalle, :ip);"
                ),
                {
                    "id_usuario": id_usuario,
                    "correo": correo.strip().lower()[:255] if correo else None,
                    "tipo": tipo,
                    "exito": bool(exito),
                    "detalle": detalle[:200] if detalle else None,
                    "ip": (ip_cliente.get() or "")[:45] or None,
                },
            )
            db.commit()
        finally:
            db.close()
    except Exception as error:
        # Sin esto, un fallo de la auditoría tumbaría un inicio de sesión legítimo
        print("Auditoría: no se pudo guardar el evento", tipo, type(error).__name__)

