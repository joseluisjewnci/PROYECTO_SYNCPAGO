from datetime import datetime, timedelta  # CREADA - RETENCION
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config.database import engine, Base, SessionLocal
import app.models

from app.routes.gasto_route import router as gasto_router
from app.routes.usuario_routes import router as usuario_router
from app.routes.recordatorio_routes import router as recordatorio_router
from app.routes.finanzas_routes import router as finanzas_router
from app.routes.trazabilidad_routes import router as trazabilidad_router
from app.routes.tipo_gasto_routes import router as tipo_gasto_router
from app.routes.notificaciones_routes import router as notificaciones_router
from app.routes.seguridad_routes import router as seguridad_router
from app.utils.auditoria import ip_cliente
from app.controllers.gasto_controller import marcar_gastos_vencidos
from app.controllers.notificacion_controller import enviar_recordatorios_telegram
from app.controllers.mantenimiento_controller import ejecutar_mantenimiento  # CREADA - RETENCION
from app.utils.telegram_bot import iniciar_bot_telegram
from app.config.settings import ENTORNO, CORS_ORIGINS, CREAR_TABLAS, IP_DESDE_PROXY, TELEGRAM_ACTIVO

try:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    print("Conexión exitosa a PostgreSQL")
    if CREAR_TABLAS:
        Base.metadata.create_all(bind=engine)
    # Verificación de solo lectura: ¿ya se ejecutó Database/09_SEGURIDAD_COLUMNAS.sql?
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT sesion_id, intentos_fallidos, bloqueado_hasta FROM usuarios LIMIT 0"))
    except Exception:
        print("FALTAN COLUMNAS DE SEGURIDAD: ejecuta Database/09_SEGURIDAD_COLUMNAS.sql en PostgreSQL (haz pg_dump antes)")
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT telegram_chat_id, telefono_verificado, telegram_activo, notif_clases, google_refresh_token, google_calendario_id FROM usuarios LIMIT 0"))
            connection.execute(text("SELECT telegram_notificado_para FROM recordatorio LIMIT 0"))
    except Exception:
        print("FALTAN COLUMNAS DE NOTIFICACIONES: ejecuta Database/10_NOTIFICACIONES_COLUMNAS.sql en PostgreSQL (haz pg_dump antes)")
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT id_evento, id_usuario, correo, tipo, exito, detalle, ip, fecha FROM eventos_seguridad LIMIT 0"))
    except Exception:
        print("FALTA LA TABLA DE AUDITORÍA: ejecuta Database/11_AUDITORIA_EVENTOS.sql en PostgreSQL (haz pg_dump antes). Mientras tanto la app funciona, pero no guarda eventos de seguridad.")
    # Verificación de solo lectura: ¿ya se ejecutó Database/12_INACTIVIDAD_Y_PURGA.sql? # CREADA - RETENCION
    try: # CREADA - RETENCION
        with engine.connect() as connection: # CREADA - RETENCION
            connection.execute(text("SELECT ultimo_login, aviso_inactividad_enviado FROM usuarios LIMIT 0")) # CREADA - RETENCION
    except Exception: # CREADA - RETENCION
        print("FALTAN COLUMNAS DE INACTIVIDAD: ejecuta Database/12_INACTIVIDAD_Y_PURGA.sql en PostgreSQL (haz pg_dump antes). Sin ellas el inicio de sesión falla.") # CREADA - RETENCION
except Exception as error:
    print(f"Error de conexión con PostgreSQL: {error}")
    raise

