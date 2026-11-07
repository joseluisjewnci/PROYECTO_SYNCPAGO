import React, { useState } from "react";
import { formatMoney } from "../../utils/format";

export interface PieDato {
  clave: string;
  etiqueta: string;
  valor: number;
  color: string;
}

interface PieChartProps {
  datos: PieDato[];
}

const CENTRO = 100;
const RADIO = 88;

function polar(angulo: number, radio: number) {
  return {
    x: CENTRO + radio * Math.cos(angulo),
    y: CENTRO + radio * Math.sin(angulo),
  };
}

function trazoPorcion(inicio: number, fin: number): string {
  const a = polar(inicio, RADIO);
  const b = polar(fin, RADIO);
  const grande = fin - inicio > Math.PI ? 1 : 0;
  return `M ${CENTRO} ${CENTRO} L ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${RADIO} ${RADIO} 0 ${grande} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)} Z`;
}

function textoPorcentaje(valor: number, total: number): string {
  const pct = (valor / total) * 100;
  if (pct > 0 && pct < 1) return "<1%";
  return `${Math.round(pct)}%`;
}

// Gráfica de torta con leyenda. Al pasar el cursor (o enfocar con teclado)
// una porción o su fila de la leyenda, se resalta la porción correspondiente.
export default function PieChart({ datos }: PieChartProps) {
  const [activo, setActivo] = useState<string | null>(null);

  const total = datos.reduce((acc, d) => acc + d.valor, 0);
  if (total <= 0) return null;

  let acumulado = -Math.PI / 2; // empieza arriba
  const porciones = datos.map((d) => {
    const angulo = (d.valor / total) * Math.PI * 2;
    const inicio = acumulado;
    const fin = acumulado + angulo;
    acumulado = fin;
    return { ...d, inicio, fin, medio: (inicio + fin) / 2, completa: datos.length === 1 };
  });

  return (
    <div className="pie-wrap">
      <svg
        className="pie-svg"
        viewBox="0 0 200 200"
        role="img"
        aria-label={`Gráfica de torta. ${datos
          .map((d) => `${d.etiqueta} ${textoPorcentaje(d.valor, total)}`)
          .join(", ")}`}
      >
        {porciones.map((p) => {
          const resaltada = activo === p.clave;
          const desplazar = resaltada && !p.completa ? 5 : 0;
          const dx = Math.cos(p.medio) * desplazar;
          const dy = Math.sin(p.medio) * desplazar;
          const pct = (p.valor / total) * 100;
          const etiqueta = polar(p.medio, RADIO * 0.62);
          return (
            <g
              key={p.clave}
              className="pie-slice"
              style={{
                transform: `translate(${dx}px, ${dy}px)`,
                opacity: activo && !resaltada ? 0.55 : 1,
              }}
              onMouseEnter={() => setActivo(p.clave)}
              onMouseLeave={() => setActivo(null)}
            >
              <title>{`${p.etiqueta}: ${formatMoney(p.valor)} (${textoPorcentaje(p.valor, total)})`}</title>
              {p.completa ? (
                <circle cx={CENTRO} cy={CENTRO} r={RADIO} fill={p.color} />
              ) : (
                <path d={trazoPorcion(p.inicio, p.fin)} fill={p.color} stroke="#fff" strokeWidth={2} />
              )}
              {pct >= 8 && (
                <text
                  x={etiqueta.x}
                  y={etiqueta.y + 4}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={800}
                  fill="#fff"
                  stroke="rgba(15,23,42,0.35)"
                  strokeWidth={2.5}
                  paintOrder="stroke"
                  pointerEvents="none"
                >
                  {textoPorcentaje(p.valor, total)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <ul className="pie-legend">
        {porciones.map((p) => (
          <li
            key={p.clave}
            className={activo === p.clave ? "activo" : undefined}
            tabIndex={0}
            onMouseEnter={() => setActivo(p.clave)}
            onMouseLeave={() => setActivo(null)}
            onFocus={() => setActivo(p.clave)}
            onBlur={() => setActivo(null)}
          >
            <span className="pie-swatch" style={{ background: p.color }} />
            <span className="pie-nombre">{p.etiqueta}</span>
            <span className="pie-valor">
              {formatMoney(p.valor)} · {textoPorcentaje(p.valor, total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}