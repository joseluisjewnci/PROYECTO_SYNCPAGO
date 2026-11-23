// Un evento de la actividad de seguridad de la cuenta (GET /seguridad/eventos)
export interface EventoSeguridad {
  tipo: string;
  exito: boolean;
  detalle: string | null;
  ip: string | null;
  fecha: string; // fecha ISO sin zona horaria, con la hora del servidor
}
