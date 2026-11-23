from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.settings import FRONTEND_URL
from app.controllers.notificacion_controller import (
    ErrorNotificacion,
    obtener_estado,
    guardar_preferencias,
    crear_enlace_telegram,
    cambiar_activo_telegram,
    desvincular_telegram,
    enviar_prueba_telegram,
    iniciar_conexion_google,
    completar_conexion_google,
    desconectar_google,
    programar_sincronizacion_total,
)
from app.schemas.notificacion_schema import PreferenciasEntrada
from app.utils.auth import get_usuario_actual
from app.utils.response import response_success, response_error, response_error_servidor

# Todas las rutas (salvo el retorno de Google) exigen sesión y trabajan SOLO con el usuario de la sesión.
router = APIRouter(
    prefix="/notificaciones",
    tags=["Notificaciones"]
)


def _error(error: ErrorNotificacion):
    return response_error(mensaje=error.mensaje, error=error.error, code=error.code)


@router.get("/estado")
def estado_notificaciones(db: Session = Depends(get_db), usuario_actual: dict = Depends(get_usuario_actual)):
    try:
        return response_success(mensaje="Estado de notificaciones", data=obtener_estado(db, usuario_actual["id_usuario"]), code=200)
    except ErrorNotificacion as error:
        return _error(error)
    except Exception as error:
        return response_error_servidor("Error al consultar las notificaciones", error)


@router.put("/preferencias")
def actualizar_preferencias(datos: PreferenciasEntrada, db: Session = Depends(get_db), usuario_actual: dict = Depends(get_usuario_actual)):
    try:
        clases = guardar_preferencias(db, usuario_actual["id_usuario"], datos.clases)
        return response_success(mensaje="Preferencias guardadas", data={"clases": clases}, code=200)
    except ErrorNotificacion as error:
        return _error(error)
    except Exception as error:
        return response_error_servidor("Error al guardar las preferencias", error)


# ------------------------------------------------------------------ Telegram
@router.post("/telegram/vincular")
def vincular_telegram_usuario(db: Session = Depends(get_db), usuario_actual: dict = Depends(get_usuario_actual)):
    try:
        return response_success(mensaje="Abre el enlace en Telegram y pulsa Iniciar", data=crear_enlace_telegram(db, usuario_actual["id_usuario"]), code=200)
    except ErrorNotificacion as error:
        return _error(error)
    except Exception as error:
        return response_error_servidor("No se pudo generar el enlace de Telegram", error)


@router.post("/telegram/activar")
def activar_telegram(db: Session = Depends(get_db), usuario_actual: dict = Depends(get_usuario_actual)):
    try:
        cambiar_activo_telegram(db, usuario_actual["id_usuario"], True)
        return response_success(mensaje="Avisos por Telegram activados", data=None, code=200)
    except ErrorNotificacion as error:
        return _error(error)
    except Exception as error:
        return response_error_servidor("No se pudo activar Telegram", error)


@router.post("/telegram/desactivar")
def desactivar_telegram(db: Session = Depends(get_db), usuario_actual: dict = Depends(get_usuario_actual)):
    try:
        cambiar_activo_telegram(db, usuario_actual["id_usuario"], False)
        return response_success(mensaje="Avisos por Telegram desactivados", data=None, code=200)
    except ErrorNotificacion as error:
        return _error(error)
    except Exception as error:
        return response_error_servidor("No se pudo desactivar Telegram", error)


@router.post("/telegram/probar")
def probar_telegram(db: Session = Depends(get_db), usuario_actual: dict = Depends(get_usuario_actual)):
    try:
        enviar_prueba_telegram(db, usuario_actual["id_usuario"])
        return response_success(mensaje="Te enviamos un mensaje de prueba", data=None, code=200)
    except ErrorNotificacion as error:
        return _error(error)
    except Exception as error:
        return response_error_servidor("No se pudo enviar el mensaje de prueba", error)


@router.delete("/telegram")
def desvincular_telegram_usuario(db: Session = Depends(get_db), usuario_actual: dict = Depends(get_usuario_actual)):
    try:
        desvincular_telegram(db, usuario_actual["id_usuario"])
        return response_success(mensaje="Telegram desvinculado", data=None, code=200)
    except Exception as error:
        return response_error_servidor("No se pudo desvincular Telegram", error)


# ------------------------------------------------------------------ Google Calendar
@router.post("/google/iniciar")
def iniciar_google(usuario_actual: dict = Depends(get_usuario_actual)):
    try:
        return response_success(mensaje="Autoriza el acceso en Google", data=iniciar_conexion_google(usuario_actual["id_usuario"]), code=200)
    except ErrorNotificacion as error:
        return _error(error)
    except Exception as error:
        return response_error_servidor("No se pudo iniciar la conexión con Google", error)


@router.get("/google/callback")
def retorno_google(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db)
):
    # Aquí vuelve el NAVEGADOR desde Google (no lleva el token de sesión): la identidad sale del "state" firmado.
    destino = FRONTEND_URL + "/recordatorios"
    if error or not code or not state:
        return RedirectResponse(destino + "?google=cancelado", status_code=303)
    try:
        completar_conexion_google(db, code, state)
        return RedirectResponse(destino + "?google=ok", status_code=303)
    except ErrorNotificacion as fallo:
        print("Google Calendar: conexión rechazada:", fallo.error)
    except Exception as fallo:
        print("Google Calendar: error al conectar:", type(fallo).__name__)
    return RedirectResponse(destino + "?google=error", status_code=303)


@router.post("/google/sincronizar")
def sincronizar_google(usuario_actual: dict = Depends(get_usuario_actual)):
    programar_sincronizacion_total(usuario_actual["id_usuario"])
    return response_success(mensaje="Sincronización iniciada", data=None, code=202)


@router.delete("/google")
def desconectar_google_usuario(db: Session = Depends(get_db), usuario_actual: dict = Depends(get_usuario_actual)):
    try:
        desconectar_google(db, usuario_actual["id_usuario"])
        return response_success(mensaje="Google Calendar desconectado", data=None, code=200)
    except Exception as error:
        return response_error_servidor("No se pudo desconectar Google Calendar", error)
