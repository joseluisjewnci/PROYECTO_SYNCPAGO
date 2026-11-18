import React from "react";
import { useElementWidth } from "../../hooks/useElementWidth";
import { formatCompacto } from "../../utils/estadisticas";
import type { MesRef } from "../../utils/estadisticas";
import { formatMoney } from "../../utils/format";

interface LineChartProps {
  meses: MesRef[];
  valores: number[];
  color: string;
  alto?: number;
}

const MARGEN = { top: 24, right: 18, bottom: 26, left: 18 };

// Gráfica de línea detallada de una sola serie (se muestra al tocar una
// fila de "Cambio frente al mes anterior").
export default function LineChart({ meses, valores, color, alto = 130 }: LineChartProps) {
  const [ref, ancho] = useElementWidth<HTMLDivElement>();

  const n = valores.length;
  const maximo = Math.max(1, ...valores);
  const tope = maximo * 1.15;
  const areaW = Math.max(0, ancho - MARGEN.left - MARGEN.right);
  const areaH = alto - MARGEN.top - MARGEN.bottom;
  const base = MARGEN.top + areaH;
  const paso = n > 1 ? areaW / (n - 1) : 0;

  const x = (i: number) => MARGEN.left + paso * i;
  const y = (v: number) => base - (v / tope) * areaH;

  const puntos = valores.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${x(0).toFixed(1)},${base} ${puntos} ${x(n - 1).toFixed(1)},${base}`;
  const indiceMax = valores.indexOf(Math.max(...valores));
  const mostrarTodas = paso >= 40;

  return (
    <div ref={ref} className="chart-box" style={{ minHeight: alto }}>
      {ancho > 0 && (
        <svg width={ancho} height={alto} role="img" aria-label="Evolución mensual">
          <line
            x1={MARGEN.left}
            x2={ancho - MARGEN.right}
            y1={base}
            y2={base}
            stroke="var(--gray-200)"
          />
          <polygon points={area} fill={color} opacity={0.1} />
          <polyline
            points={puntos}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {valores.map((v, i) => {
            const esUltimo = i === n - 1;
            const etiquetar = mostrarTodas || esUltimo || i === indiceMax;
            return (
              <g key={meses[i].clave}>
                <title>{`${meses[i].etiqueta}: ${formatMoney(v)}`}</title>
                <circle cx={x(i)} cy={y(v)} r={esUltimo ? 4 : 3} fill={color} />
                {etiquetar && v > 0 && (
                  <text
                    x={x(i)}
                    y={y(v) - 8}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={600}
                    fill="var(--gray-700)"
                  >
                    {formatCompacto(v)}
                  </text>
                )}
                <text
                  x={x(i)}
                  y={alto - 8}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={esUltimo ? 700 : 500}
                  fill={esUltimo ? "var(--gray-900)" : "var(--gray-500)"}
                >
                  {meses[i].corta}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}