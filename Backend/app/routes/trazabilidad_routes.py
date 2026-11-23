from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.config.database import get_db
from app.utils.auth import get_usuario_actual
from app.controllers.gasto_controller import gasto_es_del_usuario
from app.controllers.trazabilidad_controller import obtener_historial_gasto
from app.utils.response import response_success, response_error, response_error_servidor

router = APIRouter(
    prefix="/trazabilidad",
    tags=["Trazabilidad"], 
    dependencies=[Depends(get_usuario_actual)] 
)

@router.get("/gasto/{id_gasto}")
def consultar_historial(id_gasto: int, db: Session = Depends(get_db), usuario_actual: dict = Depends(get_usuario_actual)):
    try:
        if not gasto_es_del_usuario(db, id_gasto, usuario_actual["id_usuario"]):
            return response_error(mensaje="Gasto no encontrado", error="GASTO_NOT_FOUND", code=404)
        historial = obtener_historial_gasto(db, id_gasto)
        return response_success(
            mensaje="Historial de cambios (trazabilidad) del gasto obtenido",
            data=historial,
            code=200
        )
    except Exception as error:
        return response_error_servidor("Error al consultar el historial del gasto", error)
