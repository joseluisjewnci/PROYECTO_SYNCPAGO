import { api } from "./api";
import type { Usuario, RegistroIniciado, RecuperacionIniciada, SesionIniciada, TokenRenovado } from "../interfaces/usuario";

export const usuariosService = {
  login(correo: string, contrasena: string) {
    return api.postJson<SesionIniciada>("/usuarios/login", { correo: correo.trim().toLowerCase(), contrasena });
  },

  // Registro, paso 1: valida los datos y envía el token al correo (todavía NO crea la cuenta)
  iniciarRegistro(nombre: string, correo: string, contrasena: string, telefono?: string) {
    return api.postJson<RegistroIniciado>("/usuarios/registro/iniciar", {
      nombre,
      correo: correo.trim().toLowerCase(),
      contrasena,
      telefono,
    });
  },

  // Registro, paso 2: verifica el código de 6 dígitos y, si es correcto, crea la cuenta
  confirmarRegistro(tokenPendiente: string, codigo: string, tokenTelegram?: string) {
    return api.postJson<Usuario>("/usuarios/registro/confirmar", {
      token_pendiente: tokenPendiente,
      codigo,
      token_telegram: tokenTelegram || undefined,
    });
  },

  // Recuperación, paso 1: pide el código por correo y recibe el "sobre" firmado que se envía en el paso 2
  solicitarRecuperacion(correo: string) {
    return api.postJson<RecuperacionIniciada>("/usuarios/recuperar/solicitar", { correo: correo.trim().toLowerCase() });
  },

  // Recuperación, paso 2: verifica el código y cambia la contraseña
  confirmarRecuperacion(tokenRecuperacion: string, codigo: string, contrasenaNueva: string) {
    return api.postJson<null>("/usuarios/recuperar/confirmar", {
      token_recuperacion: tokenRecuperacion,
      codigo,
      contrasena_nueva: contrasenaNueva,
    });
  },

  // Valida el token guardado y devuelve al usuario dueño de la sesión
  me() {
    return api.get<Usuario>("/usuarios/me");
  },

  // Pide un token nuevo (sesión deslizante)
  renovar() {
    return api.post<TokenRenovado>("/usuarios/renovar");
  },

  // Invalida la sesión en el servidor
  cerrarSesion() {
    return api.post<null>("/usuarios/logout");
  },

  obtener(idUsuario: number) {
    return api.get<Usuario>(`/usuarios/${idUsuario}`);
  },
};
