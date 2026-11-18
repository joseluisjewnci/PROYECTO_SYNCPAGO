import React, { useEffect, useRef, useState } from "react";

export interface OpcionMes {
  clave: string; // 'YYYY-MM'
  etiqueta: string; // 'Octubre 2026'
}

interface FiltroMesesProps {
  opciones: OpcionMes[];
  seleccion: string[]; // vacío = todos los meses
  onChange: (seleccion: string[]) => void;
}

// Selector de uno o varios meses (con casillas). Si no hay ninguno marcado
// se muestran los gastos de todos los meses.
export default function FiltroMeses({ opciones, seleccion, onChange }: FiltroMesesProps) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const cerrarAlTocarFuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    const cerrarConEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", cerrarAlTocarFuera);
    document.addEventListener("keydown", cerrarConEscape);
    return () => {
      document.removeEventListener("mousedown", cerrarAlTocarFuera);
      document.removeEventListener("keydown", cerrarConEscape);
    };
  }, [abierto]);

  function alternar(clave: string) {
    onChange(
      seleccion.includes(clave) ? seleccion.filter((c) => c !== clave) : [...seleccion, clave]
    );
  }

  const texto =
    seleccion.length === 0
      ? "Todos los meses"
      : seleccion.length === 1
        ? opciones.find((o) => o.clave === seleccion[0])?.etiqueta ?? "1 mes"
        : `${seleccion.length} meses`;

  return (
    <div className="meses-filtro" ref={ref}>
      <button
        type="button"
        className={`filter-btn${seleccion.length > 0 ? " active" : ""}`}
        aria-haspopup="true"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        📅 {texto} ▾
      </button>

      {abierto && (
        <div className="meses-panel" role="group" aria-label="Filtrar por mes">
          {opciones.length === 0 ? (
            <p className="meses-vacio">Aún no hay gastos para filtrar.</p>
          ) : (
            <>
              <div className="meses-lista">
                {opciones.map((o) => (
                  <label key={o.clave} className="meses-opcion">
                    <input
                      type="checkbox"
                      checked={seleccion.includes(o.clave)}
                      onChange={() => alternar(o.clave)}
                    />
                    <span>{o.etiqueta}</span>
                  </label>
                ))}
              </div>
              <div className="meses-pie">
                <button
                  type="button"
                  className="meses-limpiar"
                  disabled={seleccion.length === 0}
                  onClick={() => onChange([])}
                >
                  Mostrar todos los meses
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}