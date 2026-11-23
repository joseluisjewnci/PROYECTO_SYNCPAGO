# =========================================================
# ENVÍO DE CORREOS 
# =========================================================
# EMAIL_MODO=smtp    -> envía el correo de verdad (Gmail con contraseña de aplicación; puerto 465 o 587)
# EMAIL_MODO=consola -> NO envía nada: imprime el correo en la consola del backend.
#                       Solo para pruebas locales; en producción debe ser smtp.
import html
import json
import urllib.error
import urllib.request
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid

from app.config.settings import EMAIL_MODO, EMAIL_REMITENTE, EMAIL_REMITENTE_NOMBRE, BREVO_API_KEY, SMTP_HOST, SMTP_PORT, SMTP_USUARIO, SMTP_CONTRASENA # MODIFICADO - CORREO HTTPS

BREVO_URL = "https://api.brevo.com/v3/smtp/email"


def plantilla_codigo(titulo: str, introduccion: str, codigo: str, minutos: int) -> tuple:
    # Devuelve (texto_plano, html). Se envían las dos versiones: los filtros de spam
    # desconfían de los correos que solo traen HTML. Sin enlaces, sin imágenes y sin mayúsculas sostenidas.
    texto = "\n".join([
        titulo,
        "",
        introduccion,
        "",
        "Tu código es: " + codigo,
        "",
        "Es válido por " + str(minutos) + " minutos y solo se puede usar una vez.",
        "Si no fuiste tú, ignora este mensaje: nadie puede usar tu cuenta sin este código.",
        "",
        "SYNCPAGO - control de gastos personales",
    ])
    pagina = (
        '<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1f2937">'
        '<h2 style="margin:0 0 12px">' + html.escape(titulo) + '</h2>'
        '<p style="margin:0 0 16px">' + html.escape(introduccion) + '</p>'
        '<p style="font-size:32px;letter-spacing:8px;font-weight:bold;background:#f3f4f6;padding:16px;'
        'text-align:center;border-radius:8px;margin:0 0 16px">' + html.escape(codigo) + '</p>'
        '<p style="margin:0 0 8px">Es válido por ' + str(minutos) + ' minutos y solo se puede usar una vez.</p>'
        '<p style="margin:0;color:#6b7280;font-size:13px">Si no fuiste tú, ignora este mensaje: '
        'nadie puede usar tu cuenta sin este código.</p>'
        '</div>'
    )
    return texto, pagina


def _enviar_por_brevo(destino: str, asunto: str, cuerpo: str, cuerpo_html: str = None) -> None:
    # API HTTPS (puerto 443): Render gratis bloquea los puertos SMTP, esta vía no. Sin librerías nuevas.
    # Brevo pide UNO de htmlContent, textContent o templateId por petición: se envía el HTML si existe, si no el texto
    datos = {"sender": {"name": EMAIL_REMITENTE_NOMBRE, "email": EMAIL_REMITENTE}, "to": [{"email": destino}], "subject": asunto}
    if cuerpo_html:
        datos["htmlContent"] = cuerpo_html
    else:
        datos["textContent"] = cuerpo
    peticion = urllib.request.Request(BREVO_URL, data=json.dumps(datos).encode("utf-8"), method="POST", headers={"api-key": BREVO_API_KEY, "content-type": "application/json", "accept": "application/json"})
    try:
        with urllib.request.urlopen(peticion, timeout=15) as respuesta:
            if respuesta.status >= 300:
                raise RuntimeError("Brevo respondió " + str(respuesta.status))
    except urllib.error.HTTPError as error:
        # Solo el código HTTP: nunca la clave ni el cuerpo de la petición
        raise RuntimeError("Brevo rechazó el envío (HTTP " + str(error.code) + ")") from None


def enviar_correo(destino: str, asunto: str, cuerpo: str, cuerpo_html: str = None) -> None:
    if EMAIL_MODO == "consola":
        print("[CORREO SIMULADO] Para:", destino, "| Asunto:", asunto)
        print(cuerpo)
        return

    if EMAIL_MODO == "brevo":
        _enviar_por_brevo(destino, asunto, cuerpo, cuerpo_html)
        return

    if not SMTP_USUARIO or not SMTP_CONTRASENA:
        raise RuntimeError("SMTP no configurado (faltan SMTP_USUARIO o SMTP_CONTRASENA)")

    mensaje = EmailMessage()
    mensaje["From"] = formataddr((EMAIL_REMITENTE_NOMBRE, SMTP_USUARIO))
    mensaje["To"] = destino
    mensaje["Subject"] = asunto
    mensaje["Reply-To"] = SMTP_USUARIO
    mensaje["Date"] = formatdate(localtime=True)
    mensaje["Message-ID"] = make_msgid(domain=SMTP_USUARIO.split("@")[-1])
    # Avisan a otros sistemas que es un correo automático (no se debe responder con autorrespuestas)
    mensaje["Auto-Submitted"] = "auto-generated"
    mensaje["X-Auto-Response-Suppress"] = "All"
    mensaje.set_content(cuerpo)
    if cuerpo_html:
        mensaje.add_alternative(cuerpo_html, subtype="html")

    contexto = ssl.create_default_context()
    # Puerto 465: conexión cifrada desde el inicio (SSL). Puerto 587: conexión normal que se cifra con STARTTLS.
    if SMTP_PORT == 587:
        servidor = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15)
    else:
        servidor = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=contexto, timeout=15)
    with servidor:
        if SMTP_PORT == 587:
            servidor.starttls(context=contexto)
        servidor.login(SMTP_USUARIO, SMTP_CONTRASENA.replace(" ", ""))
        servidor.send_message(mensaje)
