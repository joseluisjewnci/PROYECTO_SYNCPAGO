
from uuid import uuid4

from sqlalchemy import text

from app.config.database import SessionLocal
from app.controllers.mantenimiento_controller import (
    avisar_inactivos,
    eliminar_inactivos,
    purgar_eventos,
)
from app.controllers.usuario_controller import iniciar_sesion


def test_mantenimiento_simulacion_no_modifica_datos():
    db = SessionLocal()

    correo_aviso = f"prueba_aviso_{uuid4().hex}@test.local"
    correo_eliminar = f"prueba_eliminar_{uuid4().hex}@test.local"
    correo_evento = f"prueba_evento_{uuid4().hex}@test.local"

    try:
        db.execute(
            text("""
                INSERT INTO usuarios
                    (nombre, correo, contrasena, ultimo_login)
                VALUES
                    ('Usuario Prueba', :correo, 'hash_ficticio',
                     LOCALTIMESTAMP - INTERVAL '100 days')
            """),
            {"correo": correo_aviso},
        )

        db.execute(
            text("""
                INSERT INTO usuarios
                    (nombre, correo, contrasena,
                     ultimo_login, aviso_inactividad_enviado)
                VALUES
                    ('Usuario Para Eliminar', :correo, 'hash_ficticio',
                     LOCALTIMESTAMP - INTERVAL '120 days',
                     LOCALTIMESTAMP - INTERVAL '20 days')
            """),
            {"correo": correo_eliminar},
        )

        db.execute(
            text("""
                INSERT INTO eventos_seguridad (tipo, correo, fecha)
                VALUES (
                    'PRUEBA_PURGA',
                    :correo,
                    LOCALTIMESTAMP - INTERVAL '100 days'
                )
            """),
            {"correo": correo_evento},
        )

        db.commit()

        resultado_avisos = avisar_inactivos(
            db,
            enviar=lambda *args: (_ for _ in ()).throw(
                AssertionError("No debe enviar correos en simulación")
            ),
            simulacion=True,
        )

        resultado_eliminacion = eliminar_inactivos(
            db,
            simulacion=True,
        )

        resultado_eventos = purgar_eventos(
            db,
            simulacion=True,
        )

        assert resultado_avisos["candidatos"] >= 1
        assert resultado_avisos["avisados"] == 0
        assert resultado_avisos["fallidos"] == 0

        assert resultado_eliminacion["candidatos"] >= 1
        assert resultado_eliminacion["eliminadas"] == 0

        assert resultado_eventos["candidatos"] >= 1
        assert resultado_eventos["eliminados"] == 0

        usuarios = db.execute(
            text("""
                SELECT COUNT(*)
                FROM usuarios
                WHERE correo IN (:correo1, :correo2)
            """),
            {
                "correo1": correo_aviso,
                "correo2": correo_eliminar,
            },
        ).scalar_one()

        assert usuarios == 2

        eventos = db.execute(
            text("""
                SELECT COUNT(*)
                FROM eventos_seguridad
                WHERE correo = :correo
                  AND tipo = 'PRUEBA_PURGA'
            """),
            {"correo": correo_evento},
        ).scalar_one()

        assert eventos == 1

    finally:
        db.rollback()

        db.execute(
            text("""
                DELETE FROM eventos_seguridad
                WHERE correo = :correo
                  AND tipo = 'PRUEBA_PURGA'
            """),
            {"correo": correo_evento},
        )

        db.execute(
            text("""
                DELETE FROM usuarios
                WHERE correo IN (:correo1, :correo2)
            """),
            {
                "correo1": correo_aviso,
                "correo2": correo_eliminar,
            },
        )

        db.commit()
        db.close()


def test_aviso_fallido_no_marca_fecha_de_inactividad():
    db = SessionLocal()
    correo = f"prueba_fallo_{uuid4().hex}@test.local"

    try:
        db.execute(
            text("""
                INSERT INTO usuarios
                    (nombre, correo, contrasena, ultimo_login)
                VALUES
                    ('Usuario Prueba Fallo', :correo, 'hash_ficticio',
                     LOCALTIMESTAMP - INTERVAL '100 days')
            """),
            {"correo": correo},
        )
        db.commit()

        def envio_fallido(*args):
            raise RuntimeError("Fallo simulado de correo")

        resultado = avisar_inactivos(
            db,
            enviar=envio_fallido,
            simulacion=False,
        )

        assert resultado["candidatos"] >= 1
        assert resultado["avisados"] == 0
        assert resultado["fallidos"] >= 1

        aviso = db.execute(
            text("""
                SELECT aviso_inactividad_enviado
                FROM usuarios
                WHERE correo = :correo
            """),
            {"correo": correo},
        ).scalar_one()

        assert aviso is None

    finally:
        db.rollback()
        db.execute(
            text("DELETE FROM usuarios WHERE correo = :correo"),
            {"correo": correo},
        )
        db.commit()
        db.close()


