import React, { useEffect, useRef, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import PantallaCarga from "../components/PantallaCarga";

// Envuelve las pantallas para quien aún no inició sesión (acceso, registro y recuperar contraseña).
// Si al abrir la página ya había una sesión válida, lleva directo al dashboard.
export default function RutaPublica() {
  const { usuario, cargando } = useAuth();
  const [tardando, setTardando] = useState(false);
  // Solo cuenta la sesión que ya existía al entrar: así, al iniciar sesión desde el login,
  // se sigue mostrando la pantalla «Sesión iniciada correctamente» antes de pasar al panel.
  const habiaSesion = useRef<boolean | null>(null);

  if (!cargando && habiaSesion.current === null) {
    habiaSesion.current = Boolean(usuario);
  }

  // Si validar la sesión tarda (servidor en reposo), se avisa; si es rápido, no se muestra nada para evitar parpadeos
  useEffect(() => {
    if (!cargando) return;
    const temporizador = window.setTimeout(() => setTardando(true), 800);
    return () => window.clearTimeout(temporizador);
  }, [cargando]);

  if (cargando) {
    return tardando ? (
      <PantallaCarga mensaje="Verificando tu sesión…" detalle="Si el servidor estaba en reposo, puede tardar un poco." />
    ) : null;
  }

  if (habiaSesion.current && usuario) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
