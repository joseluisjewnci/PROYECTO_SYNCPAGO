import React, { useState } from "react";
import type { Gasto } from "../interfaces/gasto";
import type { PresupuestoMes } from "../interfaces/finanzas";
import {
  CLASES_LABEL,
  calcularCambios,
  presupuestosPorMes,
  resumirEvolucion,
  serieAgrupada,
  totalesPorMes,
  ultimosMeses,
} from "../utils/estadisticas";
import type { AgrupacionCambio, CambioGrupo } from "../utils/estadisticas";
import { asignarColores, formatMoney } from "../utils/format";
import BarChartMensual from "./charts/BarChartMensual";
import LineChart from "./charts/LineChart";
import Sparkline from "./charts/Sparkline";

interface EvolucionGastosProps {
  gastos: Gasto[];
  presupuestos: PresupuestoMes[];
  fechaFin: Date; // mes con el que termina el rango (el que se está viendo)
  claseDeCategoria: (categoria: string) => string;
  cargando: boolean;
}

const RANGOS = [3, 6, 12] as const;

function conSigno(valor: number): string {
  return `${valor > 0 ? "+" : ""}${formatMoney(valor)}`;
}

function conPorcentaje(porcentaje: number | null): string {
  if (porcentaje === null) return "";
  return ` (${porcentaje > 0 ? "+" : ""}${porcentaje}%)`;
}

function describirCambio(c: CambioGrupo): { tipo: "baja" | "sube" | "igual"; texto: string } {
  if (c.delta === 0) return { tipo: "igual", texto: "● Sin cambios" };
  const detalle = `${conSigno(c.delta)}${conPorcentaje(c.porcentaje)}`;
  if (c.delta > 0) {
    return { tipo: "sube", texto: `▲ ${c.anterior === 0 ? "Nuevo" : "Aumentó"} ${detalle}` };
  }
  return { tipo: "baja", texto: `▼ Disminuyó ${detalle}` };
}

// Menos gasto = verde, más gasto = rojo.
function colorTendencia(delta: number): string {
  if (delta < 0) return "var(--green-dark)";
  if (delta > 0) return "var(--red)";
  return "var(--gray-400)";
}

