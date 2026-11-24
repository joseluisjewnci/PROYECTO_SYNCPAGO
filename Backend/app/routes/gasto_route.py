from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.config.database import get_db
from app.utils.auth import get_usuario_actual, es_propietario

# Importación de los controladores (Se incluyó la función que faltaba)
from app.controllers.gasto_controller import (
    obtener_gastos_usuario,
    obtener_detalles_todos_gastos,
    crear_gasto,
    actualizar_estado_gasto,
    actualizar_gasto,
    eliminar_gasto,
    marcar_gastos_vencidos,
    obtener_gastos_usuario_por_clase,
    tipo_es_del_usuario,
    gasto_es_del_usuario
)
from app.controllers.usuario_controller import obtener_usuario
from app.controllers.notificacion_controller import programar_sincronizacion_gasto, programar_quitar_evento
from app.utils.response import response_success, response_error, response_error_servidor

router = APIRouter(
    prefix="/gastos",
    tags=["Gastos"], 
    dependencies=[Depends(get_usuario_actual)]
)

# Función auxiliar para parsear fechas de forma flexible (acepta con o sin hora)
def parsear_fecha(fecha_str: str) -> datetime:
    if not fecha_str:
        return None
    try:
        return datetime.strptime(fecha_str, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return datetime.strptime(fecha_str, "%Y-%m-%d")


# 1. LISTAR GASTOS DE UN USUARIO (SELECT 3)
@router.get("/usuario/{id_usuario}")
def listar_gastos_usuario(id_usuario: int, db: Session = Depends(get_db), usuario_actual: dict = Depends(get_usuario_actual)):
    try:
        if not es_propietario(usuario_actual, id_usuario):
            return response_error(mensaje="No tienes permiso para acceder a los datos de otro usuario", error="FORBIDDEN", code=403)
        usuario = obtener_usuario(db, id_usuario)
        if not usuario:
            return response_error(
                mensaje="El usuario no existe",
                error="USUARIO_NOT_FOUND",
                code=404
            )
        gastos = obtener_gastos_usuario(db, id_usuario)
        return response_success(
            mensaje="Gastos e información del usuario encontrados",
            data={"usuario": usuario, "gastos": gastos},
            code=200
        )
    except Exception as error:
        return response_error_servidor("Error al consultar los gastos del usuario", error)

# 2. OBTENER DETALLE DE TODOS LOS GASTOS GLOBALES (SELECT 2)
@router.get("/detalles")
def listar_detalles_todos_gastos(db: Session = Depends(get_db), usuario_actual: dict = Depends(get_usuario_actual)):
    try:
        detalles = obtener_detalles_todos_gastos(db, usuario_actual["id_usuario"])
        return response_success(
            mensaje="Listado detallado de todos los gastos obtenido con éxito",
            data=detalles,
            code=200
        )
    except Exception as error:
        return response_error_servidor("Error al listar los detalles de los gastos", error)

# 3. CREAR NUEVO GASTO (INSERT 4)
@router.post("/")
def registrar_gasto(
    id_tipo: int,
    fecha_vencimiento: str,  # Acepta '2026-09-01' o '2026-09-01 18:00:00'
    precio: float,
    estado: str = "pendiente",
    db: Session = Depends(get_db),usuario_actual: dict = Depends(get_usuario_actual)
):
    try:
        if not tipo_es_del_usuario(db, id_tipo, usuario_actual["id_usuario"]):
            return response_error(mensaje="La categoría no existe", error="TIPO_NOT_FOUND", code=404)
        fecha_dt = parsear_fecha(fecha_vencimiento)
        nuevo = crear_gasto(db, id_tipo, fecha_dt, precio, estado)
        if nuevo and nuevo.get("id_gasto"):
            programar_sincronizacion_gasto(nuevo["id_gasto"])  # crea el evento si Google Calendar está conectado
        return response_success(
            mensaje="Gasto registrado con éxito. Recordatorio y trazabilidad creados por trigger.",
            data=nuevo,
            code=201
        )
    except Exception as error:
        return response_error_servidor("Error al crear el gasto", error)

# 4. ACTUALIZAR ESTADO DE GASTO (UPDATE 5)
@router.patch("/{id_gasto}/estado")
def cambiar_estado_gasto(id_gasto: int, estado: str, db: Session = Depends(get_db), usuario_actual: dict = Depends(get_usuario_actual)):
    try:
        if not gasto_es_del_usuario(db, id_gasto, usuario_actual["id_usuario"]):
            return response_error(mensaje="Gasto no encontrado", error="GASTO_NOT_FOUND", code=404)
        actualizado = actualizar_estado_gasto(db, id_gasto, estado)
        if actualizado:
            programar_sincronizacion_gasto(id_gasto)  # pagado o cancelado quita el evento; pendiente lo deja
        if not actualizado:
            return response_error(
                mensaje="Gasto no encontrado",
                error="GASTO_NOT_FOUND",
                code=404
            )
        return response_success(
            mensaje="Estado del gasto actualizado con éxito",
            data=actualizado,
            code=200
        )
    except Exception as error:
        return response_error_servidor("Error al actualizar el estado del gasto", error)

# 5. EDITAR UN GASTO
@router.patch("/{id_gasto}")
def editar_gasto(
    id_gasto: int,
    id_tipo: int = None,
    fecha_vencimiento: str = None,
    precio: float = None,
    db: Session = Depends(get_db),usuario_actual: dict = Depends(get_usuario_actual)
):
    try:
        if not gasto_es_del_usuario(db, id_gasto, usuario_actual["id_usuario"]):
            return response_error(mensaje="Gasto no encontrado", error="GASTO_NOT_FOUND", code=404)
        if id_tipo is not None and not tipo_es_del_usuario(db, id_tipo, usuario_actual["id_usuario"]):
            return response_error(mensaje="La categoría no existe", error="TIPO_NOT_FOUND", code=404)
        fecha_dt = parsear_fecha(fecha_vencimiento) if fecha_vencimiento else None
        actualizado = actualizar_gasto(db, id_gasto, id_tipo, fecha_dt, precio)
        if actualizado:
            programar_sincronizacion_gasto(id_gasto)  # actualiza el MISMO evento (no duplica)
        if not actualizado:
            return response_error(
                mensaje="Gasto no encontrado",
                error="GASTO_NOT_FOUND",
                code=404
            )
        return response_success(
            mensaje="Gasto actualizado con éxito",
            data=actualizado,
            code=200
        )
    except Exception as error:
        return response_error_servidor("Error al editar el gasto", error)

# 6. ELIMINAR GASTO (DELETE 6)
@router.delete("/{id_gasto}")
def borrar_gasto(id_gasto: int, db: Session = Depends(get_db), usuario_actual: dict = Depends(get_usuario_actual)):
    try:
        if not gasto_es_del_usuario(db, id_gasto, usuario_actual["id_usuario"]):
            return response_error(mensaje="Gasto no encontrado", error="GASTO_NOT_FOUND", code=404)
        eliminar_gasto(db, id_gasto)
        programar_quitar_evento(usuario_actual["id_usuario"], id_gasto)  # borra el evento asociado
        return response_success(
            mensaje="Gasto eliminado con éxito",
            data={"id_gasto_eliminado": id_gasto},
            code=200
        )
    except Exception as error:
        return response_error_servidor("Error al eliminar el gasto", error)

# 7. MARCAR MANUALMENTE LOS GASTOS VENCIDOS
@router.post("/actualizar-vencidos")
def actualizar_vencidos_manual(db: Session = Depends(get_db)):
    try:
        marcar_gastos_vencidos(db)
        return response_success(
            mensaje="Gastos vencidos actualizados con éxito",
            data=None,
            code=200
        )
    except Exception as error:
        return response_error_servidor("Error al actualizar los gastos vencidos", error)

# 8. FILTRAR Y RESUMIR GASTOS POR CLASE
@router.get("/usuario/{id_usuario}/clase/{clase}")
def filtrar_gastos_por_clase(id_usuario: int, clase: str, db: Session = Depends(get_db), usuario_actual: dict = Depends(get_usuario_actual)):
    if not es_propietario(usuario_actual, id_usuario):
        return response_error(mensaje="No tienes permiso para acceder a los datos de otro usuario", error="FORBIDDEN", code=403)
    clase_clean = clase.strip().lower()

    clases_permitidas = ["vital", "varios", "entretenimiento"]
    if clase_clean not in clases_permitidas:
        return response_error(
            mensaje=f"La clase '{clase}' no es válida. Las clases permitidas son: {', '.join(clases_permitidas)}",
            error="INVALID_CLASS_TYPE",
            code=400
        )

    try:
        usuario = obtener_usuario(db, id_usuario)
        if not usuario:
            return response_error(
                mensaje="El usuario no existe",
                error="USUARIO_NOT_FOUND",
                code=404
            )

        resumen = obtener_gastos_usuario_por_clase(db, id_usuario, clase_clean)

        return response_success(
            mensaje=f"Resumen y gastos de la clase '{clase_clean}' obtenidos exitosamente",
            data={
                "usuario": {
                    "id_usuario": usuario["id_usuario"],
                    "nombre": usuario["nombre"],
                    "correo": usuario["correo"]
                },
                "clase": resumen["clase"],
                "total_recibos": resumen["total_recibos"],
                "monto_acumulado": resumen["monto_acumulado"],
                "gastos": resumen["gastos"]
            },
            code=200
        )
    except Exception as error:
        return response_error_servidor(f"Error al filtrar los gastos por la clase '{clase}'", error)
