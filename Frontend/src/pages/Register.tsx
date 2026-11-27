import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usuariosService } from "../services/usuariosService";
import type { RegistroIniciado } from "../interfaces/usuario";
import PantallaCarga from "../components/PantallaCarga";
import { esperar } from "../utils/pantallaCarga";

export default function Register() {
  const navigate = useNavigate();

  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [registroOk, setRegistroOk] = useState(false);
  const [pendiente, setPendiente] = useState<RegistroIniciado | null>(null);
  const [codigo, setCodigo] = useState("");
  const [tokenTelegram, setTokenTelegram] = useState("");

  // PASO 1: botón "Confirmar datos" (valida y envía el token al correo; todavía no crea la cuenta)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!nombre || !correo || !contrasena) {
      setError("Nombre, correo y contraseña son obligatorios.");
      return;
    }
    if (contrasena !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (telefono && !/^[0-9]{10}$/.test(telefono)) {
      setError("El teléfono debe tener exactamente 10 dígitos numéricos.");
      return;
    }

    setCargando(true);
    try {
      const resultado = await usuariosService.iniciarRegistro(nombre, correo, contrasena, telefono || undefined);
      setPendiente(resultado);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrarte.");
    } finally {
      setCargando(false);
    }
  }

  // PASO 2: botón "Verificar código" (si es correcto, el backend crea la cuenta)
  async function handleVerificar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!pendiente || cargando || registroOk) return;

    if (!/^[0-9]{6}$/.test(codigo.trim())) {
      setError("Escribe el código de 6 dígitos que enviamos a tu correo.");
      return;
    }

    if (pendiente.requiere_telegram && !tokenTelegram.trim()) {
      setError("Pega el código de 8 caracteres que te dio el bot de Telegram al compartir tu número.");
      return;
    }

    setCargando(true);
    try {
      await usuariosService.confirmarRegistro(pendiente.token_pendiente, codigo.trim(), pendiente.requiere_telegram ? tokenTelegram.trim() : undefined);
      setRegistroOk(true);
      await esperar();
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo verificar el código.");
    } finally {
      setCargando(false);
    }
  }

  function volverAlFormulario() {
    setPendiente(null);
    setCodigo("");
    setTokenTelegram("");
    setError("");
  }

  // SEGUNDA INTERFAZ: un solo campo con el código de 6 dígitos que llegó al correo
  if (pendiente) {
    return (
      <div className="auth-screen">
        {registroOk && <PantallaCarga mensaje="Registro exitoso" detalle="Tu cuenta está lista. Te llevamos al inicio de sesión…" />}
        <div className="auth-inner">
          <div className="auth-logo">
            SYNC<span>PAGO</span>
          </div>
          <div className="auth-card">
            <h1>Verifica tu correo</h1>
            <div className="info-box">{`Te enviamos un código de 6 dígitos a ${correo}. Escríbelo abajo; es válido por ${pendiente.expira_minutos} minutos. Si no lo ves, revisa la carpeta de spam.`}</div>
            <form onSubmit={handleVerificar}>
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
                {error && <span className="field-error">{error}</span>}
              </div>
              {pendiente.requiere_telegram && (
                <>
                  <div className="info-box">
                    {`Como indicaste un teléfono, compruébalo con Telegram: abre el bot, pulsa «Iniciar», luego «Compartir mi número», y pega aquí el código de 8 caracteres que te envíe. `}
                    {pendiente.bot_url && <a href={pendiente.bot_url} target="_blank" rel="noopener noreferrer">Abrir el bot de Telegram</a>}
                  </div>
                  <div className="field-group">
                    <span className="icon">✈</span>
                    <input
                      type="text"
                      placeholder="Código de Telegram (8 caracteres)"
                      maxLength={8}
                      autoComplete="off"
                      value={tokenTelegram}
                      onChange={(e) => setTokenTelegram(e.target.value.trim().toUpperCase())}
                    />
                  </div>
                </>
              )}
              <button className="btn-primary" type="submit" disabled={cargando}>
                {cargando ? "Verificando..." : "Verificar código"}
              </button>
              <button
                type="button"
                className="forgot-link"
                style={{ background: "none", border: "none", width: "100%", fontFamily: "inherit" }}
                onClick={volverAlFormulario}
                disabled={cargando}
              >
                Volver y corregir mis datos
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-inner">
        <div className="auth-logo">
          SYNC<span>PAGO</span>
        </div>
        <div className="auth-card">
          <h1>Crear cuenta</h1>
          <form onSubmit={handleSubmit}>
            <div className="field-group">
              <span className="icon">👤</span>
              <input
                type="text"
                placeholder="Nombre completo"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
            <div className="field-group">
              <span className="icon">✉</span>
              <input
                type="email"
                placeholder="Correo electrónico"
                value={correo}
                onChange={(e) => setCorreo(e.target.value.toLowerCase())}
                autoCapitalize="none"
              />
            </div>
            <div className="field-group">
              <span className="icon">📱</span>
              <input
                type="tel"
                placeholder="Teléfono (opcional, 10 dígitos)"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                maxLength={10}
              />
            </div>
            <div className="field-group">
              <span className="icon">🔒</span>
              <input
                type="password"
                placeholder="Contraseña"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
              />
            </div>
            <div className={`field-group${error ? " error" : ""}`}>
              <span className="icon">🔒</span>
              <input
                type="password"
                placeholder="Confirmar contraseña"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
              />
              {error && <span className="field-error">{error}</span>}
            </div>
            <button className="btn-primary" type="submit" disabled={cargando}>
              {cargando ? "Enviando..." : "Confirmar datos"}
            </button>
          </form>
        </div>
        <p className="auth-link">
          ¿Ya tienes cuenta? <Link to="/">Inicia sesión</Link>
        </p>
        <p className="auth-legal">
          Al registrarte aceptas las <Link to="/terminos">Condiciones del servicio</Link> y la <Link to="/privacidad">Política de privacidad</Link>.
        </p>
      </div>
    </div>
  );
}
