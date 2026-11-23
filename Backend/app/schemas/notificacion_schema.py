from typing import List

from pydantic import BaseModel, Field


class PreferenciasEntrada(BaseModel):
    # Clases de gasto de las que el usuario quiere avisos: vital, entretenimiento, varios (puede ir vacía)
    clases: List[str] = Field(default_factory=list, max_length=3)
