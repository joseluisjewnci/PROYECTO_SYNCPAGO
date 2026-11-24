// Periodos "más recientes" para filtrar el historial. Siempre se cuenta hacia atrás desde hoy.
export type PeriodoHistorial = "todo" | "1m" | "3m" | "6m" | "12m";

export const PERIODOS: { valor: PeriodoHistorial; texto: string; meses: number }[] = [
  { valor: "todo", texto: "Todo el historial", meses: 0 },
  { valor: "1m", texto: "Último mes", meses: 1 },
  { valor: "3m", texto: "Últimos 3 meses", meses: 3 },
  { valor: "6m", texto: "Últimos 6 meses", meses: 6 },
  { valor: "12m", texto: "Último año", meses: 12 },
];

// Resta meses respetando el largo de cada mes (31 de marzo - 1 mes = 28 o 29 de febrero, no 3 de marzo).
export function restarMeses(fecha: Date, meses: number): Date {
  const resultado = new Date(fecha.getTime());
  const dia = resultado.getDate();
  resultado.setDate(1);
  resultado.setMonth(resultado.getMonth() - meses);
  const ultimoDia = new Date(resultado.getFullYear(), resultado.getMonth() + 1, 0).getDate();
  resultado.setDate(Math.min(dia, ultimoDia));
  return resultado;
}

// Inicio del periodo (00:00 de ese día). Devuelve null cuando se pide todo el historial.
export function inicioPeriodo(periodo: PeriodoHistorial, ahora: Date): Date | null {
  const meses = PERIODOS.find((p) => p.valor === periodo)?.meses ?? 0;
  if (meses === 0) return null;
  const inicio = restarMeses(ahora, meses);
  inicio.setHours(0, 0, 0, 0);
  return inicio;
}

// Un gasto entra al periodo si su vencimiento está entre el inicio y el final del día de hoy.
export function dentroDelPeriodo(fechaIso: string, periodo: PeriodoHistorial, ahora: Date): boolean {
  const inicio = inicioPeriodo(periodo, ahora);
  if (!inicio) return true;
  const fecha = new Date(fechaIso).getTime();
  if (Number.isNaN(fecha)) return false;
  const fin = new Date(ahora.getTime());
  fin.setHours(23, 59, 59, 999);
  return fecha >= inicio.getTime() && fecha <= fin.getTime();
}

export function textoPeriodo(periodo: PeriodoHistorial): string {
  return PERIODOS.find((p) => p.valor === periodo)?.texto ?? "";
}
