# ==============================================================================
# PROYECTO SYNCPAGO - CAPA DE ESQUEMAS DE SEGURIDAD Y AUTH (schemas/auth_schema.py)
# ==============================================================================
# PRINCIPIO DE SEGURIDAD Y DISEÑO: "Las credenciales no deben almacenarse en texto plano".
# Este archivo actúa como la aduana de seguridad del backend, validando la 
# estructura, complejidad y formato de las credenciales de los usuarios.
# ==============================================================================

from pydantic import BaseModel, Field, field_validator
from typing import Optional
import re

def _validar_contrasena_segura(v: str) -> str:
    # Mínimo 8 caracteres, una mayúscula y un número este se usa en registro y recuperación
    if len(v) < 8:
        raise ValueError("Seguridad: La contraseña debe tener una longitud mínima de 8 caracteres.")
    if not any(char.isupper() for char in v):
        raise ValueError("Seguridad: La contraseña debe incluir al menos una letra mayúscula.")
    if not any(char.isdigit() for char in v):
        raise ValueError("Seguridad: La contraseña debe incluir al menos un número.")
    return v


class AuthBase(BaseModel):
    """
    Esquema Base para la información de autenticación de usuarios.
    
    JUSTIFICACIÓN TÉCNICA (SENA - MANTENIBILIDAD & USABILIDAD):
    Establece las reglas básicas del formato del correo electrónico en la frontera [3].
    Evita procesar peticiones en el servicio si el formato del correo es inválido.
    """
    correo: str = Field(
        ..., 
        min_length=1,
        max_length=100,
        description="Correo electrónico único del usuario. Actúa como identificador de sesión."
    )

    @field_validator('correo')
    @classmethod
    def limpiar_correo(cls, v: str) -> str:
        # Se quitan espacios y se pasa a minúsculas: Ana@Mail.com y ana@mail.com son el mismo correo.
        # El formato no se valida aquí para que el login siga igual con los usuarios existentes.
        return v.strip().lower()


class UserRegister(AuthBase):
    """
    DTO (Data Transfer Object) para el Registro de Nuevos Usuarios (POST /auth/register).
    
    JUSTIFICACIÓN TÉCNICA (SENA - REQUISITOS NO FUNCIONALES DE SEGURIDAD):
    Obliga a los clientes a registrar contraseñas con un estándar mínimo de complejidad,
    mitigando ataques de fuerza bruta y elevando el estándar de seguridad de la API [3].
    """
    nombre: str = Field(
        ..., 
        min_length=3, 
        max_length=100, 
        description="Nombre completo del usuario que se registrará en el sistema."
    )
    contrasena: str = Field(
        ..., 
        max_length=128,
        description="Contraseña de acceso. Debe cumplir con políticas de complejidad activa [3]."
    )
    telefono: Optional[str] = Field(
        default=None,
        max_length=20,
        description="Teléfono opcional del usuario: exactamente 10 dígitos numéricos."
    )

    @field_validator('telefono')
    @classmethod
    def validar_telefono(cls, v):
        # Vacío = sin teléfono. Si se envía, deben ser exactamente 10 dígitos (0-9).
        if v is None or v.strip() == "":
            return None
        v = v.strip()
        if not re.fullmatch(r"[0-9]{10}", v):
            raise ValueError("El teléfono debe tener exactamente 10 dígitos numéricos.")
        return v

    @field_validator('correo')
    @classmethod
    def validar_formato_correo(cls, v: str) -> str:
        # REGLA DE NEGOCIO ACTIVA (solo en registro): el formato del correo debe ser válido.
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_regex, v):
            raise ValueError("El formato del correo electrónico ingresado no es válido.")
        return v

    @field_validator('nombre')
    @classmethod
    def validar_nombre_alfabetico(cls, v: str) -> str:
        """
        REGLA DE SEGURIDAD: El nombre de usuario no debe contener caracteres extraños o scripts (XSS).
        """
        v_clean = v.strip()
        # Solo permite letras y espacios
        if not re.match(r'^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$', v_clean):
            raise ValueError("Validación: El nombre solo puede contener letras y espacios.")
        return v_clean

    @field_validator('contrasena')
    @classmethod
    def validar_complejidad_password(cls, v: str) -> str:
        """
        REGLA DE NEGOCIO DE SEGURIDAD ACTIVA:
        La contraseña debe tener mínimo 8 caracteres, al menos una mayúscula y un número [3].
        """
        return _validar_contrasena_segura(v)


