# =========================================================
# AUTENTICACIÓN DE CADA PETICIÓN (protección de rutas)
# =========================================================
# Toda ruta privada exige el encabezado:   Authorization: Bearer <token>
# El token solo vale si se cumplen DOS cosas:
#   1) la firma es correcta, no venció y es un token de "acceso"; y
#   2) el identificador de sesión (sid) que lleva coincide con el guardado en la BD para ese usuario.
# Al cerrar sesión (o iniciar sesión en otro lugar) el sid de la BD cambia o se borra,
# y el token anterior deja de funcionar de inmediato.
import hmac

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.utils.security import hash_sesion_id
from app.utils.tokens import validar_token

_esquema = HTTPBearer(auto_error=False)


def _no_autorizado(detalle: str) -> HTTPException:
    return HTTPException(status_code=401, detail=detalle, headers={"WWW-Authenticate": "Bearer"})


def get_sesion_actual(
    credenciales: HTTPAuthorizationCredentials = Depends(_esquema),
    db: Session = Depends(get_db),
) -> dict:
    # Devuelve {"usuario": {...}, "token": {contenido del JWT}} o responde 401
    if credenciales is None or credenciales.scheme.lower() != "bearer":
        raise _no_autorizado("Falta el token de acceso")

    datos = validar_token(credenciales.credentials, "acceso")
    if not datos or not isinstance(datos.get("uid"), int) or not isinstance(datos.get("sid"), str):
        raise _no_autorizado("Sesión no válida o expirada")

    fila = db.execute(
        text("SELECT id_usuario, nombre, correo, telefono, fecha_registro, sesion_id FROM usuarios WHERE id_usuario = :id_usuario;"),
        {"id_usuario": datos["uid"]},
    ).fetchone()
    if not fila:
        raise _no_autorizado("Sesión no válida o expirada")

    usuario = dict(fila._mapping)
    sesion_guardada = usuario.pop("sesion_id")
    if not sesion_guardada or not hmac.compare_digest(sesion_guardada, hash_sesion_id(datos["sid"])):
        raise _no_autorizado("La sesión fue cerrada o se inició en otro lugar")

    return {"usuario": usuario, "token": datos}


def get_usuario_actual(sesion: dict = Depends(get_sesion_actual)) -> dict:
    # Es lo que usan las rutas con Depends(get_usuario_actual)
    return sesion["usuario"]


def es_propietario(usuario_actual: dict, id_usuario: int) -> bool:
    # True solo si el id pedido es el del usuario autenticado
    return usuario_actual["id_usuario"] == id_usuario
