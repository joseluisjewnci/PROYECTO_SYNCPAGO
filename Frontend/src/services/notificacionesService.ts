import { api } from "./api";
import type { ClaseGasto, EnlaceGoogle, EnlaceTelegram, EstadoNotificaciones } from "../interfaces/notificaciones";

// Todas estas rutas usan el token de sesión (api.ts lo agrega solo) y trabajan con el usuario de la sesión.
export const notificacionesService = {
  estado() {
    return api.get<EstadoNotificaciones>("/notificaciones/estado");
  },

  guardarPreferencias(clases: ClaseGasto[]) {
    return api.putJson<{ clases: ClaseGasto[] }>("/notificaciones/preferencias", { clases });
  },

  vincularTelegram() {
    return api.post<EnlaceTelegram>("/notificaciones/telegram/vincular");
  },

  activarTelegram() {
    return api.post<null>("/notificaciones/telegram/activar");
  },

  desactivarTelegram() {
    return api.post<null>("/notificaciones/telegram/desactivar");
  },

  probarTelegram() {
    return api.post<null>("/notificaciones/telegram/probar");
  },

  desvincularTelegram() {
    return api.del<null>("/notificaciones/telegram");
  },

  iniciarGoogle() {
    return api.post<EnlaceGoogle>("/notificaciones/google/iniciar");
  },

  sincronizarGoogle() {
    return api.post<null>("/notificaciones/google/sincronizar");
  },

  desconectarGoogle() {
    return api.del<null>("/notificaciones/google");
  },
};
