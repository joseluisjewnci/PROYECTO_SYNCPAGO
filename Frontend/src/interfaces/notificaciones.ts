export type ClaseGasto = "vital" | "entretenimiento" | "varios";

export interface EstadoNotificaciones {
  clases: ClaseGasto[];
  telegram: {
    disponible: boolean;
    vinculado: boolean;
    activo: boolean;
    bot_usuario: string | null;
  };
  google: {
    disponible: boolean;
    conectado: boolean;
  };
  telefono: {
    registrado: boolean;
    verificado: boolean;
    terminacion: string | null;
  };
  zona_horaria: string;
}

export interface EnlaceTelegram {
  url: string;
  expira_minutos: number;
}

export interface EnlaceGoogle {
  url: string;
}