def test_aviso_exitoso_marca_fecha_de_inactividad(monkeypatch):
    db = SessionLocal()
    correo = f"prueba_exito_{uuid4().hex}@test.local"
    correos_enviados = []

    try:
        db.execute(
            text("""
                INSERT INTO usuarios
                    (nombre, correo, contrasena, ultimo_login)
                VALUES
                    ('Usuario Prueba Exito', :correo, 'hash_ficticio',
                     LOCALTIMESTAMP - INTERVAL '100 days')
            """),
            {"correo": correo},
        )
        db.commit()

        monkeypatch.setattr(
            "app.controllers.mantenimiento_controller.registrar_evento",
            lambda *args, **kwargs: None,
        )

        def envio_exitoso(destino, asunto, cuerpo):
            correos_enviados.append({
                "destino": destino,
                "asunto": asunto,
                "cuerpo": cuerpo,
            })

        resultado = avisar_inactivos(
            db,
            enviar=envio_exitoso,
            simulacion=False,
        )

        assert resultado["candidatos"] >= 1
        assert resultado["avisados"] == 1
        assert resultado["fallidos"] == 0

        assert len(correos_enviados) == 1
        assert correos_enviados[0]["destino"] == correo
        assert "SYNCPAGO" in correos_enviados[0]["asunto"]

        aviso = db.execute(
            text("""
                SELECT aviso_inactividad_enviado
                FROM usuarios
                WHERE correo = :correo
            """),
            {"correo": correo},
        ).scalar_one()

        assert aviso is not None

    finally:
        db.rollback()
        db.execute(
            text("DELETE FROM usuarios WHERE correo = :correo"),
            {"correo": correo},
        )
        db.commit()
        db.close()


def test_eliminar_inactivo_borra_datos_relacionados(monkeypatch):
    db = SessionLocal()
    correo = f"prueba_cascada_{uuid4().hex}@test.local"

    try:
        id_usuario = db.execute(
            text("""
                INSERT INTO usuarios
                    (nombre, correo, contrasena,
                     ultimo_login, aviso_inactividad_enviado)
                VALUES (
                    'Usuario Prueba Cascada',
                    :correo,
                    'hash_ficticio',
                    LOCALTIMESTAMP - INTERVAL '120 days',
                    LOCALTIMESTAMP - INTERVAL '20 days'
                )
                RETURNING id_usuario
            """),
            {"correo": correo},
        ).scalar_one()

        id_tipo = db.execute(
            text("""
                INSERT INTO tipo_gasto (id_usuario, clase, detalle)
                VALUES (:id_usuario, 'vital', 'Tipo de prueba')
                RETURNING id_tipo
            """),
            {"id_usuario": id_usuario},
        ).scalar_one()

        id_gasto = db.execute(
            text("""
                INSERT INTO gasto
                    (id_tipo, fecha_vencimiento, precio)
                VALUES (
                    :id_tipo,
                    LOCALTIMESTAMP + INTERVAL '5 days',
                    50000
                )
                RETURNING id_gasto
            """),
            {"id_tipo": id_tipo},
        ).scalar_one()

        db.execute(
            text("""
                INSERT INTO finanzas
                    (id_usuario, entrada_dinero, presupuesto_gastos)
                VALUES (:id_usuario, 1000000, 500000)
            """),
            {"id_usuario": id_usuario},
        )

        db.commit()

        recordatorios = db.execute(
            text("""
                SELECT COUNT(*)
                FROM recordatorio
                WHERE id_gasto = :id_gasto
            """),
            {"id_gasto": id_gasto},
        ).scalar_one()

        trazabilidades = db.execute(
            text("""
                SELECT COUNT(*)
                FROM trazabilidad
                WHERE id_gasto = :id_gasto
            """),
            {"id_gasto": id_gasto},
        ).scalar_one()

        assert recordatorios >= 1
        assert trazabilidades >= 1

        monkeypatch.setattr(
            "app.controllers.mantenimiento_controller.registrar_evento",
            lambda *args, **kwargs: None,
        )

        resultado = eliminar_inactivos(db, simulacion=False)

        assert resultado["candidatos"] >= 1
        assert resultado["eliminadas"] == 1

        usuario = db.execute(
            text("""
                SELECT COUNT(*)
                FROM usuarios
                WHERE id_usuario = :id_usuario
            """),
            {"id_usuario": id_usuario},
        ).scalar_one()

        assert usuario == 0

        tipos = db.execute(
            text("""
                SELECT COUNT(*)
                FROM tipo_gasto
                WHERE id_tipo = :id_tipo
            """),
            {"id_tipo": id_tipo},
        ).scalar_one()

        assert tipos == 0

        gastos = db.execute(
            text("""
                SELECT COUNT(*)
                FROM gasto
                WHERE id_gasto = :id_gasto
            """),
            {"id_gasto": id_gasto},
        ).scalar_one()

        assert gastos == 0

        recordatorios_restantes = db.execute(
            text("""
                SELECT COUNT(*)
                FROM recordatorio
                WHERE id_gasto = :id_gasto
            """),
            {"id_gasto": id_gasto},
        ).scalar_one()

        assert recordatorios_restantes == 0

        trazabilidades_restantes = db.execute(
            text("""
                SELECT COUNT(*)
                FROM trazabilidad
                WHERE id_gasto = :id_gasto
            """),
            {"id_gasto": id_gasto},
        ).scalar_one()

        assert trazabilidades_restantes == 0

        finanzas = db.execute(
            text("""
                SELECT COUNT(*)
                FROM finanzas
                WHERE id_usuario = :id_usuario
            """),
            {"id_usuario": id_usuario},
        ).scalar_one()

        assert finanzas == 0

    finally:
        db.rollback()
        db.execute(
            text("DELETE FROM usuarios WHERE correo = :correo"),
            {"correo": correo},
        )
        db.commit()
        db.close()


