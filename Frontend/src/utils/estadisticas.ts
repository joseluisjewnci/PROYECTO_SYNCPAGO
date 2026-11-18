import type { Gasto } from "../interfaces/gasto";
import type { PresupuestoMes } from "../interfaces/finanzas";
import { MESES } from "./format";

// Etiquetas legibles de la clase de un tipo de gasto (tipo_gasto.clase).
export const CLASES_LABEL: Record<string, string> = {
  vital: "Vital",
  entretenimiento: "Entretenimiento",
  varios: "Varios",
  sin_clase: "Sin clase",
};

export type AgrupacionCambio = "clase" | "servicio";

export interface MesRef {
  anio: number;
  mes: number; // 0-11
  clave: string; // 'YYYY-MM'
  etiqueta: string; // 'Septiembre 2026'
  corta: string; // 'Sep'
}

export interface CambioGrupo {
  clave: string;
  actual: number;
  anterior: number;
  delta: number;
  porcentaje: number | null; // null cuando el mes anterior fue 0
  serie: number[];
}

export interface ResumenEvolucion {
  totalActual: number;
  totalAnterior: number;
  delta: number;
  porcentaje: number | null;
  mayorAumento: CambioGrupo | null;
  mayorAhorro: CambioGrupo | null;
}

export function claveMes(anio: number, mesIndex: number): string {
  return `${anio}-${String(mesIndex + 1).padStart(2, "0")}`;
}

function refMes(anio: number, mes: number): MesRef {
  return {
    anio,
    mes,
    clave: claveMes(anio, mes),
    etiqueta: `${MESES[mes]} ${anio}`,
    corta: MESES[mes].slice(0, 3),
  };
}

// Devuelve los últimos `cantidad` meses terminando en el mes de `fin`
// (el más antiguo primero). Se construye con (año, mes) para evitar el
// desbordamiento de Date.setMonth() en los días 29-31.
export function ultimosMeses(fin: Date, cantidad: number): MesRef[] {
  const resultado: MesRef[] = [];
  for (let i = cantidad - 1; i >= 0; i--) {
    const d = new Date(fin.getFullYear(), fin.getMonth() - i, 1);
    resultado.push(refMes(d.getFullYear(), d.getMonth()));
  }
  return resultado;
}

// Cada gasto cuenta en el mes de su fecha de vencimiento; los cancelados
// no se incluyen (misma regla que usa el backend en el presupuesto).
function gastosValidos(gastos: Gasto[]): Gasto[] {
  return gastos.filter((g) => g.estado !== "cancelado");
}

// 'YYYY-MM' del mes al que pertenece un timestamp ISO del backend.
export function claveDeFecha(isoString: string): string {
  const f = new Date(isoString);
  return claveMes(f.getFullYear(), f.getMonth());
}

// 'Septiembre 2026' a partir de '2026-09'.
export function etiquetaDeClave(clave: string): string {
  const [anio, mes] = clave.split("-");
  return `${MESES[Number(mes) - 1]} ${anio}`;
}

function claveDeGasto(g: Gasto): string {
  return claveDeFecha(g.fecha_vencimiento);
}

export function totalesPorMes(gastos: Gasto[], meses: MesRef[]): number[] {
  const acumulado: Record<string, number> = {};
  gastosValidos(gastos).forEach((g) => {
    const k = claveDeGasto(g);
    acumulado[k] = (acumulado[k] ?? 0) + g.precio;
  });
  return meses.map((m) => acumulado[m.clave] ?? 0);
}

// Presupuesto guardado (tabla finanzas) de cada mes; null si no existe.
export function presupuestosPorMes(
  presupuestos: PresupuestoMes[],
  meses: MesRef[]
): (number | null)[] {
  return meses.map((m) => {
    const p = presupuestos.find((x) => x.mes.slice(0, 7) === m.clave);
    return p ? p.presupuesto_gastos : null;
  });
}

// Serie mensual por grupo. `claveGrupo` decide el grupo de cada gasto
// (clase o nombre del servicio/categoría).
export function serieAgrupada(
  gastos: Gasto[],
  meses: MesRef[],
  claveGrupo: (g: Gasto) => string
): Record<string, number[]> {
  const indice: Record<string, number> = {};
  meses.forEach((m, i) => {
    indice[m.clave] = i;
  });

  const serie: Record<string, number[]> = {};
  gastosValidos(gastos).forEach((g) => {
    const i = indice[claveDeGasto(g)];
    if (i === undefined) return;
    const grupo = claveGrupo(g);
    if (!serie[grupo]) serie[grupo] = meses.map(() => 0);
    serie[grupo][i] += g.precio;
  });
  return serie;
}

