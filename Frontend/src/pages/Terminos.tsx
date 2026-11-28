import React from "react";
import { Link } from "react-router-dom";
import LegalLayout from "../components/LegalLayout";
import type { SeccionLegal } from "../components/LegalLayout";

const SECCIONES: SeccionLegal[] = [
  { id: "descripcion", titulo: "Qué es SYNCPAGO" },
  { id: "requisitos", titulo: "Requisitos de uso" },
  { id: "cuenta", titulo: "Registro y credenciales" },
  { id: "responsabilidades", titulo: "Responsabilidades del usuario" },
  { id: "recibos", titulo: "Gestión de recibos" },
  { id: "recordatorios", titulo: "Recordatorios y notificaciones" },
  { id: "google", titulo: "Integración con Google Calendar" },
  { id: "disponibilidad", titulo: "Disponibilidad y limitaciones" },
  { id: "uso-adecuado", titulo: "Uso adecuado" },
  { id: "seguridad", titulo: "Seguridad de las cuentas" },
  { id: "propiedad", titulo: "Propiedad intelectual" },
  { id: "terminacion", titulo: "Suspensión y terminación" },
  { id: "cambios", titulo: "Cambios en las condiciones" },
  { id: "legislacion", titulo: "Legislación aplicable" },
  { id: "contacto", titulo: "Contacto" },
];

