import React from "react";

interface SparklineProps {
  valores: number[];
  color: string;
  ancho?: number;
  alto?: number;
}

// Mini línea de tendencia (sin ejes) con un punto en el último valor.
export default function Sparkline({
  valores,
  color,
  ancho = 64,
  alto = 26,
}: SparklineProps) {
  const pad = 3;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const rango = max - min;
  const pasos = Math.max(1, valores.length - 1);

  const x = (i: number) => pad + (i / pasos) * (ancho - 2 * pad);
  const y = (v: number) =>
    rango === 0 ? alto / 2 : alto - pad - ((v - min) / rango) * (alto - 2 * pad);

  const puntos = valores.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const ultimo = valores.length - 1;

  return (
    <svg
      width={ancho}
      height={alto}
      viewBox={`0 0 ${ancho} ${alto}`}
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <polyline
        points={puntos}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={x(ultimo)} cy={y(valores[ultimo])} r={2.4} fill={color} />
    </svg>
  );
}