def test_inicio_sesion_cancela_eliminacion_por_inactividad(monkeypatch):
    db = SessionLocal()
    correo = f"prueba_login_inactividad_{uuid4().hex}@test.local"

    try:
        id_usuario = db.execute(
            text("""
                INSERT INTO usuarios
                    (nombre, correo, contrasena,
                     ultimo_login, aviso_inactividad_enviado)
                VALUES (
                    'Usuario Prueba Login',
                    :correo,
                    'hash_ficticio',
                    LOCALTIMESTAMP - INTERVAL '120 days',
                    LOCALTIMESTAMP - INTERVAL '20 days'
                )
                RETURNING id_usuario
            """),
            {"correo": correo},
        ).scalar_one()

        db.commit()

        monkeypatch.setattr(
            "app.controllers.usuario_controller.registrar_evento",
            lambda *args, **kwargs: None,
        )

        monkeypatch.setattr(
            "app.controllers.mantenimiento_controller.registrar_evento",
            lambda *args, **kwargs: None,
        )

        resultado_login = iniciar_sesion(
            db,
            {
                "id_usuario": id_usuario,
                "correo": correo,
            },
        )

        assert resultado_login["token"]

        usuario = db.execute(
            text("""
                SELECT ultimo_login, aviso_inactividad_enviado
                FROM usuarios
                WHERE id_usuario = :id_usuario
            """),
            {"id_usuario": id_usuario},
        ).mappings().one()

        assert usuario["ultimo_login"] is not None
        assert usuario["aviso_inactividad_enviado"] is None

        resultado = eliminar_inactivos(db, simulacion=False)

        assert resultado["eliminadas"] == 0

        cuenta = db.execute(
            text("""
                SELECT COUNT(*)
                FROM usuarios
                WHERE id_usuario = :id_usuario
            """),
            {"id_usuario": id_usuario},
        ).scalar_one()

        assert cuenta == 1

    finally:
        db.rollback()
        db.execute(
            text("DELETE FROM usuarios WHERE correo = :correo"),
            {"correo": correo},
        )
        db.commit()
        db.close()


def test_purgar_eventos_elimina_antiguos_y_conserva_recientes():
    correo_antiguo = f"purga-antiguo-{uuid4().hex}@pruebas.local"
    correo_reciente = f"purga-reciente-{uuid4().hex}@pruebas.local"

    db = SessionLocal()

    try:
        db.execute(
            text("""
                INSERT INTO eventos_seguridad (correo, tipo, fecha)
                VALUES
                    (:correo_antiguo, 'PRUEBA_PURGA', LOCALTIMESTAMP - INTERVAL '100 days'),
                    (:correo_reciente, 'PRUEBA_PURGA', LOCALTIMESTAMP)
            """),
            {
                "correo_antiguo": correo_antiguo,
                "correo_reciente": correo_reciente,
            },
        )
        db.commit()

        resultado = purgar_eventos(db, simulacion=False)

        assert resultado["candidatos"] >= 1
        assert resultado["eliminados"] >= 1

        antiguo = db.execute(
            text("""
                SELECT COUNT(*)
                FROM eventos_seguridad
                WHERE correo = :correo
                  AND tipo = 'PRUEBA_PURGA'
            """),
            {"correo": correo_antiguo},
        ).scalar_one()

        reciente = db.execute(
            text("""
                SELECT COUNT(*)
                FROM eventos_seguridad
                WHERE correo = :correo
                  AND tipo = 'PRUEBA_PURGA'
            """),
            {"correo": correo_reciente},
        ).scalar_one()

        assert antiguo == 0
        assert reciente == 1

    finally:
        db.rollback()
        db.execute(
            text("""
                DELETE FROM eventos_seguridad
                WHERE correo IN (:antiguo, :reciente)
                  AND tipo = 'PRUEBA_PURGA'
            """),
            {
                "antiguo": correo_antiguo,
                "reciente": correo_reciente,
            },
        )
        db.commit()
        db.close()
