from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.config.database import get_db
from app.utils.auth import get_usuario_actual, es_propietario
from app.controllers.finanzas_controller import (
    obtener_presupuesto_disponible,
    registrar_o_actualizar_finanzas
)
from app.utils.response import response_success, response_error, response_error_servidor

router = APIRouter(
    prefix="/finanzas",
    tags=["Finanzas"],
    dependencies=[Depends(get_usuario_actual)] 
)

@router.get("/usuario/{id_usuario}/presupuesto")
def consultar_presupuesto(id_usuario: int, db: Session = Depends(get_db), usuario_actual: dict = Depends(get_usuario_actual)):
    try:
        if not es_propietario(usuario_actual, id_usuario):
            return response_error(mensaje="No tienes permiso para acceder a los datos de otro usuario", error="FORBIDDEN", code=403)
        presupuesto = obtener_presupuesto_disponible(db, id_usuario)
        return response_success(
            mensaje="Presupuesto disponible por mes para el usuario",
            data=presupuesto,
            code=200
        )
    except Exception as error:
        return response_error_servidor("Error al consultar el presupuesto disponible", error)

# =========================================================
# REGISTRAR O ACTUALIZAR EL PRESUPUESTO / DINERO DEL MES
# =========================================================
@router.post("/")
def guardar_finanzas(
    id_usuario: int,
    entrada_dinero: float,
    presupuesto_gastos: float,
    fecha: str = None,  # 'YYYY-MM-DD', opcional (por defecto hoy)
    db: Session = Depends(get_db),usuario_actual: dict = Depends(get_usuario_actual)
):
    try:
        if not es_propietario(usuario_actual, id_usuario):
            return response_error(mensaje="No tienes permiso para acceder a los datos de otro usuario", error="FORBIDDEN", code=403)
        if entrada_dinero < 0 or presupuesto_gastos < 0:
            return response_error(mensaje="Los montos no pueden ser negativos", error="INVALID_AMOUNT", code=422)
        resultado = registrar_o_actualizar_finanzas(
            db, id_usuario, entrada_dinero, presupuesto_gastos, fecha
        )
        return response_success(
            mensaje="Presupuesto del mes guardado con éxito",
            data=resultado,
            code=201
        )
    except Exception as error:
        return response_error_servidor("Error al guardar el presupuesto", error)
