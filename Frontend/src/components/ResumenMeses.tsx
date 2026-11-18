import React, { useState } from "react";
import type { Gasto } from "../interfaces/gasto";
import type { PresupuestoMes } from "../interfaces/finanzas";
import { resumenPorMes, totalizarResumen, ultimosMeses } from "../utils/estadisticas";
import { formatMoney } from "../utils/format";

interface ResumenMesesProps {
  gastos: Gasto[];
  presupuestos: PresupuestoMes[];
  fechaFin: Date; // último mes del periodo (el mes que se está viendo)
}

const OPCIONES = [3, 6, 9, 12] as const;

// Bloque "Resumen" de Estadísticas: compara lo presupuestado contra lo
// pagado en los últimos 3, 6, 9 o 12 meses, con el detalle de cada mes en
// una lista con scroll.
export default function ResumenMeses({ gastos, presupuestos, fechaFin }: ResumenMesesProps) {
  const [cantidad, setCantidad] = useState<(typeof OPCIONES)[number]>(3);

  const meses = ultimosMeses(fechaFin, cantidad);
  const filas = resumenPorMes(gastos, presupuestos, meses);
  const totales = totalizarResumen(filas);
  const sobra = totales.balance >= 0;
  const periodo = `${meses[0].etiqueta} – ${meses[meses.length - 1].etiqueta}`;
  const recientesPrimero = [...filas].reverse();

  return (
    <article className="finanzas-card resumen-card">
      <div className="finanzas-card-header">
        <span className="finanzas-icon">📈</span>
        <div>
          <h3>Resumen de los últimos {cantidad} meses</h3>
          <p>
            {periodo}. Comparativa entre lo presupuestado y lo que pagaste.
          </p>
        </div>
      </div>

      <div className="range-toggle resumen-filtro" role="group" aria-label="Periodo del resumen">
        {OPCIONES.map((n) => (
          <button
            key={n}
            type="button"
            className={`filter-btn${cantidad === n ? " active" : ""}`}
            aria-pressed={cantidad === n}
            onClick={() => setCantidad(n)}
          >
            {n} meses
          </button>
        ))}
      </div>

      {totales.mesesConPresupuesto === 0 ? (
        <p className="presupuesto-hint">
          No guardaste presupuesto en ninguno de estos {cantidad} meses. Usa la tarjeta de la
          izquierda para guardarlo y verás aquí el resumen.
        </p>
      ) : (
        <>
          <div className="ahorro-grid">
            <div className="ahorro-item">
              <span className="ahorro-label">Presupuesto</span>
              <span className="ahorro-value">{formatMoney(totales.presupuesto)}</span>
            </div>
            <div className="ahorro-item">
              <span className="ahorro-label">Pagado</span>
              <span className="ahorro-value red">{formatMoney(totales.pagado)}</span>
            </div>
            <div className="ahorro-item ahorro-item-destacado">
              <span className="ahorro-label">{sobra ? "Ahorraste" : "Te excediste"}</span>
              <span className={`ahorro-value ${sobra ? "green" : "red"}`}>
                {formatMoney(Math.abs(totales.balance))}
              </span>
            </div>
          </div>
          <div className={`ahorro-mensaje ${sobra ? "positivo" : "negativo"}`}>
            {sobra
              ? `🎉 ¡Buen trabajo! En estos ${cantidad} meses ahorraste ${formatMoney(totales.balance)}.`
              : `😟 En estos ${cantidad} meses te excediste por ${formatMoney(Math.abs(totales.balance))}.`}
          </div>
          {totales.mesesConPresupuesto < totales.mesesTotales && (
            <p className="presupuesto-hint resumen-nota">
              Solo {totales.mesesConPresupuesto} de {totales.mesesTotales} meses tienen presupuesto
              guardado; los demás no se suman al total.
            </p>
          )}
        </>
      )}

      <h4 className="resumen-subtitulo">Detalle por mes</h4>
      <ul className="resumen-lista" tabIndex={0} aria-label="Detalle del resumen por mes">
        {recientesPrimero.map((f) => {
          const tipo = f.balance === null ? "sin" : f.balance >= 0 ? "positivo" : "negativo";
          return (
            <li key={f.mes.clave} className="resumen-fila">
              <span className="resumen-mes">{f.mes.etiqueta}</span>
              <span className="resumen-dato">
                <small>Presupuesto</small>
                {f.presupuesto === null ? "—" : formatMoney(f.presupuesto)}
              </span>
              <span className="resumen-dato">
                <small>Pagado</small>
                {formatMoney(f.pagado)}
              </span>
              <span className={`resumen-balance ${tipo}`}>
                {f.balance === null
                  ? "Sin presupuesto"
                  : f.balance >= 0
                    ? `Ahorraste ${formatMoney(f.balance)}`
                    : `Te excediste ${formatMoney(Math.abs(f.balance))}`}
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}