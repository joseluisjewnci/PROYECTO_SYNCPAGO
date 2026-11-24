import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { usuariosService } from "../services/usuariosService";
import { guardarToken } from "../services/sesion";

// Mi perfil: aquí el usuario cambia su contraseña.
export default function Perfil() {
  const { usuario } = useAuth();
  const { mostrarToast } = useToast();

  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [guardandoClave, setGuardandoClave] = useState(false);

  // Mismas reglas que el servidor: 8 caracteres, una mayúscula y un número
  function validarNueva(): string {
    if (!actual) return "Escribe tu contraseña actual.";
    if (nueva.length < 8) return "La contraseña nueva debe tener al menos 8 caracteres.";
    if (!/[A-Z]/.test(nueva)) return "La contraseña nueva debe incluir al menos una mayúscula.";
    if (!/[0-9]/.test(nueva)) return "La contraseña nueva debe incluir al menos un número.";
    if (nueva === actual) return "La contraseña nueva debe ser distinta a la actual.";
    if (nueva !== confirmar) return "Las contraseñas nuevas no coinciden.";
    return "";
  }

  async function cambiarContrasena(e: React.FormEvent) {
    e.preventDefault();
    if (guardandoClave) return;
    const problema = validarNueva();
    setError(problema);
    if (problema) return;
    setGuardandoClave(true);
    try {
      const r = await usuariosService.cambiarContrasena(actual, nueva);
      guardarToken(r.token); // el servidor cerró las demás sesiones; este navegador sigue con el token nuevo
      setActual("");
      setNueva("");
      setConfirmar("");
      mostrarToast("Contraseña actualizada ✓ (se cerró tu sesión en otros dispositivos)");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.");
    } finally {
      setGuardandoClave(false);
    }
  }

  return (
    <>
      <div className="perm-card">
        <h3>🔒 Cambiar contraseña</h3>
        <p>{usuario?.correo}</p>
        <p>Por seguridad te pedimos la contraseña actual. Al cambiarla, se cierra tu sesión en los demás dispositivos.</p>
        <form className="perfil-form" onSubmit={cambiarContrasena}>
          <div className="form-field">
            <label>Contraseña actual</label>
            <input type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} />
          </div>
          <div className="form-field">
            <label>Contraseña nueva</label>
            <input type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} />
            <p className="perfil-ayuda">Mínimo 8 caracteres, con una mayúscula y un número.</p>
          </div>
          <div className="form-field">
            <label>Confirmar contraseña nueva</label>
            <input type="password" autoComplete="new-password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
          </div>
          {error && <p className="perfil-error">{error}</p>}
          <button type="submit" className="btn-save" disabled={guardandoClave}>
            {guardandoClave ? "Guardando..." : "Cambiar contraseña"}
          </button>
        </form>
      </div>
    </>
  );
}
