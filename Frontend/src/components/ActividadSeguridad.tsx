import React, { useEffect, useState } from "react";
import { seguridadService } from "../services/seguridadService";
import type { EventoSeguridad } from "../interfaces/seguridad";
import { formatDateTime } from "../utils/format";

// Texto en español para cada tipo de evento que guarda el backend (utils/auditoria.py).
const TEXTOS: Record<string, string> = {
  LOGIN_OK: "Inicio de sesión",
  LOGIN_FALLIDO: "Intento de inicio de sesión fallido",
  LOGIN_BLOQUEADO: "Intento con la cuenta bloqueada",
  CUENTA_BLOQUEADA: "Cuenta bloqueada por intentos fallidos",
  LOGOUT: "Cierre de sesión",
  REGISTRO_CONFIRMADO: "Cuenta creada",
  CODIGO_INVALIDO: "Código de verificación incorrecto",
  RECUPERACION_SOLICITADA: "Recuperación de contraseña solicitada",
  CONTRASENA_CAMBIADA: "Contraseña cambiada",
  CAMBIO_CLAVE_FALLIDO: "Intento fallido de cambio de contraseña",
  TELEFONO_VERIFICADO: "Teléfono verificado",
  TELEGRAM_VINCULADO: "Telegram vinculado",
  TELEGRAM_DESVINCULADO: "Telegram desvinculado",
  GOOGLE_CONECTADO: "Google Calendar conectado",
  GOOGLE_DESCONECTADO: "Google Calendar desconectado",
};

// Actividad reciente de la cuenta: sirve para detectar accesos que el usuario no reconoce.
export default function ActividadSeguridad() {
  const [eventos, setEventos] = useState<EventoSeguridad[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;
    seguridadService
      .eventos(20)
      .then((datos) => {
        if (activo) setEventos(datos);
      })
      .catch((err) => {
        if (activo) setError(err instanceof Error ? err.message : "No se pudo cargar la actividad");
      });
    return () => {
      activo = false;
    };
  }, []);

  return (
    <div className="perm-card">
      <h3>🛡 Actividad de seguridad de tu cuenta</h3>
      <p>Tus últimos 20 movimientos. Si ves un inicio de sesión que no reconoces, cambia tu contraseña desde «Olvidé mi contraseña».</p>
      {error && <p style={{ color: "var(--red)" }}>{error}</p>}
      {!error && eventos === null && <p>Cargando...</p>}
      {eventos !== null && eventos.length === 0 && <p style={{ color: "var(--gray-400)" }}>Todavía no hay actividad registrada.</p>}
      {eventos !== null && eventos.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Evento</th>
              <th>Resultado</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((e, i) => (
              <tr key={e.fecha + e.tipo + i}>
                <td>{formatDateTime(e.fecha)}</td>
                <td title={e.detalle ?? ""}>{TEXTOS[e.tipo] ?? e.tipo}</td>
                <td><span className={`badge ${e.exito ? "badge-green" : "badge-red"}`}>{e.exito ? "Correcto" : "Fallido"}</span></td>
                <td>{e.ip ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
