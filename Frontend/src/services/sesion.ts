// Manejo del token de sesión en el navegador.
const CLAVE_TOKEN = "sp_token";
export const EVENTO_SESION_EXPIRADA = "sp:sesion-expirada";

export function obtenerToken(): string | null {
  try {
    return localStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

export function guardarToken(token: string): void {
  try {
    localStorage.setItem(CLAVE_TOKEN, token);
  } catch {
    // sin almacenamiento disponible: la sesión durará solo mientras no se recargue
  }
}

export function borrarToken(): void {
  try {
    localStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // nada que borrar
  }
}
