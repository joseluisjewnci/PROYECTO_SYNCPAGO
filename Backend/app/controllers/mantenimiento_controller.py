# =========================================================
# MANTENIMIENTO AUTOMÁTICO: INACTIVIDAD DE CUENTAS Y EVENTOS DE SEGURIDAD  # CREADA - RETENCION
# =========================================================
# Reglas del equipo:
#  1) 90 días sin iniciar sesión -> se envía un aviso al correo registrado.
#  2) 15 días después del aviso sin volver a iniciar sesión -> se elimina la cuenta y sus datos.
#     Si el usuario inicia sesión en ese plazo, iniciar_sesion() borra el aviso y la eliminación se cancela.
#  3) Los eventos de seguridad se eliminan a los 90 días de su creación.
# Todo se decide con fechas guardadas en la base de datos (no con "veces que corrió la tarea"):
# si el servidor estuvo apagado, la siguiente ejecución recupera lo pendiente y repetir una ejecución no hace daño.
from typing import Callable, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config.settings import (
    EVENTOS_RETENCION_DIAS,
    INACTIVIDAD_DIAS,
    INACTIVIDAD_GRACIA_DIAS,
    MANTENIMIENTO_LOTE,
    MANTENIMIENTO_SIMULACION,
)
from app.utils.auditoria import registrar_evento


def _enviar(destino: str, asunto: str, cuerpo: str) -> None:
    # Importación diferida: así este módulo se puede probar sin configurar el correo
    from app.utils.email_service import enviar_correo

    enviar_correo(destino, asunto, cuerpo)


def _texto_aviso(nombre: str, fecha_limite) -> str:
    return "\n".join([
        "Hola " + (nombre or "").strip() + ",",
        "",
        "Tu cuenta de SYNCPAGO lleva " + str(INACTIVIDAD_DIAS) + " días sin iniciar sesión, por lo que se considera inactiva.",
        "",
        "Si no inicias sesión antes del " + fecha_limite.strftime("%d/%m/%Y") + ", eliminaremos tu cuenta y tus datos personales "
        "(gastos, tipos de gasto, recordatorios y finanzas), salvo lo que debamos conservar por obligación legal.",
        "",
        "Para conservarla, solo inicia sesión en SYNCPAGO antes de esa fecha. Al hacerlo, la eliminación se cancela automáticamente.",
        "",
        "Si ya no quieres usar tu cuenta, no necesitas hacer nada.",
        "",
        "SYNCPAGO - control de gastos personales",
    ])


# ---------------------------------------------------------
# 1) AVISO DE INACTIVIDAD
# ---------------------------------------------------------
def avisar_inactivos(db: Session, enviar: Optional[Callable] = None, simulacion: bool = MANTENIMIENTO_SIMULACION) -> dict:
    # Cuentas con INACTIVIDAD_DIAS sin login y que todavía no tienen aviso
    enviar = enviar or _enviar
    filas = db.execute(
        text(
            "SELECT id_usuario, nombre, correo, (LOCALTIMESTAMP + make_interval(days => :gracia))::date AS fecha_limite "
            "FROM usuarios "
            "WHERE aviso_inactividad_enviado IS NULL "
            "AND ultimo_login < LOCALTIMESTAMP - make_interval(days => :dias) "
            "ORDER BY ultimo_login LIMIT :lote;"
        ),
        {"gracia": INACTIVIDAD_GRACIA_DIAS, "dias": INACTIVIDAD_DIAS, "lote": MANTENIMIENTO_LOTE},
    ).fetchall()
    resumen = {"candidatos": len(filas), "avisados": 0, "fallidos": 0}
    if simulacion:
        return resumen
    for fila in filas:
        u = dict(fila._mapping)
        try:
            enviar(u["correo"], "Tu cuenta de SYNCPAGO será eliminada por inactividad", _texto_aviso(u["nombre"], u["fecha_limite"]))
        except Exception as error:
            # Si el correo no salió NO se marca el aviso: los 15 días no empiezan a contar y se reintenta en la próxima ejecución
            resumen["fallidos"] += 1
            print("Mantenimiento: no se pudo enviar un aviso de inactividad:", type(error).__name__)
            continue
        # Solo se marca si la cuenta sigue inactiva y sin aviso (por si inició sesión mientras se enviaba)
        marcada = db.execute(
            text(
                "UPDATE usuarios SET aviso_inactividad_enviado = LOCALTIMESTAMP "
                "WHERE id_usuario = :id AND aviso_inactividad_enviado IS NULL "
                "AND ultimo_login < LOCALTIMESTAMP - make_interval(days => :dias) RETURNING id_usuario;"
            ),
            {"id": u["id_usuario"], "dias": INACTIVIDAD_DIAS},
        ).fetchone()
        db.commit()
        if marcada:
            resumen["avisados"] += 1
            registrar_evento("INACTIVIDAD_AVISO", id_usuario=u["id_usuario"], detalle="Aviso de inactividad enviado")
    return resumen


