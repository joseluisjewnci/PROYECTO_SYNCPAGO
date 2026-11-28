
import os
from urllib.parse import urlparse

import pytest


def pytest_configure():
    # Exigir autorización explícita para utilizar la base de pruebas.
    if os.getenv("CONFIRMAR_BORRADO_BASE_PRUEBAS") != "SI":
        raise pytest.UsageError(
            "Pruebas bloqueadas. Define "
            "CONFIRMAR_BORRADO_BASE_PRUEBAS=SI para autorizarlas."
        )

    # Exigir una conexión independiente de la configuración normal.
    database_url = os.getenv("DATABASE_URL_PRUEBAS", "").strip()

    if not database_url:
        raise pytest.UsageError(
            "Falta DATABASE_URL_PRUEBAS. No se utilizará DATABASE_URL."
        )

    parsed = urlparse(database_url)

    # Aceptar exclusivamente conexiones PostgreSQL locales.
    if parsed.scheme not in ("postgresql", "postgresql+psycopg2"):
        raise pytest.UsageError(
            "La conexión de pruebas debe utilizar PostgreSQL con psycopg2."
        )

    if parsed.hostname not in ("localhost", "127.0.0.1", "::1"):
        raise pytest.UsageError(
            "Bloqueado: la base de pruebas debe estar en localhost."
        )

    if parsed.path.lstrip("/") != "syncpago_pruebas":
        raise pytest.UsageError(
            "Bloqueado: el nombre de la base debe ser syncpago_pruebas."
        )

    if parsed.query or parsed.fragment:
        raise pytest.UsageError(
            "La URL de pruebas no debe incluir parámetros ni fragmentos."
        )

    # Sobrescribir antes de importar cualquier módulo de la aplicación.
    os.environ["DATABASE_URL"] = database_url
    os.environ["SECRET_KEY"] = "clave-ficticia-exclusiva-para-pruebas-123456"
    os.environ["ENTORNO"] = "pruebas"
    os.environ["EMAIL_MODO"] = "consola"
    os.environ["TELEGRAM_ACTIVO"] = "false"
    os.environ["MANTENIMIENTO_SIMULACION"] = "true"
    os.environ["CREAR_TABLAS"] = "false"


@pytest.fixture(scope="session")
def database_url_pruebas():
    return os.environ["DATABASE_URL_PRUEBAS"]