export default function EvolucionGastos({
  gastos,
  presupuestos,
  fechaFin,
  claseDeCategoria,
  cargando,
}: EvolucionGastosProps) {
  const [rango, setRango] = useState<(typeof RANGOS)[number]>(6);
  const [agrupacion, setAgrupacion] = useState<AgrupacionCambio>("clase");
  const [filaAbierta, setFilaAbierta] = useState<string | null>(null);

  const meses = ultimosMeses(fechaFin, rango);
  const mesActual = meses[meses.length - 1];
  const mesAnterior = meses[meses.length - 2];

  const totales = totalesPorMes(gastos, meses);
  const presupuestoMeses = presupuestosPorMes(presupuestos, meses);

  const serie = serieAgrupada(gastos, meses, (g) =>
    agrupacion === "clase" ? claseDeCategoria(g.categoria) : g.categoria
  );
  const cambios = calcularCambios(serie);
  const resumen = resumirEvolucion(totales, cambios);
  const colores = asignarColores(cambios.map((c) => c.clave));

  function etiquetaGrupo(clave: string): string {
    return agrupacion === "clase" ? CLASES_LABEL[clave] ?? clave : clave;
  }

  function cambiarAgrupacion(nueva: AgrupacionCambio) {
    setAgrupacion(nueva);
    setFilaAbierta(null);
  }

  function textoResumen() {
    const { totalActual, totalAnterior, delta, porcentaje, mayorAumento, mayorAhorro } = resumen;

    if (totalActual === 0 && totalAnterior === 0) {
      return (
        <>
          Aún no hay gastos registrados en {mesActual.etiqueta} ni en {mesAnterior.etiqueta}.
        </>
      );
    }

    const verbo = delta < 0 ? "Bajó" : delta > 0 ? "Subió" : "Se mantuvo igual";
    return (
      <>
        {mesActual.etiqueta}: <strong>{formatMoney(totalActual)}</strong>.{" "}
        {delta === 0 ? (
          <>{verbo} frente a {mesAnterior.etiqueta}.</>
        ) : (
          <>
            {verbo} {formatMoney(Math.abs(delta))}
            {porcentaje !== null ? ` (${porcentaje > 0 ? "+" : ""}${porcentaje}%)` : ""} frente a{" "}
            {mesAnterior.etiqueta}.
          </>
        )}
        {mayorAumento && (
          <>
            {" "}
            Mayor aumento: <strong>{etiquetaGrupo(mayorAumento.clave)}</strong> (
            {conSigno(mayorAumento.delta)}).
          </>
        )}
        {mayorAhorro && (
          <>
            {" "}
            Mayor ahorro: <strong>{etiquetaGrupo(mayorAhorro.clave)}</strong> (
            {conSigno(mayorAhorro.delta)}).
          </>
        )}
      </>
    );
  }

  return (
    <section className="chart-section" aria-label="Evolución de gastos">
      <div className="evolucion-header">
        <div>
          <h2>📈 Evolución de gastos</h2>
          <p className="chart-sub">
            Cada gasto cuenta en el mes de su fecha de vencimiento. Los cancelados no se incluyen.
          </p>
        </div>
        <div className="range-toggle" role="group" aria-label="Rango de meses">
          {RANGOS.map((r) => (
            <button
              key={r}
              type="button"
              className={`filter-btn${rango === r ? " active" : ""}`}
              aria-pressed={rango === r}
              onClick={() => {
                setRango(r);
                setFilaAbierta(null);
              }}
            >
              {r} meses
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <p className="chart-sub">Cargando...</p>
      ) : (
        <>
          <p className="evolucion-insight" role="status">
            {textoResumen()}
          </p>

          <div className="evolucion-grid">
            <div className="evolucion-col">
              <h3 className="chart-title">Gasto total por mes</h3>
              <BarChartMensual
                meses={meses}
                totales={totales}
                presupuestos={presupuestoMeses}
              />
              <p className="chart-caption">
                Cada mes tiene su color. La línea punteada es el presupuesto del mes; la barra se
                pone roja si lo supera.
              </p>
            </div>

            <div className="evolucion-col">
              <div className="cambio-head">
                <h3 className="chart-title">Cambio frente a {mesAnterior.etiqueta}</h3>
                <div className="range-toggle" role="group" aria-label="Agrupar cambios">
                  <button
                    type="button"
                    className={`filter-btn${agrupacion === "clase" ? " active" : ""}`}
                    aria-pressed={agrupacion === "clase"}
                    onClick={() => cambiarAgrupacion("clase")}
                  >
                    Por clase
                  </button>
                  <button
                    type="button"
                    className={`filter-btn${agrupacion === "servicio" ? " active" : ""}`}
                    aria-pressed={agrupacion === "servicio"}
                    onClick={() => cambiarAgrupacion("servicio")}
                  >
                    Por servicio
                  </button>
                </div>
              </div>
              <p className="cambio-hint">
                Toca una fila para ver su gráfica. Solo se muestra una a la vez.
              </p>

              {cambios.length === 0 ? (
                <p className="chart-sub">
                  No hay gastos en {mesActual.etiqueta} ni en {mesAnterior.etiqueta} para comparar.
                </p>
              ) : (
                <ul className="cambio-lista">
                  {cambios.map((c) => {
                    const abierta = filaAbierta === c.clave;
                    const { tipo, texto } = describirCambio(c);
                    return (
                      <li key={c.clave} className="cambio-fila">
                        <button
                          type="button"
                          className="cambio-fila-main"
                          aria-expanded={abierta}
                          onClick={() => setFilaAbierta(abierta ? null : c.clave)}
                        >
                          <span className="cambio-dot" style={{ background: colores[c.clave] }} />
                          <span className="cambio-info">
                            <span className="cambio-nombre">{etiquetaGrupo(c.clave)}</span>
                            <span className={`cambio-badge ${tipo}`}>{texto}</span>
                          </span>
                          <Sparkline valores={c.serie} color={colorTendencia(c.delta)} />
                        </button>
                        {abierta && (
                          <div className="cambio-detalle">
                            <LineChart
                              meses={meses}
                              valores={c.serie}
                              color={colorTendencia(c.delta)}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}