# ---------------------------------------------------------
# 2) ELIMINACIÓN DE CUENTAS QUE NO VOLVIERON A INICIAR SESIÓN
# ---------------------------------------------------------
def _desconectar_google_si_aplica(db: Session, id_usuario: int) -> None:
    # Si la cuenta conectó Google Calendar, se borra el calendario "SYNCPAGO" y se revoca el permiso antes de eliminarla
    conectado = db.execute(
        text("SELECT 1 FROM usuarios WHERE id_usuario = :id AND google_refresh_token IS NOT NULL;"), {"id": id_usuario}
    ).fetchone()
    if not conectado:
        return
    try:
        from app.controllers.notificacion_controller import desconectar_google

        desconectar_google(db, id_usuario)
    except Exception as error:
        print("Mantenimiento: no se pudo desconectar Google Calendar de una cuenta inactiva:", type(error).__name__)


def eliminar_inactivos(db: Session, simulacion: bool = MANTENIMIENTO_SIMULACION) -> dict:
    # Cuentas con aviso enviado hace más de INACTIVIDAD_GRACIA_DIAS y sin login desde entonces
    filas = db.execute(
        text(
            "SELECT id_usuario FROM usuarios "
            "WHERE aviso_inactividad_enviado IS NOT NULL "
            "AND aviso_inactividad_enviado < LOCALTIMESTAMP - make_interval(days => :gracia) "
            "AND ultimo_login < aviso_inactividad_enviado "
            "ORDER BY aviso_inactividad_enviado LIMIT :lote;"
        ),
        {"gracia": INACTIVIDAD_GRACIA_DIAS, "lote": MANTENIMIENTO_LOTE},
    ).fetchall()
    resumen = {"candidatos": len(filas), "eliminadas": 0}
    if simulacion:
        return resumen
    for fila in filas:
        id_usuario = fila._mapping["id_usuario"]
        _desconectar_google_si_aplica(db, id_usuario)
        # Se vuelven a comprobar las condiciones EN la misma sentencia: si el usuario inició sesión hace un instante, no se borra.
        # ON DELETE CASCADE elimina tipos de gasto, gastos, recordatorios, trazabilidad y finanzas de esa cuenta.
        borrada = db.execute(
            text(
                "DELETE FROM usuarios WHERE id_usuario = :id "
                "AND aviso_inactividad_enviado IS NOT NULL "
                "AND aviso_inactividad_enviado < LOCALTIMESTAMP - make_interval(days => :gracia) "
                "AND ultimo_login < aviso_inactividad_enviado RETURNING id_usuario;"
            ),
            {"id": id_usuario, "gracia": INACTIVIDAD_GRACIA_DIAS},
        ).fetchone()
        db.commit()
        if borrada:
            resumen["eliminadas"] += 1
            # Sin correo en el evento: la cuenta se eliminó y no se vuelve a guardar su dato personal
            registrar_evento("CUENTA_ELIMINADA_INACTIVIDAD", id_usuario=id_usuario, detalle="Cuenta eliminada por inactividad")
    return resumen


# ---------------------------------------------------------
# 3) PURGA DE EVENTOS DE SEGURIDAD
# ---------------------------------------------------------
def purgar_eventos(db: Session, simulacion: bool = MANTENIMIENTO_SIMULACION) -> dict:
    parametros = {"dias": EVENTOS_RETENCION_DIAS}
    if simulacion:
        cuenta = db.execute(
            text("SELECT COUNT(*) FROM eventos_seguridad WHERE fecha < LOCALTIMESTAMP - make_interval(days => :dias);"), parametros
        ).scalar()
        return {"candidatos": int(cuenta or 0), "eliminados": 0}
    resultado = db.execute(
        text("DELETE FROM eventos_seguridad WHERE fecha < LOCALTIMESTAMP - make_interval(days => :dias);"), parametros
    )
    db.commit()
    return {"candidatos": resultado.rowcount, "eliminados": resultado.rowcount}


# ---------------------------------------------------------
# EJECUCIÓN COMPLETA (la llama la tarea programada de main.py)
# ---------------------------------------------------------
def ejecutar_mantenimiento(db: Session, simulacion: bool = MANTENIMIENTO_SIMULACION) -> dict:
    # Cada paso es independiente: si uno falla, los demás se ejecutan igual
    resultado = {}
    for nombre, paso in (("avisos", avisar_inactivos), ("eliminacion", eliminar_inactivos), ("eventos", purgar_eventos)):
        try:
            resultado[nombre] = paso(db, simulacion=simulacion)
        except Exception as error:
            db.rollback()
            resultado[nombre] = {"error": type(error).__name__}
            print("Mantenimiento: falló el paso", nombre, "-", type(error).__name__)
    print("Mantenimiento" + (" (SIMULACIÓN)" if simulacion else "") + ":", resultado)
    return resultado
