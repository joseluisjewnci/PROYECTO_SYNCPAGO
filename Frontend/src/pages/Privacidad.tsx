import React from "react";
import LegalLayout from "../components/LegalLayout";
import type { SeccionLegal } from "../components/LegalLayout";

const SECCIONES: SeccionLegal[] = [
  { id: "quienes-somos", titulo: "Quiénes somos y para qué sirve SYNCPAGO" },
  { id: "datos", titulo: "Información que recopilamos" },
  { id: "finalidad", titulo: "Para qué usamos tus datos" },
  { id: "proteccion", titulo: "Almacenamiento y protección" },
  { id: "terceros-servicios", titulo: "Servicios externos que usamos" },
  { id: "google-calendar", titulo: "Integración con Google Calendar" },
  { id: "tokens-google", titulo: "Tokens de Google: uso y protección" },
  { id: "compartir", titulo: "Compartición con terceros" },
  { id: "conservacion", titulo: "Conservación y eliminación" },
  { id: "derechos", titulo: "Tus derechos" },
  { id: "solicitudes", titulo: "Cómo hacer una solicitud o pedir la eliminación" },
  { id: "menores", titulo: "Menores de edad" },
  { id: "cambios", titulo: "Cambios en esta política" },
  { id: "contacto", titulo: "Contacto" },
];

const PENDIENTE = (texto: string) => <mark className="legal-pendiente">[{texto}]</mark>;

