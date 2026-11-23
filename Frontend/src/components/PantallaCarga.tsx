import type { CSSProperties } from "react";
import { PANTALLA_CARGA_MS } from "../utils/pantallaCarga";

// Pantalla completa que se muestra tras iniciar sesión o registrarse.
// Usa la identidad de SYNCPAGO: fondo azul, marca con «PAGO» en verde y una moneda que se
// transforma en un visto bueno mientras un anillo se llena durante PANTALLA_CARGA_MS.
interface Props {
  mensaje: string;
  detalle?: string;
}

export default function PantallaCarga({ mensaje, detalle }: Props) {
  // La duración de todas las animaciones sale de una sola constante (no hay números repetidos en el CSS)
  const estilo = { "--carga-ms": PANTALLA_CARGA_MS + "ms" } as CSSProperties;

  return (
    <div className="pantalla-carga" role="status" aria-live="polite" style={estilo}>
      <div className="carga-contenido">
        <div className="carga-marca">
          SYNC<span>PAGO</span>
        </div>

        <div className="carga-insignia" aria-hidden="true">
          <div className="carga-orbita">
            <span className="carga-moneda carga-moneda-1" />
            <span className="carga-moneda carga-moneda-2" />
            <span className="carga-moneda carga-moneda-3" />
          </div>

          <svg className="carga-anillo" viewBox="0 0 120 120">
            <circle className="carga-anillo-fondo" cx="60" cy="60" r="52" />
            <circle className="carga-anillo-avance" cx="60" cy="60" r="52" pathLength="100" />
          </svg>

          <div className="carga-centro">
            <span className="carga-signo">$</span>
            <svg className="carga-visto" viewBox="0 0 64 64">
              <path d="M16 34 L28 46 L49 21" pathLength="1" />
            </svg>
          </div>
        </div>

        <p className="carga-titulo">{mensaje}</p>
        {detalle && <p className="carga-detalle">{detalle}</p>}
      </div>
    </div>
  );
}
