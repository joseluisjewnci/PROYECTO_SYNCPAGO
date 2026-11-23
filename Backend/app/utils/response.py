
from typing import Any, Optional

from datetime import date, datetime, time

from decimal import Decimal

from fastapi.responses import JSONResponse


# =========================================================
# CONVERTIR DATOS A FORMATO JSON
# =========================================================

def convertir_json(data: Any):

    # -----------------------------------------------------
    # DICCIONARIO
    # -----------------------------------------------------

    if isinstance(data, dict):

        return {
            key: convertir_json(value)
            for key, value in data.items()
        }

    # -----------------------------------------------------
    # LISTA / TUPLA
    # -----------------------------------------------------

    if isinstance(data, (list, tuple)):

        return [
            convertir_json(item)
            for item in data
        ]

    # -----------------------------------------------------
    # FECHA Y HORA
    # -----------------------------------------------------

    if isinstance(
        data,
        (datetime, date, time)
    ):

        return data.isoformat()

    # -----------------------------------------------------
    # DECIMAL / NUMERIC DE POSTGRESQL
    # -----------------------------------------------------

    if isinstance(data, Decimal):

        return float(data)

    # -----------------------------------------------------
    # OTROS TIPOS
    # -----------------------------------------------------

    return data


# =========================================================
# RESPUESTA EXITOSA
# =========================================================

def response_success(

    mensaje: str,

    data: Any = None,

    code: int = 200

):

    return JSONResponse(

        status_code=code,

        content={

            "status": True,

            "mensaje": mensaje,

            "data": convertir_json(data),

            "error": None,

            "code": code

        }

    )


# =========================================================
# RESPUESTA DE ERROR
# =========================================================

def response_error(

    mensaje: str,

    error: Optional[str] = None,

    code: int = 400,

    data: Any = None

):

    return JSONResponse(

        status_code=code,

        content={

            "status": False,

            "mensaje": mensaje,

            "data": convertir_json(data),

            "error": error,

            "code": code

        }

    )


# =========================================================
# RESPUESTA DE ERROR INTERNO (no filtra detalles al cliente)
# =========================================================
def response_error_servidor(mensaje: str, error: Optional[Exception] = None):
    # El detalle técnico va solo a la consola del servidor, NUNCA a la respuesta
    if error is not None:
        lineas = str(getattr(error, "orig", error)).splitlines()
        print("ERROR INTERNO:", type(error).__name__, lineas[0][:200] if lineas else "")
    return response_error(mensaje=mensaje, error="INTERNAL_ERROR", code=500)