export default function Privacidad() {
  return (
    <LegalLayout titulo="Política de privacidad" actualizado="25 de noviembre de 2026" secciones={SECCIONES}>
      <div className="legal-aviso">
        <p>
          Los datos marcados como {PENDIENTE("PENDIENTE")} los debe completar el responsable de SYNCPAGO antes de dar
          este documento por definitivo.
        </p>
      </div>

      <section id="quienes-somos">
        <h2>1. Quiénes somos y para qué sirve SYNCPAGO</h2>
        <p>
          SYNCPAGO es una aplicación web para registrar gastos (recibos y facturas), llevar el control de su estado de
          pago y recibir recordatorios antes de que venzan. No es una entidad financiera, no es un banco ni una
          plataforma de pagos: la aplicación no procesa pagos ni mueve dinero.
        </p>
        <p>
          El responsable del tratamiento de los datos personales es {PENDIENTE("NOMBRE DEL RESPONSABLE")}, ubicado en
          Colombia. Para cualquier consulta escribe a {PENDIENTE("CORREO DE CONTACTO")}.
        </p>
      </section>

      <section id="datos">
        <h2>2. Información que recopilamos</h2>
        <h3>2.1 Datos de registro y de tu cuenta</h3>
        <ul>
          <li>Nombre y correo electrónico.</li>
          <li>Número de teléfono (opcional).</li>
          <li>
            Contraseña: nunca se guarda tal cual la escribes; se almacena transformada con un algoritmo de protección
            de contraseñas (Argon2id).
          </li>
        </ul>
        <h3>2.2 Información de tus gastos (recibos)</h3>
        <ul>
          <li>Categoría y detalle del gasto, valor, fecha y hora de vencimiento y estado (pendiente, pagado, vencido o cancelado).</li>
          <li>Con cuánta antelación quieres que se te recuerde cada gasto.</li>
          <li>El presupuesto mensual que decidas registrar.</li>
          <li>El historial de cambios de estado de cada gasto.</li>
        </ul>
        <p>Esta información la escribes tú. SYNCPAGO no se conecta a tus cuentas bancarias ni lee tus movimientos.</p>
        <h3>2.3 Datos técnicos y de seguridad</h3>
        <ul>
          <li>
            Un registro de eventos de seguridad: inicios y cierres de sesión, intentos fallidos, bloqueos temporales,
            cambios de contraseña y conexión de servicios opcionales. Cada evento guarda su tipo, la fecha, el correo
            involucrado, la dirección IP desde la que se hizo y una nota corta.
          </li>
          <li>Este registro no guarda contraseñas, códigos de verificación ni tokens.</li>
          <li>Tu navegador guarda en su almacenamiento local la sesión iniciada, para que no tengas que entrar en cada visita.</li>
        </ul>
        <h3>2.4 Datos de Telegram (opcional)</h3>
        <p>
          Si vinculas Telegram guardamos el identificador de tu chat, si activaste o no los avisos, si tu número fue
          comprobado y qué clases de gasto quieres recibir.
        </p>
        <h3>2.5 Datos de Google Calendar (opcional)</h3>
        <p>
          Si conectas Google Calendar guardamos las credenciales de la conexión (ver el punto 7) y el identificador del
          calendario que SYNCPAGO crea en tu cuenta de Google.
        </p>
      </section>

      <section id="finalidad">
        <h2>3. Para qué usamos tus datos</h2>
        <ul>
          <li>Crear y administrar tu cuenta e identificarte cuando inicias sesión.</li>
          <li>Mostrarte tus gastos, su historial, tus estadísticas y permitirte exportarlos.</li>
          <li>Enviarte por correo los códigos de verificación del registro y de la recuperación de contraseña.</li>
          <li>Enviarte recordatorios por los medios que actives: Telegram y Google Calendar.</li>
          <li>Proteger tu cuenta y detectar usos indebidos, como intentos repetidos de entrar.</li>
          <li>Atender tus consultas y solicitudes sobre tus datos.</li>
        </ul>
        <p>No vendemos tus datos ni los usamos para publicidad.</p>
      </section>

      <section id="proteccion">
        <h2>4. Almacenamiento y protección</h2>
        <p>
          Tus datos se guardan en una base de datos PostgreSQL. Estas son las medidas que la aplicación aplica
          actualmente:
        </p>
        <ul>
          <li>Las contraseñas se guardan con Argon2id, no en texto legible.</li>
          <li>
            La sesión usa un token firmado que caduca por inactividad y que se invalida en el servidor al cerrar
            sesión. Solo hay una sesión activa por cuenta.
          </li>
          <li>Los códigos de verificación son de 6 dígitos, vencen en pocos minutos, tienen intentos limitados y se usan una sola vez.</li>
          <li>Tras varios intentos fallidos de inicio de sesión, la cuenta se bloquea durante un tiempo.</li>
          <li>
            El token de actualización de Google se guarda cifrado, con una clave que no está almacenada en la base de
            datos.
          </li>
          <li>La aplicación publicada se sirve por HTTPS, que cifra la comunicación entre tu navegador y el servicio.</li>
        </ul>
        <p>
          Ninguna medida es infalible, por lo que no podemos garantizar una seguridad absoluta. Si detectas algo
          extraño en tu cuenta, cambia tu contraseña y avísanos.
        </p>
      </section>

      <section id="terceros-servicios">
        <h2>5. Servicios externos que usamos</h2>
        <p>Para funcionar, SYNCPAGO se apoya en estos servicios de terceros:</p>
        <ul>
          <li>Render, para alojar la aplicación web (frontend).</li>
          <li>{PENDIENTE("PROVEEDOR DE ALOJAMIENTO DEL BACKEND")}, para alojar el servidor de la aplicación.</li>
          <li>{PENDIENTE("PROVEEDOR DE BASE DE DATOS")}, donde se almacena la base de datos.</li>
          <li>{PENDIENTE("PROVEEDOR DE CORREO")}, para enviar los códigos de verificación por correo.</li>
          <li>Telegram, solo si vinculas tu cuenta, para enviarte recordatorios.</li>
          <li>Google Calendar, solo si lo conectas, para crear tus eventos de vencimiento.</li>
          <li>
            Google Fonts, para cargar las tipografías de la página. Al cargarlas, Google puede recibir la dirección IP
            de tu navegador.
          </li>
        </ul>
      </section>

      <section id="google-calendar">
        <h2>6. Integración con Google Calendar</h2>
        <p>
          Conectar Google Calendar es opcional. Sirve para que tus vencimientos aparezcan como eventos con aviso en tu
          calendario.
        </p>
        <h3>Permiso que solicitamos</h3>
        <p>
          SYNCPAGO pide un único permiso de Google: <code>https://www.googleapis.com/auth/calendar.app.created</code>
        </p>
        <p>
          Este permiso solo deja a la aplicación crear y administrar los calendarios que ella misma crea, y los
          eventos de esos calendarios. No permite leer ni modificar tu calendario personal ni tus otros calendarios.
        </p>
        <h3>Qué hace la aplicación con ese permiso</h3>
        <ul>
          <li>Crea en tu cuenta un calendario secundario llamado «SYNCPAGO».</li>
          <li>
            Crea en él un evento por cada gasto pendiente, con el título «Pago: detalle - $valor», una descripción con
            los datos del gasto, la fecha de vencimiento y el aviso previo que configuraste.
          </li>
          <li>Actualiza el evento si editas el gasto. Si cambias el evento directamente en Google, el cambio se sobrescribe al editar el gasto.</li>
          <li>Elimina el evento cuando el gasto se marca como pagado o cancelado, o se elimina.</li>
        </ul>
        <p>
          El uso y la transferencia a cualquier otra aplicación de la información recibida de las API de Google se
          ajustan a la{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
            Política de datos de usuario de los servicios de las API de Google
          </a>
          , incluidos los requisitos de uso limitado.
        </p>
      </section>

      <section id="tokens-google">
        <h2>7. Tokens de Google: uso y protección</h2>
        <ul>
          <li>
            Al aceptar la conexión, Google entrega a SYNCPAGO un token de actualización. Es lo que permite crear y
            actualizar los eventos sin pedirte permiso cada vez.
          </li>
          <li>Ese token se guarda cifrado en la base de datos. Solo se descifra en el servidor, en el momento de usarlo.</li>
          <li>
            Los tokens de acceso, de corta duración, se piden a Google cuando se necesitan y solo se mantienen en la
            memoria del servidor mientras son válidos; no se guardan en la base de datos.
          </li>
          <li>Los tokens no se muestran en la aplicación, no se registran en el registro de eventos y no se comparten.</li>
        </ul>
        <h3>Cómo desconectar</h3>
        <p>
          En la página Recordatorios puedes desconectar Google Calendar cuando quieras. Al hacerlo, SYNCPAGO borra de
          tu cuenta de Google el calendario «SYNCPAGO» con sus eventos, revoca el permiso en Google y elimina de
          nuestra base de datos los datos de la conexión. También puedes retirar el permiso desde la configuración de
          tu cuenta de Google.
        </p>
      </section>

      <section id="compartir">
        <h2>8. Compartición con terceros</h2>
        <p>
          No vendemos ni cedemos tus datos. Solo llegan a terceros los datos necesarios para que funcionen los
          servicios del punto 5. También podríamos entregar información si una autoridad competente lo exige conforme
          a la ley.
        </p>
      </section>

      <section id="conservacion">
        <h2>9. Conservación y eliminación</h2>
        <ul>
          <li>Conservamos tus datos mientras tu cuenta esté activa.</li>
          <li>
            Cuando pides la eliminación de tu cuenta, borramos tus datos personales y tus gastos, salvo lo que una
            norma nos obligue a conservar.
          </li>
          <li>
            El registro de eventos de seguridad no se borra automáticamente. Plazo de conservación:{" "}
            {PENDIENTE("DEFINIR PLAZO")}.
          </li>
          <li>
            Las copias de seguridad que existan podrían conservar tus datos por un tiempo limitado:{" "}
            {PENDIENTE("DEFINIR PLAZO")}.
          </li>
        </ul>
        <p>Por ahora la eliminación de la cuenta se solicita por correo (punto 11); la aplicación todavía no tiene un botón para hacerlo.</p>
      </section>

      <section id="derechos">
        <h2>10. Tus derechos</h2>
        <p>
          De acuerdo con la Ley 1581 de 2012 y sus normas reglamentarias, como titular de tus datos personales tienes
          derecho a:
        </p>
        <ul>
          <li>Conocer, actualizar y rectificar tus datos personales.</li>
          <li>Solicitar prueba de la autorización que nos diste.</li>
          <li>Ser informado sobre el uso que se ha dado a tus datos.</li>
          <li>Presentar quejas ante la Superintendencia de Industria y Comercio por infracciones a la ley.</li>
          <li>Revocar la autorización y solicitar la supresión de tus datos, cuando proceda conforme a la ley.</li>
          <li>Acceder de forma gratuita a tus datos personales.</li>
        </ul>
      </section>

      <section id="solicitudes">
        <h2>11. Cómo hacer una solicitud o pedir la eliminación</h2>
        <ol>
          <li>Escribe a {PENDIENTE("CORREO DE CONTACTO")} desde el correo con el que te registraste.</li>
          <li>Indica en el asunto qué necesitas: consulta, actualización, reclamo o eliminación de cuenta y datos.</li>
          <li>Incluye tu nombre y el correo de tu cuenta. Podemos pedirte datos para confirmar que eres el titular.</li>
        </ol>
        <p>
          Responderemos las consultas en un máximo de 10 días hábiles y los reclamos en un máximo de 15 días hábiles,
          plazos que la ley permite ampliar en los casos que ella misma señala, y te avisaremos si eso ocurre.
        </p>
      </section>

      <section id="menores">
        <h2>12. Menores de edad</h2>
        <p>SYNCPAGO no está dirigido a menores de edad y no recopilamos sus datos de forma intencional.</p>
      </section>

      <section id="cambios">
        <h2>13. Cambios en esta política</h2>
        <p>
          Podemos actualizar esta política. La fecha de «Última actualización» al inicio indica la versión vigente.
          Si el cambio es importante, lo avisaremos en la aplicación.
        </p>
      </section>

      <section id="contacto">
        <h2>14. Contacto</h2>
        <p>
          Responsable: {PENDIENTE("NOMBRE DEL RESPONSABLE")}
          <br />
          Correo para consultas de privacidad: {PENDIENTE("CORREO DE CONTACTO")}
        </p>
      </section>
    </LegalLayout>
  );
}
