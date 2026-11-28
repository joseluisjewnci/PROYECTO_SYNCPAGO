from sqlalchemy import text

from app.config.database import engine


def test_conexion_usa_base_de_pruebas():
    with engine.connect() as conexion:
        base = conexion.execute(
            text("SELECT current_database()")
        ).scalar_one()

        usuario = conexion.execute(
            text("SELECT current_user")
        ).scalar_one()

        assert base == "syncpago_pruebas"
        assert usuario == "postgres"