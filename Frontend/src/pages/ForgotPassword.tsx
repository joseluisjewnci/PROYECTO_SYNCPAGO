import React, { useState } from "react";
import { Link } from "react-router-dom";
import { usuariosService } from "../services/usuariosService";

// Recuperación de contraseña en 2 pasos con un código de 6 dígitos:
//   1) el usuario escribe su correo y recibe el código;
//   2) escribe el código y la contraseña nueva.
export default function ForgotPassword() {
  const [paso, setPaso] = useState<1 | 2>(1);
  const [correo, setCorreo] = useState("");
  const [sobre, setSobre] = useState(""); // paquete firmado que entrega el paso 1 y se reenvía en el paso 2
  const [codigo, setCodigo] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [listo, setListo] = useState(false);

  async function pedirToken(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!correo) {
      setError("Escribe tu correo.");
      return;
    }
    setCargando(true);
    try {
      const resultado = await usuariosService.solicitarRecuperacion(correo);
      setSobre(resultado.token_recuperacion);
      setPaso(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el código.");
    } finally {
      setCargando(false);
    }
  }

  async function cambiarContrasena(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^[0-9]{6}$/.test(codigo.trim()) || !nueva) {
      setError("Escribe el código de 6 dígitos de tu correo y la contraseña nueva.");
      return;
    }
    if (nueva !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setCargando(true);
    try {
      await usuariosService.confirmarRecuperacion(sobre, codigo.trim(), nueva);
      setListo(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-inner">
        <div className="auth-logo">
          SYNC<span>PAGO</span>
        </div>
        <div className="auth-card">
          <h1>Recuperar contraseña</h1>
          {listo ? (
            <div className="info-box">Contraseña actualizada. Ya puedes iniciar sesión con la nueva.</div>
          ) : paso === 1 ? (
            <form onSubmit={pedirToken}>
              <div className={`field-group${error ? " error" : ""}`}>
                <span className="icon">✉</span>
                <input
                  type="email"
                  placeholder="Correo electrónico"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                />
                {error && <span className="field-error">{error}</span>}
              </div>
              <button className="btn-primary" type="submit" disabled={cargando}>
                {cargando ? "Enviando..." : "Enviar código"}
              </button>
            </form>
          ) : (
            <form onSubmit={cambiarContrasena}>
              <div className="info-box">Si el correo está registrado, te enviamos un código de 6 dígitos que vence en 5 minutos. Revisa también la carpeta de spam.</div>
              <div className={`field-group${error ? " error" : ""}`}>
                <span className="icon">✉</span>
                <input
                  type="text"
                  placeholder="Código de 6 dígitos"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/[^0-9]/g, ""))}
                />
              </div>
              <div className="field-group">
                <span className="icon">🔒</span>
                <input
                  type="password"
                  placeholder="Contraseña nueva"
                  value={nueva}
                  onChange={(e) => setNueva(e.target.value)}
                />
              </div>
              <div className={`field-group${error ? " error" : ""}`}>
                <span className="icon">🔒</span>
                <input
                  type="password"
                  placeholder="Confirmar contraseña nueva"
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                />
                {error && <span className="field-error">{error}</span>}
              </div>
              <button className="btn-primary" type="submit" disabled={cargando}>
                {cargando ? "Guardando..." : "Cambiar contraseña"}
              </button>
            </form>
          )}
        </div>
        <p className="auth-link">
          <Link to="/">Volver al inicio de sesión</Link>
        </p>
      </div>
    </div>
  );
}
