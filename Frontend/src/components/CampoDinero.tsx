import React, { useLayoutEffect, useRef, useState } from "react";
import { dineroAPlano, dineroFormateado } from "../utils/format";

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  // Valor "plano": solo dígitos y un punto decimal, por ejemplo "16000" o "16000.5". Es el que se envía al servidor.
  value: string;
  onChange: (valorPlano: string) => void;
}

// Campo de dinero que muestra el valor con separadores colombianos mientras se escribe: 16.000 o 1.250.000,50
// (punto para los miles, coma para los decimales). Hacia afuera entrega siempre el valor plano.
export default function CampoDinero({ value, onChange, ...resto }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const cursor = useRef<number | null>(null); // cuántos dígitos había antes del cursor
  const [, repintar] = useState(0);

  const mostrado = dineroFormateado(value);

  // Después de formatear, el cursor vuelve a quedar junto al mismo dígito (si no, saltaría al final)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || cursor.current === null || document.activeElement !== el) return;
    let contados = 0;
    let pos = 0;
    while (pos < mostrado.length && contados < cursor.current) {
      if (/[0-9,]/.test(mostrado[pos])) contados++;
      pos++;
    }
    el.setSelectionRange(pos, pos);
    cursor.current = null;
  });

  return (
    <input
      {...resto}
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={mostrado}
      onChange={(e) => {
        const texto = e.target.value;
        const antes = texto.slice(0, e.target.selectionStart ?? texto.length);
        cursor.current = (antes.match(/[0-9,]/g) ?? []).length;
        onChange(dineroAPlano(texto));
        repintar((n) => n + 1); // si el valor plano no cambió (ej. borrar un punto), igual se vuelve a pintar
      }}
    />
  );
}