class UserLogin(AuthBase):
    """
    DTO para el Inicio de Sesión de Usuarios (POST /auth/login).
    Optimizado de forma ligera para no sobrecargar el payload de red.
    """
    contrasena: str = Field(..., max_length=128, description="Contraseña en texto plano para validación contra hash de BD.")


class UserResponse(BaseModel):
    """
    DTO de Salida Seguro para retornar información de usuario tras registro o consulta.
    
    JUSTIFICACIÓN TÉCNICA (SENA - PRINCIPIO DE SEGURIDAD DE LA INFORMACIÓN):
    REGLA DE ORO: Las contraseñas (incluso hasheadas) JAMÁS deben viajar en las 
    respuestas HTTP hacia el cliente [3]. Este esquema filtra activamente los datos, 
    retornando exclusivamente campos públicos y seguros [3, 4].
    """
    id_usuario: int = Field(..., description="Identificador único generado en PostgreSQL.")
    nombre: str = Field(..., description="Nombre registrado del usuario.")
    correo: str = Field(..., description="Correo electrónico registrado.")

    class ConfigDict:
        # En Pydantic v2 permite serializar directamente desde objetos ORM.
        from_attributes = True


class Token(BaseModel):
    """
    DTO para retornar el token de acceso generado exitosamente (JWT).
    Requerido por el estándar OAuth2 Bearer para la autenticación en el Frontend [5].
    """
    access_token: str = Field(..., description="Token JWT firmado de forma segura por el Backend.")
    token_type: str = Field(default="bearer", description="Esquema de autenticación (por defecto Bearer).")


class TokenPayload(BaseModel):
    """
    DTO para validar el contenido decodificado del JWT en las rutas protegidas.
    Garantiza que el token contenga la identidad válida del usuario en cada petición [3].
    """
    id_usuario: Optional[int] = Field(default=None, description="ID del usuario extraído del payload del token.")


def _validar_codigo_6(v):
    # El código llega como texto de exactamente 6 dígitos (se tolera que se cuelen espacios al pegar)
    v = v.strip() if isinstance(v, str) else v
    if not isinstance(v, str) or not re.match(r"^[0-9]{6}$", v):
        raise ValueError("El código debe tener exactamente 6 dígitos.")
    return v


class RegistroConfirmar(BaseModel):
    # Paso 2 del registro: el sobre del paso 1 y el código de 6 dígitos que llegó al correo.
    token_pendiente: str = Field(..., min_length=1, max_length=4000)
    codigo: str = Field(..., max_length=20)
    token_telegram: Optional[str] = Field(default=None, max_length=20)  # MODIFICADO - TELEGRAM (ahora es un código corto de 8 caracteres)

    @field_validator('token_pendiente', 'token_telegram')
    @classmethod
    def limpiar_token_pendiente(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator('codigo')
    @classmethod
    def validar_codigo(cls, v):
        return _validar_codigo_6(v)


class RecuperarSolicitud(AuthBase):
    # Paso 1 de la recuperación: solo el correo (hereda el campo "correo" de AuthBase)
    pass


class RecuperarConfirmar(BaseModel):
    # Paso 2 de la recuperación: sobre del paso 1 + código de 6 dígitos + contraseña nueva
    token_recuperacion: str = Field(..., min_length=1, max_length=4000)
    codigo: str = Field(..., max_length=20)
    contrasena_nueva: str = Field(..., max_length=128)

    @field_validator('token_recuperacion')
    @classmethod
    def limpiar_token_recuperacion(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator('codigo')
    @classmethod
    def validar_codigo_recuperacion(cls, v):
        return _validar_codigo_6(v)

    @field_validator('contrasena_nueva')
    @classmethod
    def validar_contrasena_nueva(cls, v: str) -> str:
        return _validar_contrasena_segura(v)


# CREADA - SEGURIDAD
class CambiarContrasena(BaseModel):
    # Cambio de contraseña con la sesión iniciada: se pide la actual para confirmar que es el dueño
    contrasena_actual: str = Field(..., min_length=1, max_length=128)
    contrasena_nueva: str = Field(..., max_length=128)

    @field_validator('contrasena_nueva')
    @classmethod
    def validar_contrasena_nueva(cls, v: str) -> str:
        return _validar_contrasena_segura(v)
