import os

from dotenv import load_dotenv


load_dotenv()


DATABASE_URL = os.getenv(
    "DATABASE_URL"
)


if not DATABASE_URL:
    raise ValueError(
        "Falta la variable DATABASE_URL"
    )


# ========================================================= # CREADA - HASH
# SEGURIDAD: JWT, CORREO Y TELEGRAM (se leen del archivo .env) # CREADA - HASH
# ========================================================= # CREADA - HASH
SECRET_KEY = os.getenv("SECRET_KEY", "") # CREADA - HASH
if len(SECRET_KEY) < 32: # CREADA - HASH
    raise ValueError("Falta SECRET_KEY en el .env (mínimo 32 caracteres)") # CREADA - HASH

JWT_ALGORITHM = "HS256" # CREADA - HASH
TOKEN_MINUTOS = int(os.getenv("TOKEN_MINUTOS", "30")) # CREADA - HASH

# smtp = envía correos reales | consola = los imprime en la consola (solo pruebas locales) # CREADA - HASH
EMAIL_MODO = os.getenv("EMAIL_MODO", "smtp").lower() # MODIFICADO - CORREO HTTPS
# brevo = envía por la API HTTPS de Brevo (puerto 443; funciona en Render gratis, que bloquea SMTP) # CREADA - CORREO HTTPS
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "") # CREADA - CORREO HTTPS
# Correo remitente (debe estar verificado en Brevo). Si está vacío se usa SMTP_USUARIO. # CREADA - CORREO HTTPS
EMAIL_REMITENTE = os.getenv("EMAIL_REMITENTE", "").strip() or os.getenv("SMTP_USUARIO", "").strip() # CREADA - CORREO HTTPS
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com") # CREADA - HASH
SMTP_PORT = int(os.getenv("SMTP_PORT", "465")) # CREADA - HASH
SMTP_USUARIO = os.getenv("SMTP_USUARIO", "") # CREADA - HASH
SMTP_CONTRASENA = os.getenv("SMTP_CONTRASENA", "") # CREADA - HASH

# true = el bot de Telegram arranca y los usuarios pueden vincular su cuenta (opcional) | false = Telegram apagado # MODIFICADO - TELEGRAM
TELEGRAM_ACTIVO = os.getenv("TELEGRAM_ACTIVO", "false").lower() == "true" # CREADA - HASH
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "") # CREADA - HASH
TELEGRAM_BOT_USUARIO = os.getenv("TELEGRAM_BOT_USUARIO", "").lstrip("@") # CREADA - HASH


# ========================================================= # CREADA - SEGURIDAD
# SESIÓN, BLOQUEO DE LOGIN Y CONFIGURACIÓN DE PRODUCCIÓN # CREADA - SEGURIDAD
# ========================================================= # CREADA - SEGURIDAD
ACCESS_TOKEN_MINUTOS = int(os.getenv("ACCESS_TOKEN_MINUTOS", "30")) # CREADA - SEGURIDAD
SESION_MAXIMA_HORAS = int(os.getenv("SESION_MAXIMA_HORAS", "8")) # CREADA - SEGURIDAD
MAX_INTENTOS_LOGIN = int(os.getenv("MAX_INTENTOS_LOGIN", "5")) # CREADA - SEGURIDAD
BLOQUEO_MINUTOS = int(os.getenv("BLOQUEO_MINUTOS", "15")) # CREADA - SEGURIDAD

# "desarrollo" o "produccion". En producción se desactiva /docs y se exigen ajustes seguros. # CREADA - SEGURIDAD
ENTORNO = os.getenv("ENTORNO", "desarrollo").lower() # CREADA - SEGURIDAD

# Orígenes del frontend autorizados por CORS (separados por coma) # CREADA - SEGURIDAD
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()] # CREADA - SEGURIDAD

# false = el backend NO crea tablas al arrancar (no toca la estructura de PostgreSQL) # CREADA - SEGURIDAD
CREAR_TABLAS = os.getenv("CREAR_TABLAS", "false").lower() == "true" # CREADA - SEGURIDAD

if EMAIL_MODO not in ("smtp", "brevo", "consola"): # CREADA - CORREO HTTPS
    raise ValueError("EMAIL_MODO debe ser smtp, brevo o consola") # CREADA - CORREO HTTPS
if EMAIL_MODO == "brevo" and (not BREVO_API_KEY or not EMAIL_REMITENTE): # CREADA - CORREO HTTPS
    raise ValueError("EMAIL_MODO=brevo requiere BREVO_API_KEY y EMAIL_REMITENTE en el entorno") # CREADA - CORREO HTTPS
