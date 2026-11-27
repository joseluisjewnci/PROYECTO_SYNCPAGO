import React, { useEffect } from "react";
import { Link } from "react-router-dom";

export interface SeccionLegal {
  id: string;
  titulo: string;
}

interface LegalLayoutProps {
  titulo: string;
  actualizado: string;
  secciones: SeccionLegal[];
  children: React.ReactNode;
}

// Estructura común de las páginas públicas (privacidad y condiciones): encabezado con el logo,
// título, índice con enlaces internos, el texto y un pie con enlaces a ambos documentos.
export default function LegalLayout({ titulo, actualizado, secciones, children }: LegalLayoutProps) {
  // El título de la pestaña cambia mientras se está en la página y vuelve al anterior al salir
  useEffect(() => {
    const anterior = document.title;
    document.title = `${titulo} — SYNCPAGO`;
    window.scrollTo(0, 0);
    return () => {
      document.title = anterior;
    };
  }, [titulo]);

  return (
    <div className="legal-page">
      <a className="legal-saltar" href="#contenido">
        Saltar al contenido
      </a>

      <header className="legal-header">
        <div className="legal-header-in">
          <Link to="/" className="legal-logo" aria-label="SYNCPAGO, ir al inicio">
            SYNC<span>PAGO</span>
          </Link>
          <Link to="/" className="legal-volver">
            ← Volver al inicio de sesión
          </Link>
        </div>
      </header>

      <main className="legal-main">
        <div className="legal-intro">
          <h1>{titulo}</h1>
          <p className="legal-fecha">Última actualización: {actualizado}</p>
        </div>

        <div className="legal-cuerpo">
          <nav className="legal-indice" aria-label="Índice de contenidos">
            <h2>Contenido</h2>
            <ol>
              {secciones.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.titulo}</a>
                </li>
              ))}
            </ol>
          </nav>

          <article id="contenido" className="legal-texto" tabIndex={-1}>
            {children}
          </article>
        </div>
      </main>

      <footer className="legal-pie">
        <nav aria-label="Documentos legales">
          <Link to="/privacidad">Política de privacidad</Link>
          <Link to="/terminos">Condiciones del servicio</Link>
          <Link to="/">Iniciar sesión</Link>
        </nav>
        <p>© {new Date().getFullYear()} SYNCPAGO</p>
      </footer>
    </div>
  );
}
