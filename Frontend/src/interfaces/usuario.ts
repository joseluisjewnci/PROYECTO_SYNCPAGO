export interface Usuario {
  id_usuario: number;
  nombre: string;
  correo: string;
  telefono: string | null;
  fecha_registro: string;
}

// Respuesta de POST /usuarios/login
export interface SesionIniciada {
  usuario: Usuario;
  token: string;
  expira_minutos: number;
}

// Respuesta de POST /usuarios/renovar
export interface TokenRenovado {
  token: string;
  expira_minutos: number;
}

// Respuesta del paso 1 del registro (POST /usuarios/registro/iniciar)
export interface RegistroIniciado {
  token_pendiente: string;
  expira_minutos: number;
  requiere_telegram: boolean;
  bot_url: string | null;
}

// Respuesta del paso 1 de la recuperación (POST /usuarios/recuperar/solicitar)
export interface RecuperacionIniciada {
  token_recuperacion: string;
  expira_minutos: number;
}
