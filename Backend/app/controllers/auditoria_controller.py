from typing import List

from sqlalchemy import text
from sqlalchemy.orm import Session


def listar_eventos(db: Session, id_usuario: int, limite: int = 20) -> List[dict]:
    # Solo los eventos DE ESTE usuario, del más reciente al más antiguo
    limite = max(1, min(int(limite), 100))
    filas = db.execute(
        text(
            "SELECT tipo, exito, detalle, ip, fecha FROM eventos_seguridad "
            "WHERE id_usuario = :id_usuario ORDER BY fecha DESC, id_evento DESC LIMIT :limite;"
        ),
        {"id_usuario": id_usuario, "limite": limite},
    ).fetchall()
    eventos = []
    for fila in filas:
        dato = dict(fila._mapping)
        fecha = dato["fecha"]
        dato["fecha"] = fecha.isoformat() if hasattr(fecha, "isoformat") else str(fecha)
        eventos.append(dato)
    return eventos

