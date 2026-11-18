import React from "react";
import { useElementWidth } from "../../hooks/useElementWidth";
import { formatCompacto } from "../../utils/estadisticas";
import type { MesRef } from "../../utils/estadisticas";
import { formatMoney } from "../../utils/format";

interface BarChartMensualProps {
  meses: MesRef[];
  totales: number[];
  presupuestos: (number | null)[]; // null = el mes no tiene presupuesto guardado
  alto?: number;
}

const MARGEN = { top: 26, right: 8, bottom: 26, left: 44 };

// Un color claro y distinto para cada mes del año (enero ... diciembre). Se
// evita el rojo porque queda reservado para "superó el presupuesto".
const COLORES_MES = [
  "#3563e9", "#22c55e", "#f59e0b", "#8b5cf6", "#06b6d4", "#84cc16",
  "#f97316", "#14b8a6", "#6366f1", "#d946ef", "#0ea5e9", "#eab308",
];

// Barras de gasto total por mes. Cada mes tiene su propio color. La línea
// punteada marca el presupuesto del mes (tabla finanzas) y la barra se pone
// roja si el gasto lo supera. El último mes (el que se está viendo) se
// dibuja con color pleno y los anteriores un poco más suaves.
export default function BarChartMensual({
  meses,
  totales,
  presupuestos,
  alto = 210,
}: BarChartMensualProps) {
  const [ref, ancho] = useElementWidth<HTMLDivElement>();

  const n = meses.length;
  const maximo = Math.max(1, ...totales, ...presupuestos.map((p) => p ?? 0));
  const tope = maximo * 1.15;

  const areaW = Math.max(0, ancho - MARGEN.left - MARGEN.right);
  const areaH = alto - MARGEN.top - MARGEN.bottom;
  const base = MARGEN.top + areaH;
  const banda = n > 0 ? areaW / n : 0;
  const anchoBarra = Math.min(banda * 0.6, 44);
  const fuente = banda < 34 ? 9 : 10.5;

  const y = (valor: number) => base - (valor / tope) * areaH;
  const ticks = [0, tope / 2, tope];

  const descripcion = meses
    .map((m, i) => `${m.etiqueta}: ${formatMoney(totales[i])}`)
    .join(". ");

  return (
    <div ref={ref} className="chart-box" style={{ minHeight: alto }}>
      {ancho > 0 && (
        <svg
          width={ancho}
          height={alto}
          role="img"
          aria-label={`Gasto total por mes. ${descripcion}`}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={MARGEN.left}
                x2={ancho - MARGEN.right}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--gray-200)"
                strokeWidth={1}
              />
              <text
                x={MARGEN.left - 6}
                y={y(t) + 3.5}
                textAnchor="end"
                fontSize={10}
                fill="var(--gray-400)"
              >
                {formatCompacto(t)}
              </text>
            </g>
          ))}

          {meses.map((m, i) => {
            const total = totales[i];
            const presupuesto = presupuestos[i];
            const xCentro = MARGEN.left + banda * i + banda / 2;
            const xBarra = xCentro - anchoBarra / 2;
            const yBarra = y(total);
            const altoBarra = Math.max(0, base - yBarra);
            const yPresupuesto = presupuesto !== null ? y(presupuesto) : null;
            const excede = presupuesto !== null && total > presupuesto;
            const esUltimo = i === n - 1;
            const yEtiqueta =
              Math.min(yBarra, yPresupuesto ?? yBarra) - 6;

            const tooltip =
              `${m.etiqueta}: ${formatMoney(total)}` +
              (presupuesto !== null
                ? ` · Presupuesto ${formatMoney(presupuesto)}${excede ? " (superado)" : ""}`
                : " · Sin presupuesto guardado");

            return (
              <g key={m.clave}>
                <title>{tooltip}</title>
                <rect
                  x={MARGEN.left + banda * i}
                  y={MARGEN.top}
                  width={banda}
                  height={areaH}
                  fill="transparent"
                />
                {total > 0 && (
                  <rect
                    x={xBarra}
                    y={yBarra}
                    width={anchoBarra}
                    height={altoBarra}
                    rx={3}
                    fill={excede ? "var(--red)" : COLORES_MES[m.mes]}
                    opacity={esUltimo ? 1 : 0.85}
                  />
                )}
                {yPresupuesto !== null && (
                  <line
                    x1={xBarra - 4}
                    x2={xBarra + anchoBarra + 4}
                    y1={yPresupuesto}
                    y2={yPresupuesto}
                    stroke="var(--gray-900)"
                    strokeWidth={2}
                    strokeDasharray="2 2"
                  />
                )}
                {total > 0 && (
                  <text
                    x={xCentro}
                    y={yEtiqueta}
                    textAnchor="middle"
                    fontSize={fuente}
                    fontWeight={600}
                    fill="var(--gray-700)"
                  >
                    {formatCompacto(total)}
                  </text>
                )}
                <text
                  x={xCentro}
                  y={alto - 8}
                  textAnchor="middle"
                  fontSize={fuente}
                  fontWeight={esUltimo ? 700 : 500}
                  fill={esUltimo ? "var(--gray-900)" : "var(--gray-500)"}
                >
                  {m.corta}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}