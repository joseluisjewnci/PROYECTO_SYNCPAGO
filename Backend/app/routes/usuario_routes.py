from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.config.database import get_db
from app.controllers.usuario_controller import (
    registrar_nuevo_usuario, 
    autenticar_usuario,
    obtener_todos_usuarios,
    obtener_usuario,
    iniciar_registro,
    confirmar_registro,
    solicitar_recuperacion,
    confirmar_recuperacion,
    ErrorVerificacion,
    iniciar_sesion,
    cerrar_sesion,
    renovar_sesion
)
from app.utils.response import response_success, response_error, response_error_servidor
from app.utils.auth import get_sesion_actual, get_usuario_actual, es_propietario
from app.schemas.auth_schema import UserRegister, UserLogin, RegistroConfirmar, RecuperarSolicitud, RecuperarConfirmar

router = APIRouter(
    prefix="/usuarios",
    tags=["Usuarios"]
)

# =========================================================
# 1. ENDPOINT PARA REGISTRAR USUARIOS
# =========================================================
@router.post("/registro/iniciar")
def iniciar_registro_usuario(
    datos: UserRegister,
    db: Session = Depends(get_db)
):
    try:
        resultado = iniciar_registro(db, datos.nombre, datos.correo, datos.contrasena, datos.telefono)
        return response_success(
            mensaje="Te enviamos un código de 6 dígitos a tu correo",
            data=resultado,
            code=200
        )
    except ErrorVerificacion as error:
        return response_error(mensaje=error.mensaje, error=error.error, code=error.code)
    except Exception:
        return response_error(
            mensaje="No se pudo iniciar el registro",
            error="REGISTRATION_START_FAILED",
            code=500
        )


@router.post("/registro/confirmar")
def registrar_usuario(
    datos: RegistroConfirmar,
    db: Session = Depends(get_db)
):
    try:
        nuevo_usuario = confirmar_registro(db, datos.token_pendiente, datos.codigo, datos.token_telegram)
        return response_success(
            mensaje="Usuario registrado exitosamente con contraseña protegida",
            data=nuevo_usuario,
            code=201
        )
    except ErrorVerificacion as error_verificacion:
        return response_error(
            mensaje=error_verificacion.mensaje,
            error=error_verificacion.error,
            code=error_verificacion.code
        )

    except Exception as error:
        if "unique constraint" in str(error).lower() or "correo" in str(error).lower():
            return response_error(
                mensaje="El correo electrónico ya se encuentra registrado",
                error="EMAIL_ALREADY_EXISTS",
                code=400
            )
        return response_error_servidor("Error al registrar el usuario", error)

# =========================================================
# 2. ENDPOINT PARA INICIAR SESIÓN (LOGIN)
# =========================================================
@router.post("/login")
def login_usuario(
    datos: UserLogin,
    db: Session = Depends(get_db)
):
    try:
        usuario_autenticado = autenticar_usuario(db, datos.correo, datos.contrasena)
        
        if not usuario_autenticado:
            return response_error(
                mensaje="Credenciales incorrectas (correo o contraseña no válidos)",
                error="INVALID_CREDENTIALS",
                code=401
            )
            
        sesion = iniciar_sesion(db, usuario_autenticado) #(genera sid, lo guarda hasheado y firma el JWT)
        return response_success(
            mensaje="Inicio de sesión exitoso",
            data=sesion,
            code=200
        )
    except ErrorVerificacion as error_verificacion:
        return response_error(mensaje=error_verificacion.mensaje, error=error_verificacion.error, code=error_verificacion.code)
    except Exception as error:
        return response_error_servidor("Error al intentar iniciar sesión", error)

# =========================================================
# 2.0 CERRAR SESIÓN: invalida el token en el servidor al instante
# =========================================================
@router.post("/logout")
def logout_usuario(
    usuario_actual: dict = Depends(get_usuario_actual),
    db: Session = Depends(get_db)
):
    try:
        cerrar_sesion(db, usuario_actual["id_usuario"])
        return response_success(mensaje="Sesión cerrada", data=None, code=200)
    except Exception as error:
        return response_error_servidor("Error al cerrar la sesión", error)

