import type { ApiResponse } from "../interfaces/api";
import { obtenerToken, borrarToken, EVENTO_SESION_EXPIRADA } from "./sesion";

const API_URL = import.meta.env.VITE_API_URL as string;

type Params = Record<string, string | number | boolean | undefined | null>;

// Convierte un objeto en los parámetros de la URL (?a=1&b=2), sin incluir los vacíos
function buildQuery(params?: Params): string {
  if (!params) return "";
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.append(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

// Extrae el primer mensaje de un error de validación 422 de FastAPI/Pydantic
function mensajeDeValidacion(detail: unknown): string {
  if (!Array.isArray(detail) || detail.length === 0) return "";
  const msg = (detail[0] as { msg?: unknown }).msg;
  if (typeof msg !== "string") return "";
  return msg.replace(/^Value error,\s*/, "");
}

// Función única por la que pasan todas las llamadas al servidor:
// agrega el token de sesión, traduce los errores a mensajes claros y devuelve solo los datos.
async function request<T>(
  path: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  params?: Params,
  body?: unknown
): Promise<T> {
  const url = `${API_URL}${path}${buildQuery(params)}`;

  const init: RequestInit = { method };
  const cabeceras: Record<string, string> = {};
  if (body !== undefined) {
    cabeceras["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const token = obtenerToken();
  if (token) {
    cabeceras["Authorization"] = `Bearer ${token}`;
  }
  init.headers = cabeceras;

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new Error("No se pudo conectar con el servidor. Verifica tu conexión.");
  }

  // 401 en una ruta protegida = token vencido o invalidado: se limpia y se avisa a la app
  if (response.status === 401 && !path.startsWith("/usuarios/login")) {
    borrarToken();
    window.dispatchEvent(new Event(EVENTO_SESION_EXPIRADA));
    throw new Error("Tu sesión expiró. Inicia sesión de nuevo.");
  }

  let json: ApiResponse<T> | null = null;
  try {
    json = await response.json();
  } catch {
    throw new Error("El servidor respondió con un formato inesperado.");
  }

  if (!json) {
    throw new Error("Respuesta vacía del servidor.");
  }

  if (!json.status) {
    const detalle = mensajeDeValidacion((json as unknown as { detail?: unknown }).detail);
    throw new Error(detalle || json.mensaje || json.error || "Ocurrió un error en el servidor.");
  }

  return json.data;
}

export const api = {
  get: <T>(path: string, params?: Params) => request<T>(path, "GET", params),
  post: <T>(path: string, params?: Params) => request<T>(path, "POST", params),
  postJson: <T>(path: string, body: unknown) => request<T>(path, "POST", undefined, body),
  putJson: <T>(path: string, body: unknown) => request<T>(path, "PUT", undefined, body),
  patch: <T>(path: string, params?: Params) => request<T>(path, "PATCH", params),
  del: <T>(path: string, params?: Params) => request<T>(path, "DELETE", params),
};
