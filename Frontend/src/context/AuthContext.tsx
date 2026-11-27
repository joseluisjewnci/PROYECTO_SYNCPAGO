import React, { createContext, useEffect, useRef, useState } from "react";
import type { Usuario } from "../interfaces/usuario";
import { usuariosService } from "../services/usuariosService";
import { obtenerToken, guardarToken, borrarToken, EVENTO_SESION_EXPIRADA } from "../services/sesion";

// Clave de una versión antigua que guardaba el usuario en el navegador; hoy solo se usa para borrarla
const STORAGE_KEY = "sp_usuario";
const RENOVAR_CADA_MS = 10 * 60 * 1000; // cada cuánto se renueva la sesión (solo si el usuario estuvo activo)
// Si el servidor no responde al abrir la página (por ejemplo, el servidor gratuito despertando), se reintenta
// con estas esperas antes de rendirse. Mientras tanto el token se conserva.
const REINTENTOS_MS = [3000, 6000, 12000, 20000];

interface AuthContextValue {
  usuario: Usuario | null;
  cargando: boolean;
  login: (correo: string, contrasena: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Guarda quién inició sesión y comparte esa información con toda la app.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const hayActividad = useRef(false);

  useEffect(() => {
    // Se elimina el dato antiguo sin token (de versiones previas): ya no es confiable
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* sin almacenamiento */ }
    // Al cargar, el token guardado se valida contra el servidor (no se confía en el navegador)
    if (!obtenerToken()) {
      setCargando(false);
      return;
    }
    let cancelado = false;
    let temporizador: number | undefined;

    function comprobarSesion(intento: number) {
      usuariosService.me()
        .then((datos) => {
          if (cancelado) return;
          setUsuario(datos);
          setCargando(false);
        })
        .catch(() => {
          if (cancelado) return;
          // Si el servidor dijo que el token no sirve (401), api.ts ya lo borró: la sesión terminó.
          // Si fue un fallo de red o del servidor, el token se conserva y se vuelve a intentar.
          if (!obtenerToken() || intento >= REINTENTOS_MS.length) {
            setCargando(false);
            return;
          }
          temporizador = window.setTimeout(() => comprobarSesion(intento + 1), REINTENTOS_MS[intento]);
        });
    }
    comprobarSesion(0);

    return () => {
      cancelado = true;
      window.clearTimeout(temporizador);
    };
  }, []);

  // Si el servidor responde 401 en cualquier llamada, se cierra la sesión en pantalla
  useEffect(() => {
    const alExpirar = () => setUsuario(null);
    window.addEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
    return () => window.removeEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
  }, []);

  // Mientras hay sesión: se detecta actividad y se renueva el token periódicamente
  useEffect(() => {
    if (!usuario) return;
    const marcar = () => { hayActividad.current = true; };
    const eventos = ["click", "keydown", "mousemove", "touchstart"];
    eventos.forEach((e) => window.addEventListener(e, marcar));
    const temporizador = window.setInterval(() => {
      if (!hayActividad.current) return;
      hayActividad.current = false;
      usuariosService.renovar()
        .then((r) => guardarToken(r.token))
        .catch(() => { /* si falla por 401, api.ts ya cierra la sesión */ });
    }, RENOVAR_CADA_MS);
    return () => {
      eventos.forEach((e) => window.removeEventListener(e, marcar));
      window.clearInterval(temporizador);
    };
  }, [usuario]);

  async function login(correo: string, contrasena: string) {
    const sesion = await usuariosService.login(correo, contrasena);
    guardarToken(sesion.token);
    setUsuario(sesion.usuario);
  }

  function logout() {
    // Se avisa al servidor con el token aún presente; se ignora el resultado
    usuariosService.cerrarSesion().catch(() => undefined);
    setUsuario(null);
    borrarToken();
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
