import { api } from "./api";
import type { EventoSeguridad } from "../interfaces/seguridad";

// Usa el token de sesión (api.ts lo agrega solo) y devuelve solo la actividad de la cuenta de la sesión.
export const seguridadService = {
  eventos(limite = 20) {
    return api.get<EventoSeguridad[]>(`/seguridad/eventos?limite=${limite}`);
  },
};
