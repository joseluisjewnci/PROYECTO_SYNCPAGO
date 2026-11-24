from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers.auditoria_controller import listar_eventos
from app.utils.auth import get_usuario_actual
from app.utils.response import response_success, response_error_servidor

router = APIRouter(
    prefix="/seguridad",
    tags=["Seguridad"]
)


@router.get("/eventos")
def eventos_de_mi_cuenta(
    limite: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    usuario_actual: dict = Depends(get_usuario_actual),
):
    # Actividad reciente de LA CUENTA de la sesión: inicios de sesión, intentos fallidos, cambios de contraseña, vinculaciones
    try:
        return response_success(mensaje="Actividad de seguridad", data=listar_eventos(db, usuario_actual["id_usuario"], limite), code=200)
    except Exception as error:
        return response_error_servidor("Error al consultar la actividad de seguridad", error)

