from datetime import datetime
from sqlalchemy import Boolean, Column, BigInteger, SmallInteger, String, Text, TIMESTAMP, text # MODIFICADO - RETENCION
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.config.database import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id_usuario = Column(
        BigInteger,
        primary_key=True,
        autoincrement=True
    )

    telefono = Column(
        String(20)
    )

    nombre = Column(
        String(100),
        nullable=False
    )

    correo = Column(
        String(100),
        nullable=False,
        unique=True
    )

    contrasena = Column(
        String(255),
        nullable=False
    )

    fecha_registro = Column(
        TIMESTAMP,
        server_default=func.now(),
        default=datetime.utcnow
    )

    # Columnas de seguridad
    sesion_id = Column(
        String(64)
    )

    intentos_fallidos = Column(
        SmallInteger,
        nullable=False,
        server_default="0"
    )

    bloqueado_hasta = Column(
        TIMESTAMP
    )

    # Notificaciones opcionales
    telegram_chat_id = Column(
        BigInteger
    )

    telefono_verificado = Column(
        Boolean,
        nullable=False,
        server_default="false"
    )

    telegram_activo = Column(
        Boolean,
        nullable=False,
        server_default="false"
    )

    notif_clases = Column(
        String(60),
        nullable=False,
        server_default="vital,entretenimiento,varios"
    )

    google_refresh_token = Column(
        Text
    )

    google_calendario_id = Column(
        String(255)
    )

    # Inactividad de la cuenta (ver Database/12_INACTIVIDAD_Y_PURGA.sql) # CREADA - RETENCION
    ultimo_login = Column( # CREADA - RETENCION
        TIMESTAMP, # CREADA - RETENCION
        nullable=False, # CREADA - RETENCION
        server_default=text("LOCALTIMESTAMP") # CREADA - RETENCION
    ) # CREADA - RETENCION

    aviso_inactividad_enviado = Column( # CREADA - RETENCION
        TIMESTAMP # CREADA - RETENCION
    ) # CREADA - RETENCION


    # Relación uno-a-muchos con TipoGasto
    tipos_gasto = relationship(
        "TipoGasto",
        back_populates="usuario",
        cascade="all, delete-orphan"
    )