function porcentaje(delta: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return Math.round((delta / anterior) * 100);
}

// Compara el último mes de la serie contra el anterior. Ordena por la
// magnitud del cambio y descarta los grupos sin gasto en ambos meses.
export function calcularCambios(serie: Record<string, number[]>): CambioGrupo[] {
  const cambios: CambioGrupo[] = [];
  Object.entries(serie).forEach(([clave, valores]) => {
    const n = valores.length;
    if (n < 2) return;
    const actual = valores[n - 1];
    const anterior = valores[n - 2];
    if (actual === 0 && anterior === 0) return;
    const delta = actual - anterior;
    cambios.push({
      clave,
      actual,
      anterior,
      delta,
      porcentaje: porcentaje(delta, anterior),
      serie: valores,
    });
  });
  return cambios.sort(
    (a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.clave.localeCompare(b.clave)
  );
}

export function resumirEvolucion(
  totales: number[],
  cambios: CambioGrupo[]
): ResumenEvolucion {
  const n = totales.length;
  const totalActual = n > 0 ? totales[n - 1] : 0;
  const totalAnterior = n > 1 ? totales[n - 2] : 0;
  const delta = totalActual - totalAnterior;
  const subidas = cambios.filter((c) => c.delta > 0);
  const bajadas = cambios.filter((c) => c.delta < 0);
  return {
    totalActual,
    totalAnterior,
    delta,
    porcentaje: porcentaje(delta, totalAnterior),
    mayorAumento: subidas.length ? subidas.reduce((a, b) => (b.delta > a.delta ? b : a)) : null,
    mayorAhorro: bajadas.length ? bajadas.reduce((a, b) => (b.delta < a.delta ? b : a)) : null,
  };
}

// Valores abreviados para ejes y etiquetas: 774k, 1,4M, 3,3M.
export function formatCompacto(valor: number): string {
  const abs = Math.abs(valor);
  if (abs >= 1_000_000) {
    return `${(valor / 1_000_000).toFixed(1).replace(".", ",").replace(/,0$/, "")}M`;
  }
  if (abs >= 1_000) return `${Math.round(valor / 1_000)}k`;
  return String(Math.round(valor));
}

export interface FilaResumenMes {
  mes: MesRef;
  presupuesto: number | null; // null = el mes no tiene presupuesto guardado
  pagado: number;
  balance: number | null; // presupuesto - pagado (positivo = ahorro)
}

export interface TotalesResumen {
  presupuesto: number;
  pagado: number;
  balance: number;
  mesesConPresupuesto: number;
  mesesTotales: number;
}

// Total pagado de cada mes (solo gastos en estado "pagado", por fecha de vencimiento).
export function pagadoPorMes(gastos: Gasto[], meses: MesRef[]): number[] {
  const acumulado: Record<string, number> = {};
  gastos
    .filter((g) => g.estado === "pagado")
    .forEach((g) => {
      const k = claveDeGasto(g);
      acumulado[k] = (acumulado[k] ?? 0) + g.precio;
    });
  return meses.map((m) => acumulado[m.clave] ?? 0);
}

// Presupuesto vs. pagado de cada mes del periodo (el más antiguo primero).
export function resumenPorMes(
  gastos: Gasto[],
  presupuestos: PresupuestoMes[],
  meses: MesRef[]
): FilaResumenMes[] {
  const pagados = pagadoPorMes(gastos, meses);
  const presupuestosMes = presupuestosPorMes(presupuestos, meses);
  return meses.map((mes, i) => ({
    mes,
    presupuesto: presupuestosMes[i],
    pagado: pagados[i],
    balance: presupuestosMes[i] === null ? null : (presupuestosMes[i] as number) - pagados[i],
  }));
}

// Suma el periodo. Solo cuentan los meses con presupuesto guardado, para que
// el ahorro o exceso compare cifras del mismo conjunto de meses.
export function totalizarResumen(filas: FilaResumenMes[]): TotalesResumen {
  const conPresupuesto = filas.filter((f) => f.presupuesto !== null);
  const presupuesto = conPresupuesto.reduce((a, f) => a + (f.presupuesto as number), 0);
  const pagado = conPresupuesto.reduce((a, f) => a + f.pagado, 0);
  return {
    presupuesto,
    pagado,
    balance: presupuesto - pagado,
    mesesConPresupuesto: conPresupuesto.length,
    mesesTotales: filas.length,
  };
}