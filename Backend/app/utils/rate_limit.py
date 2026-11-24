# =========================================================
# LÍMITE SIMPLE DE FRECUENCIA
# =========================================================
# Evita que alguien dispare cientos de correos hacia una misma dirección.
# vive en la memoria del proceso; se reinicia con el servidor.
import time

_ultimo_uso: dict = {}


def permitir(clave: str, segundos: int = 60) -> bool:
    ahora = time.monotonic()
    if len(_ultimo_uso) > 1000:
        for k in [k for k, t in _ultimo_uso.items() if ahora - t > 3600]:
            del _ultimo_uso[k]
    ultimo = _ultimo_uso.get(clave)
    if ultimo is not None and ahora - ultimo < segundos:
        return False
    _ultimo_uso[clave] = ahora
    return True


def liberar(clave: str) -> None:
    # Si el envío del correo falló, el intento no debe contar para el límite
    _ultimo_uso.pop(clave, None)


# =========================================================
# LÍMITE DE INTENTOS Y USO ÚNICO
# =========================================================
# Igual que lo anterior, vive en la memoria del proceso: se reinicia con el servidor
# y no se comparte entre varios procesos (workers).
_intentos: dict = {}
_usados: dict = {}


def _limpiar(tabla: dict, ahora: float) -> None:
    if len(tabla) > 2000:
        for k in [k for k, v in tabla.items() if (v[1] if isinstance(v, list) else v) < ahora]:
            del tabla[k]


def registrar_intento(clave: str, maximo: int, segundos: int) -> bool:
    # Cuenta un intento. True = todavía se permite intentar | False = ya se agotaron los intentos
    ahora = time.monotonic()
    _limpiar(_intentos, ahora)
    registro = _intentos.get(clave)
    if registro is None or registro[1] < ahora:
        registro = [0, ahora + segundos]
        _intentos[clave] = registro
    registro[0] += 1
    return registro[0] <= maximo


def marcar_usado(clave: str, segundos: int) -> bool:
    # True la primera vez; False si esa clave ya se usó
    ahora = time.monotonic()
    _limpiar(_usados, ahora)
    vence = _usados.get(clave)
    if vence is not None and vence >= ahora:
        return False
    _usados[clave] = ahora + segundos
    return True