# =========================================================
# 2.0.1 RENOVAR TOKEN (sesión deslizante, con tope absoluto)
# =========================================================
@router.post("/renovar")
def renovar_token_usuario(sesion: dict = Depends(get_sesion_actual)):
    try:
        return response_success(mensaje="Token renovado", data=renovar_sesion(sesion), code=200)
    except ErrorVerificacion as error:
        return response_error(mensaje=error.mensaje, error=error.error, code=error.code)
    except Exception as error:
        return response_error_servidor("Error al renovar la sesión", error)

# =========================================================
# 2.0.2 QUIÉN SOY: el frontend lo usa para validar el token guardado
# (debe ir ANTES de "/{id_usuario}" para que no lo confunda con un id)
# =========================================================
@router.get("/me")
def usuario_en_sesion(usuario_actual: dict = Depends(get_usuario_actual)):
    return response_success(mensaje="Sesión válida", data=usuario_actual, code=200)

# =========================================================
# 2.1 RECUPERACIÓN DE CONTRASEÑA, PASO 1: pedir el token por correo
# =========================================================
@router.post("/recuperar/solicitar")
def solicitar_recuperacion_usuario(
    datos: RecuperarSolicitud,
    db: Session = Depends(get_db)
):
    try:
        resultado = solicitar_recuperacion(db, datos.correo)
        # Respuesta genérica: no revela si el correo está registrado o no
        return response_success(
            mensaje="Si el correo está registrado, te enviamos un código de 6 dígitos",
            data=resultado,
            code=200
        )
    except ErrorVerificacion as error:
        return response_error(mensaje=error.mensaje, error=error.error, code=error.code)
    except Exception:
        return response_error(
            mensaje="No se pudo procesar la solicitud",
            error="RECOVERY_REQUEST_FAILED",
            code=500
        )

# =========================================================
# 2.2 RECUPERACIÓN DE CONTRASEÑA, PASO 2: verificar tokens y cambiar la contraseña
# =========================================================
@router.post("/recuperar/confirmar")
def confirmar_recuperacion_usuario(
    datos: RecuperarConfirmar,
    db: Session = Depends(get_db)
):
    try:
        confirmar_recuperacion(db, datos.token_recuperacion, datos.codigo, datos.contrasena_nueva)
        return response_success(
            mensaje="Contraseña actualizada. Ya puedes iniciar sesión",
            data=None,
            code=200
        )
    except ErrorVerificacion as error:
        return response_error(mensaje=error.mensaje, error=error.error, code=error.code)
    except Exception:
        return response_error(
            mensaje="No se pudo actualizar la contraseña",
            error="RECOVERY_CONFIRM_FAILED",
            code=500
        )

# =========================================================
# 3. ENDPOINT PARA LISTAR TODOS LOS USUARIOS
# =========================================================
@router.get("/")
def listar_usuarios(usuario_actual: dict = Depends(get_usuario_actual)):
    # Ya no se listan todos los usuarios: solo se devuelve el propio (privacidad)
    return response_success(
        mensaje="Listado de usuarios obtenido con éxito",
        data=[usuario_actual],
        code=200
    )

# =========================================================
# 4. ENDPOINT PARA OBTENER UN USUARIO POR ID
# =========================================================
@router.get("/{id_usuario}")
def buscar_usuario(id_usuario: int, db: Session = Depends(get_db), usuario_actual: dict = Depends(get_usuario_actual)):
    try:
        if not es_propietario(usuario_actual, id_usuario):
            return response_error(mensaje="No tienes permiso para ver a otro usuario", error="FORBIDDEN", code=403)
        usuario = obtener_usuario(db, id_usuario)
        if not usuario:
            return response_error(
                mensaje="El usuario solicitado no existe",
                error="USER_NOT_FOUND",
                code=404
            )
        return response_success(
            mensaje="Información del usuario obtenida con éxito",
            data=usuario,
            code=200
        )
    except Exception as error:
        return response_error_servidor("Error al obtener la información del usuario", error)
