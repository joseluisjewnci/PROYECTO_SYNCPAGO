import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useToast } from "../hooks/useToast";
import { notificacionesService } from "../services/notificacionesService";
import type { ClaseGasto, EstadoNotificaciones } from "../interfaces/notificaciones";

const CLASES: { valor: ClaseGasto; texto: string }[] = [
  { valor: "vital", texto: "Vitales (servicios, arriendo, salud...)" },
  { valor: "entretenimiento", texto: "Entretenimiento" },
  { valor: "varios", texto: "Varios" },
];

// Panel de métodos de notificación (vive dentro de la página Recordatorios; no hay una página aparte).
// Telegram y Google Calendar son opcionales e independientes; aquí se ve qué está verificado y se verifica lo que falte.
export default function PanelNotificaciones() {
  const { mostrarToast } = useToast();
  const [params, setParams] = useSearchParams();
  const [estado, setEstado] = useState<EstadoNotificaciones | null>(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [esperandoTelegram, setEsperandoTelegram] = useState(false);
  const [esperaTelefono, setEsperaTelefono] = useState(false); // true mientras esperamos que el usuario confirme su número
  const intentosEspera = useRef(0);

  const cargar = useCallback(async () => {
    try {
      setEstado(await notificacionesService.estado());
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : "No se pudo cargar tus notificaciones");
    } finally {
      setCargando(false);
    }
  }, [mostrarToast]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Google vuelve a esta página con ?google=ok|cancelado|error
  useEffect(() => {
    const resultado = params.get("google");
    if (!resultado) return;
    if (resultado === "ok") mostrarToast("Google Calendar conectado ✓");
    else if (resultado === "cancelado") mostrarToast("Cancelaste la conexión con Google");
    else mostrarToast("No se pudo conectar Google Calendar. Inténtalo de nuevo.");
    setParams({}, { replace: true });
    cargar();
  }, [params, setParams, mostrarToast, cargar]);

  // Después de abrir el bot, se consulta cada 3 segundos (máximo ~10 minutos) hasta que quede vinculado
  useEffect(() => {
    if (!esperandoTelegram) return;
    intentosEspera.current = 0;
    const temporizador = window.setInterval(async () => {
      intentosEspera.current += 1;
      try {
        const nuevo = await notificacionesService.estado();
        setEstado(nuevo);
        const listo = esperaTelefono ? nuevo.telefono.verificado : nuevo.telegram.vinculado;
        if (listo) {
          setEsperandoTelegram(false);
          mostrarToast(esperaTelefono ? "Número verificado ✓" : "Telegram vinculado ✓");
        }
      } catch {
        // se reintenta en el siguiente ciclo
      }
      if (intentosEspera.current >= 200) setEsperandoTelegram(false);
    }, 3000);
    return () => window.clearInterval(temporizador);
  }, [esperandoTelegram, esperaTelefono, mostrarToast]);

  // Ejecuta una acción mostrando un mensaje y refrescando el estado
  async function ejecutar(accion: () => Promise<unknown>, mensajeOk: string) {
    setOcupado(true);
    try {
      await accion();
      mostrarToast(mensajeOk);
      await cargar();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : "Ocurrió un error");
    } finally {
      setOcupado(false);
    }
  }

  async function abrirTelegram(paraTelefono = false) {
    setOcupado(true);
    setEsperaTelefono(paraTelefono);
    try {
      const enlace = await notificacionesService.vincularTelegram();
      window.open(enlace.url, "_blank", "noopener,noreferrer");
      setEsperandoTelegram(true);
      mostrarToast("Abre Telegram, pulsa «Iniciar»" + (paraTelefono ? " y luego «Compartir mi número»" : "") + ". El enlace vale " + enlace.expira_minutos + " minutos.");
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : "No se pudo generar el enlace");
    } finally {
      setOcupado(false);
    }
  }

  async function conectarGoogle() {
    setOcupado(true);
    try {
      const enlace = await notificacionesService.iniciarGoogle();
      window.location.href = enlace.url; // Google pide el permiso en su página y luego regresa a esta
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : "No se pudo iniciar la conexión con Google");
      setOcupado(false);
    }
  }

  async function cambiarClase(clase: ClaseGasto, marcada: boolean) {
    if (!estado) return;
    const nuevas = CLASES.map((c) => c.valor).filter((v) => (v === clase ? marcada : estado.clases.includes(v)));
    await ejecutar(() => notificacionesService.guardarPreferencias(nuevas), "Preferencias guardadas ✓");
  }

  if (cargando || !estado) {
    return <p>Cargando tus métodos de notificación...</p>;
  }

  const telegram = estado.telegram;
  const google = estado.google;
  const separacion = { display: "flex", gap: "8px", flexWrap: "wrap" as const, marginTop: "12px" };

  return (
    <>
      <div className="perm-card">
        <h3>✅ Tus métodos de notificación</h3>
        <p>Aquí ves qué está verificado y puedes verificar lo que falte. Todo es opcional salvo el correo.</p>
        <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
          <li>✉ Correo: <span className="badge badge-green">Verificado</span></li>
          <li style={{ marginTop: "6px" }}>
            📱 Teléfono:{" "}
            {estado.telefono.verificado ? (
              <span className="badge badge-green">{`Verificado ••••${estado.telefono.terminacion ?? ""}`}</span>
            ) : (
              <span className="badge badge-gray">{estado.telefono.registrado ? `Sin verificar ••••${estado.telefono.terminacion ?? ""}` : "Sin número"}</span>
            )}
          </li>
          <li style={{ marginTop: "6px" }}>
            ✈ Telegram:{" "}
            <span className={`badge ${telegram.vinculado && telegram.activo ? "badge-green" : "badge-gray"}`}>
              {!telegram.disponible ? "No disponible" : telegram.vinculado ? (telegram.activo ? "Activo" : "Pausado") : "Sin vincular"}
            </span>
          </li>
          <li style={{ marginTop: "6px" }}>
            📅 Google Calendar:{" "}
            <span className={`badge ${google.conectado ? "badge-green" : "badge-gray"}`}>{!google.disponible ? "No disponible" : google.conectado ? "Conectado" : "Sin conectar"}</span>
          </li>
        </ul>
        {telegram.disponible && !estado.telefono.verificado && (
          <div style={separacion}>
            <button className="btn-guardar-presupuesto" onClick={() => abrirTelegram(true)} disabled={ocupado}>
              {estado.telefono.registrado ? "Verificar mi número" : "Verificar con mi número de Telegram"}
            </button>
          </div>
        )}
      </div>

      <div className="perm-card">
        <h3>✉ Correo electrónico</h3>
        <p>Ya verificaste tu correo al registrarte. Lo usamos para enviarte los códigos de verificación y de recuperación de contraseña.</p>
      </div>

      <div className="perm-card">
        <h3>
          ✈ Telegram
          {telegram.vinculado && (
            <span className={`badge ${telegram.activo ? "badge-green" : "badge-gray"}`} style={{ marginLeft: "8px" }}>
              {telegram.activo ? "Activo" : "Pausado"}
            </span>
          )}
        </h3>
        {!telegram.disponible ? (
          <p style={{ color: "var(--gray-400)" }}>Telegram no está habilitado en este servidor.</p>
        ) : (
          <>
            <p>
              {telegram.vinculado
                ? "Tu cuenta de Telegram está vinculada. Los recordatorios de tus gastos pendientes llegarán a tu chat con el bot."
                : "Vincula tu cuenta de Telegram para recibir tus recordatorios. Se abre el bot, pulsas «Iniciar» y listo; el bot te ofrecerá además comprobar tu número (opcional)."}
            </p>
            {esperandoTelegram && (
              <div className="info-box">{esperaTelefono ? "Esperando que compartas tu número en Telegram..." : "Esperando que pulses «Iniciar» en Telegram..."}</div>
            )}
            <div style={separacion}>
              <button className="btn-guardar-presupuesto" onClick={() => abrirTelegram(false)} disabled={ocupado}>
                {telegram.vinculado ? "Vincular otra cuenta" : "Vincular Telegram"}
              </button>
              {telegram.vinculado && (
                <>
                  <button
                    className="btn-save"
                    disabled={ocupado}
                    onClick={() =>
                      ejecutar(
                        telegram.activo ? notificacionesService.desactivarTelegram : notificacionesService.activarTelegram,
                        telegram.activo ? "Avisos por Telegram desactivados" : "Avisos por Telegram activados"
                      )
                    }
                  >
                    {telegram.activo ? "Desactivar" : "Activar"}
                  </button>
                  <button className="btn-save" disabled={ocupado} onClick={() => ejecutar(notificacionesService.probarTelegram, "Mensaje de prueba enviado ✓")}>
                    Enviar mensaje de prueba
                  </button>
                  <button className="btn-danger" disabled={ocupado} onClick={() => ejecutar(notificacionesService.desvincularTelegram, "Telegram desvinculado")}>
                    Desvincular
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <div className="perm-card">
        <h3>
          📅 Google Calendar
          {google.conectado && <span className="badge badge-green" style={{ marginLeft: "8px" }}>Conectado</span>}
        </h3>
        {!google.disponible ? (
          <p style={{ color: "var(--gray-400)" }}>Google Calendar no está configurado en este servidor.</p>
        ) : (
          <>
            <p>
              Tus gastos pendientes se crean como eventos en un calendario propio llamado «SYNCPAGO», con un aviso según tu antelación.
              Si cambias la fecha o el recordatorio, el mismo evento se actualiza; si pagas o eliminas el gasto, se quita.
              Solo pedimos permiso sobre ese calendario: no leemos ni cambiamos tus otros eventos. Zona horaria: {estado.zona_horaria}.
            </p>
            <div style={separacion}>
              {!google.conectado ? (
                <button className="btn-guardar-presupuesto" onClick={conectarGoogle} disabled={ocupado}>
                  Conectar Google Calendar
                </button>
              ) : (
                <>
                  <button className="btn-save" disabled={ocupado} onClick={() => ejecutar(notificacionesService.sincronizarGoogle, "Sincronización iniciada ✓")}>
                    Sincronizar ahora
                  </button>
                  <button className="btn-danger" disabled={ocupado} onClick={() => ejecutar(notificacionesService.desconectarGoogle, "Google Calendar desconectado")}>
                    Desconectar (borra el calendario SYNCPAGO)
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <div className="perm-card">
        <h3>🔔 ¿De qué gastos quieres recibir avisos?</h3>
        <p>Aplica a Telegram y a Google Calendar.</p>
        {CLASES.map((clase) => (
          <label key={clase.valor} style={{ display: "flex", alignItems: "center", gap: "8px", margin: "8px 0" }}>
            <input
              type="checkbox"
              checked={estado.clases.includes(clase.valor)}
              disabled={ocupado}
              onChange={(e) => cambiarClase(clase.valor, e.target.checked)}
            />
            {clase.texto}
          </label>
        ))}
      </div>
    </>
  );
}