if ENTORNO == "produccion" and EMAIL_MODO == "consola": # CREADA - SEGURIDAD
    raise ValueError("En producción EMAIL_MODO no puede ser 'consola' (imprimiría los tokens en el log)") # CREADA - SEGURIDAD


# ========================================================= # CREADA - SEGURIDAD
# CÓDIGOS DE VERIFICACIÓN DE 6 DÍGITOS Y CORREO # CREADA - SEGURIDAD
# ========================================================= # CREADA - SEGURIDAD
CODIGO_MINUTOS = int(os.getenv("CODIGO_MINUTOS", "5")) # CREADA - SEGURIDAD (vida del código)
CODIGO_MAX_INTENTOS = int(os.getenv("CODIGO_MAX_INTENTOS", "5")) # CREADA - SEGURIDAD (intentos por código)
EMAIL_REMITENTE_NOMBRE = os.getenv("EMAIL_REMITENTE_NOMBRE", "SYNCPAGO") # CREADA - SEGURIDAD

# ========================================================= # CREADA - TELEGRAM
# TELEGRAM OPCIONAL Y ZONA HORARIA DE LOS RECORDATORIOS # CREADA - TELEGRAM
# ========================================================= # CREADA - TELEGRAM
VINCULO_TELEGRAM_MINUTOS = int(os.getenv("VINCULO_TELEGRAM_MINUTOS", "10")) # CREADA - TELEGRAM
# Si el backend está detrás de un proxy o balanceador de confianza, la IP real viene en X-Forwarded-For (se toma la última, la que agrega ese proxy). # CREADA - SEGURIDAD
IP_DESDE_PROXY = os.getenv("IP_DESDE_PROXY", "false").strip().lower() == "true" # CREADA - SEGURIDAD
ZONA_HORARIA = os.getenv("ZONA_HORARIA", "America/Bogota") # CREADA - TELEGRAM (las fechas de la BD no llevan zona: se interpretan en esta)
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/") # CREADA - TELEGRAM

# =========================================================
# GOOGLE CALENDAR OPCIONAL (OAuth 2.0)
# =========================================================
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://127.0.0.1:8000/api/v1/notificaciones/google/callback").strip()
GOOGLE_ACTIVO = bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)
# Clave para cifrar el refresh token de Google en la BD. Si no se define, se deriva de SECRET_KEY.
CLAVE_CIFRADO = os.getenv("CLAVE_CIFRADO", "")

# =========================================================
# INACTIVIDAD DE CUENTAS, EVENTOS DE SEGURIDAD Y MANTENIMIENTO AUTOMÁTICO # CREADA - RETENCION
# =========================================================
# Días sin iniciar sesión para considerar inactiva una cuenta (se le envía un aviso al correo registrado) # CREADA - RETENCION
INACTIVIDAD_DIAS = int(os.getenv("INACTIVIDAD_DIAS", "90")) # CREADA - RETENCION
# Días adicionales, contados desde el aviso, para volver a iniciar sesión antes de eliminar la cuenta # CREADA - RETENCION
INACTIVIDAD_GRACIA_DIAS = int(os.getenv("INACTIVIDAD_GRACIA_DIAS", "15")) # CREADA - RETENCION
# Días que se conservan los eventos de seguridad desde su creación # CREADA - RETENCION
EVENTOS_RETENCION_DIAS = int(os.getenv("EVENTOS_RETENCION_DIAS", "90")) # CREADA - RETENCION
# true = el mantenimiento solo cuenta y escribe en la consola: NO envía avisos, NO elimina nada # CREADA - RETENCION
MANTENIMIENTO_SIMULACION = os.getenv("MANTENIMIENTO_SIMULACION", "false").strip().lower() == "true" # CREADA - RETENCION
# Máximo de cuentas que se avisan o eliminan en cada ejecución (freno de seguridad) # CREADA - RETENCION
MANTENIMIENTO_LOTE = int(os.getenv("MANTENIMIENTO_LOTE", "50")) # CREADA - RETENCION
if INACTIVIDAD_DIAS < 1 or INACTIVIDAD_GRACIA_DIAS < 1 or EVENTOS_RETENCION_DIAS < 1 or MANTENIMIENTO_LOTE < 1: # CREADA - RETENCION
    raise ValueError("INACTIVIDAD_DIAS, INACTIVIDAD_GRACIA_DIAS, EVENTOS_RETENCION_DIAS y MANTENIMIENTO_LOTE deben ser mayores que 0") # CREADA - RETENCION