app = FastAPI(
    title="API Control de Gastos (SYNCPAGO)",
    description="API para gestión de usuarios y gastos",
    version="1.0.0",
    docs_url=None if ENTORNO == "produccion" else "/docs",
    redoc_url=None if ENTORNO == "produccion" else "/redoc",
    openapi_url=None if ENTORNO == "produccion" else "/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

@app.middleware("http")
async def cabeceras_seguridad(request: Request, call_next):
    # Guarda la IP de quien llama para la auditoría (se lee con ip_cliente.get() en utils/auditoria.py)
    ip = request.client.host if request.client else None
    if IP_DESDE_PROXY and request.headers.get("x-forwarded-for"):
        ip = request.headers["x-forwarded-for"].split(",")[-1].strip()
    ip_cliente.set(ip)
    respuesta = await call_next(request)
    respuesta.headers["X-Content-Type-Options"] = "nosniff"
    respuesta.headers["X-Frame-Options"] = "DENY"
    respuesta.headers["Referrer-Policy"] = "no-referrer"
    respuesta.headers["Cache-Control"] = "no-store"
    if ENTORNO == "produccion":
        respuesta.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return respuesta

API_PREFIX = "/api/v1"

app.include_router(usuario_router, prefix=API_PREFIX)
app.include_router(gasto_router, prefix=API_PREFIX)
app.include_router(recordatorio_router, prefix=API_PREFIX)
app.include_router(finanzas_router, prefix=API_PREFIX)
app.include_router(trazabilidad_router, prefix=API_PREFIX)
app.include_router(tipo_gasto_router, prefix=API_PREFIX)
app.include_router(notificaciones_router, prefix=API_PREFIX)
app.include_router(seguridad_router, prefix=API_PREFIX)

iniciar_bot_telegram()


# =========================================================
# TAREA PROGRAMADA: MARCAR GASTOS VENCIDOS AUTOMÁTICAMENTE
# =========================================================
# Se protege con try/except a propósito: si la librería APScheduler
# no está instalada (por ejemplo, no hay internet en el equipo donde
# se expone), el backend debe seguir arrancando con TODO lo demás
# funcionando normalmente, solo sin esta automatización puntual.
#
# INTERVALO_MINUTOS: se deja corto (15) para poder DEMOSTRARLO en vivo
# durante la sustentación. Para producción real, súbelo por ejemplo a
# 720 (cada 12 horas) una vez pasada la entrega.
INTERVALO_MINUTOS = 15

try:
    from apscheduler.schedulers.background import BackgroundScheduler

    def tarea_marcar_vencidos():
        db = SessionLocal()
        try:
            marcar_gastos_vencidos(db)
            print("Tarea programada: gastos vencidos actualizados")
        except Exception as error:
            print(f"Error en la tarea de gastos vencidos: {error}")
        finally:
            db.close()

    def tarea_recordatorios_telegram():
        db = SessionLocal()
        try:
            enviar_recordatorios_telegram(db)
        except Exception as error:
            print("Error en la tarea de recordatorios por Telegram:", type(error).__name__)
        finally:
            db.close()

    def tarea_mantenimiento():  # CREADA - RETENCION
        db = SessionLocal()
        try:
            ejecutar_mantenimiento(db)
        except Exception as error:
            print("Error en la tarea de mantenimiento:", type(error).__name__)
        finally:
            db.close()

    scheduler = BackgroundScheduler()
    scheduler.add_job(
        tarea_marcar_vencidos,
        "interval",
        minutes=INTERVALO_MINUTOS,
        misfire_grace_time=3600,  # tolera hasta 1 hora de retraso antes de saltarse la ejecución
    )
    if TELEGRAM_ACTIVO:
        scheduler.add_job(tarea_recordatorios_telegram, "interval", minutes=1, max_instances=1, coalesce=True)
    # Mantenimiento (avisos de inactividad, eliminación y purga de eventos). Es idempotente: cada 6 horas y 1 minuto después de arrancar, # CREADA - RETENCION
    # así, si el servidor estuvo dormido, se recupera lo pendiente. # CREADA - RETENCION
    scheduler.add_job(tarea_mantenimiento, "interval", hours=6, next_run_time=datetime.now() + timedelta(minutes=1), max_instances=1, coalesce=True, misfire_grace_time=3600)  # CREADA - RETENCION
    scheduler.start()
    print(f"Tarea programada activa: gastos vencidos cada {INTERVALO_MINUTOS} minutos")
except ImportError:
    print(
        "APScheduler no está instalado — la actualización automática de "
        "vencidos queda deshabilitada, pero el resto de la API funciona con normalidad. "
        "Instala con: pip install apscheduler"
    )