export default function Terminos() {
  return (
    <LegalLayout titulo="Condiciones del servicio" actualizado="27 de noviembre de 2026" secciones={SECCIONES}>
      <section id="descripcion">
        <h2>1. Qué es SYNCPAGO</h2>
        <p>
          SYNCPAGO es una aplicación web que te ayuda a registrar tus gastos (recibos y facturas), ver su estado y
          recibir recordatorios antes de su vencimiento.
        </p>
        <div className="legal-nota">
          <p>
            SYNCPAGO no es una entidad financiera, un banco ni una plataforma de pagos. No procesa pagos, no mueve
            dinero y no se conecta a tus cuentas bancarias. Marcar un gasto como «pagado» solo cambia su estado dentro
            de la aplicación.
          </p>
        </div>
        <p>
          Al crear una cuenta o usar SYNCPAGO aceptas estas condiciones y la{" "}
          <Link to="/privacidad">Política de privacidad</Link>.
        </p>
      </section>

      <section id="requisitos">
        <h2>2. Requisitos de uso</h2>
        <ul>
          <li>Tener capacidad legal para aceptar estas condiciones.</li>
          <li>Contar con un correo electrónico propio al que tengas acceso, porque ahí te llegan los códigos de verificación.</li>
          <li>Un navegador actualizado y conexión a internet.</li>
        </ul>
      </section>

      <section id="cuenta">
        <h2>3. Registro y credenciales</h2>
        <ul>
          <li>Debes dar datos verdaderos y mantenerlos actualizados.</li>
          <li>Para terminar el registro debes confirmar tu correo con un código de verificación.</li>
          <li>Eres responsable de la contraseña de tu cuenta y de lo que ocurra con ella. No la compartas.</li>
          <li>Si crees que alguien entró a tu cuenta, cambia tu contraseña y avísanos.</li>
        </ul>
      </section>

      <section id="responsabilidades">
        <h2>4. Responsabilidades del usuario</h2>
        <ul>
          <li>La información de tus gastos la escribes tú: eres responsable de que sea correcta y esté al día.</li>
          <li>Debes revisar tus fechas de vencimiento y pagar a tiempo. SYNCPAGO es una ayuda, no reemplaza tu control.</li>
          <li>Eres responsable de las decisiones que tomes con base en la información de la aplicación.</li>
        </ul>
      </section>

      <section id="recibos">
        <h2>5. Gestión de recibos</h2>
        <p>
          Puedes crear, editar, marcar como pagados, cancelar y eliminar tus gastos, ver su historial y exportarlo.
          Eliminar un gasto es definitivo. Los estados «vencido» y similares se calculan a partir de la fecha que
          registraste.
        </p>
      </section>

      <section id="recordatorios">
        <h2>6. Recordatorios y notificaciones</h2>
        <p>
          SYNCPAGO puede enviarte recordatorios por los medios opcionales que actives (Telegram y Google Calendar), con
          la antelación que configures.
        </p>
        <div className="legal-aviso">
          <p>
            No prometemos que cada recordatorio se entregue siempre ni a tiempo. Dependen de la disponibilidad de la
            infraestructura donde corre la aplicación y de servicios de terceros como Telegram y Google, que pueden
            fallar o retrasarse. No dependas únicamente de los recordatorios para cumplir tus pagos.
          </p>
        </div>
      </section>

      <section id="google">
        <h2>7. Integración con Google Calendar</h2>
        <ul>
          <li>Es opcional: puedes usar SYNCPAGO sin conectarla.</li>
          <li>
            Pedimos un único permiso, <code>https://www.googleapis.com/auth/calendar.app.created</code>, que solo
            permite a SYNCPAGO administrar el calendario «SYNCPAGO» que crea y sus eventos. No da acceso a tu
            calendario personal ni a tus otros calendarios.
          </li>
          <li>Puedes desconectarla cuando quieras desde Recordatorios, o retirar el permiso desde tu cuenta de Google.</li>
          <li>Al desconectar, el calendario «SYNCPAGO» y sus eventos se eliminan de tu cuenta de Google.</li>
        </ul>
        <p>
          Más detalles sobre qué datos se usan y cómo se protegen en la <Link to="/privacidad">Política de privacidad</Link>.
        </p>
      </section>

      <section id="disponibilidad">
        <h2>8. Disponibilidad y limitaciones</h2>
        <ul>
          <li>El servicio se ofrece «tal como está», sin garantía de funcionamiento continuo o sin errores.</li>
          <li>
            Puede haber interrupciones por mantenimiento, fallas del alojamiento, de la base de datos o de servicios de
            terceros. Algunos servicios gratuitos se suspenden por inactividad, por lo que la primera visita puede
            tardar en responder.
          </li>
          <li>Podemos cambiar, limitar o retirar funciones.</li>
          <li>En lo que la ley permita, no respondemos por pérdidas derivadas de interrupciones, retrasos o fallos en los recordatorios.</li>
        </ul>
      </section>

      <section id="uso-adecuado">
        <h2>9. Uso adecuado</h2>
        <p>Está prohibido:</p>
        <ul>
          <li>Intentar entrar a cuentas ajenas o saltarse las medidas de seguridad.</li>
          <li>Enviar muchas solicitudes automáticas o hacer cualquier cosa que afecte el funcionamiento del servicio.</li>
          <li>Usar la aplicación para actividades ilegales o para perjudicar a otras personas.</li>
          <li>Copiar, revender o explotar la aplicación sin autorización.</li>
        </ul>
      </section>

      <section id="seguridad">
        <h2>10. Seguridad de las cuentas</h2>
        <p>
          La aplicación aplica medidas como contraseñas protegidas, bloqueo temporal tras intentos fallidos, códigos de
          verificación de un solo uso y una sola sesión activa por cuenta. Aun así, la seguridad también depende de ti:
          usa una contraseña segura, no la compartas y cierra sesión en equipos que no sean tuyos. Más información en
          la <Link to="/privacidad">Política de privacidad</Link>.
        </p>
      </section>

      <section id="propiedad">
        <h2>11. Propiedad intelectual</h2>
        <p>
          El nombre SYNCPAGO, el diseño y el código de la aplicación fueron desarrollados como proyecto académico por
          José Castillo, Mariana Castellanos y Sofía Martín, quienes son titulares conjuntos de los derechos de autor.
          Estas condiciones no te transfieren ningún derecho sobre ellos, salvo el de usar la aplicación según lo aquí
          descrito. La información de tus gastos sigue siendo tuya.
        </p>
      </section>

      <section id="terminacion">
        <h2>12. Suspensión y terminación</h2>
        <ul>
          <li>Puedes dejar de usar SYNCPAGO y pedir la eliminación de tu cuenta en cualquier momento (ver la Política de privacidad).</li>
          <li>Podemos suspender o cerrar una cuenta que incumpla estas condiciones o ponga en riesgo la seguridad del servicio.</li>
          <li>
            Cuentas inactivas: si pasan 90 días sin que inicies sesión, te enviaremos un aviso a tu correo y tendrás 15
            días más para volver a entrar. Si inicias sesión en ese plazo, tu cuenta se conserva; si no, la cuenta y sus
            datos se eliminan automáticamente (ver la Política de privacidad).
          </li>
          <li>Si el servicio se termina, intentaremos avisar con anticipación razonable.</li>
        </ul>
      </section>

      <section id="cambios">
        <h2>13. Cambios en las condiciones</h2>
        <p>
          Podemos modificar estas condiciones. La fecha de «Última actualización» indica la versión vigente. Si sigues
          usando SYNCPAGO después de un cambio, se entiende que lo aceptas; si el cambio es importante, lo avisaremos
          en la aplicación.
        </p>
      </section>

      <section id="legislacion">
        <h2>14. Legislación aplicable</h2>
        <p>
          Estas condiciones se rigen por las leyes de la República de Colombia, incluida la Ley 1581 de 2012 sobre
          protección de datos personales. Cualquier diferencia se intentará resolver primero de manera directa y, si
          no es posible, ante los jueces competentes de Bogotá D.C., Colombia.
        </p>
      </section>

      <section id="contacto">
        <h2>15. Contacto</h2>
        <p>
          Equipo desarrollador: José Castillo, Mariana Castellanos y Sofía Martín (Bogotá D.C., Colombia)
          <br />
          Correo: <a href="mailto:syncpago@gmail.com">syncpago@gmail.com</a>
        </p>
      </section>
    </LegalLayout>
  );
}
