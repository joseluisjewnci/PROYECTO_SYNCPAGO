// Duración de la pantalla de carga que se muestra tras iniciar sesión o registrarse.
export const PANTALLA_CARGA_MS = 2000;

// Espera una cantidad de milisegundos (por defecto, la de la pantalla de carga).
export function esperar(ms: number = PANTALLA_CARGA_MS): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}
