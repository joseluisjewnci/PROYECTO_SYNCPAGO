export function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

// Texto que escribe la persona (ej. "1.250.000,5") -> valor plano para el servidor ("1250000.5").
// Solo deja dígitos y la primera coma (decimal, máximo 2 decimales); los puntos son separadores de miles y se ignoran.
export function dineroAPlano(texto: string): string {
  const limpio = texto.replace(/[^0-9,]/g, "");
  const i = limpio.indexOf(",");
  const entero = (i === -1 ? limpio : limpio.slice(0, i)).replace(/^0+(?=\d)/, "");
  if (i === -1) return entero;
  const decimales = limpio.slice(i + 1).replace(/,/g, "").slice(0, 2);
  return (entero || "0") + "." + decimales;
}

// Valor plano ("1250000.5") -> texto para mostrar ("1.250.000,5")
export function dineroFormateado(plano: string): string {
  if (!plano) return "";
  const [entero, decimales] = plano.split(".");
  const miles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimales === undefined ? miles : miles + "," + decimales;
}

export function minutosAHoras(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (resto === 0) return `${horas} h`;
  return `${horas} h ${resto} min`;
}

// Convierte un valor de <input type="datetime-local"> ('YYYY-MM-DDTHH:mm')
// al formato que espera el backend ('YYYY-MM-DD HH:MM:SS')
export function toBackendDateTime(value: string): string {
  const [fecha, hora] = value.split("T");
  const horaCompleta = hora && hora.length === 5 ? `${hora}:00` : hora || "00:00:00";
  return `${fecha} ${horaCompleta}`;
}

// Convierte un timestamp ISO del backend a formato de <input type="datetime-local">
export function toDatetimeLocalValue(isoString: string): string {
  return isoString.slice(0, 16);
}

export function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// Resta los minutos de antelación (tabla 'recordatorio') a la fecha de
// vencimiento para saber la hora exacta en que se dispara el aviso.
export function calcularFechaNotificacion(
  fechaVencimientoISO: string,
  minutosAntelacion: number
): Date {
  const fecha = new Date(fechaVencimientoISO);
  return new Date(fecha.getTime() - minutosAntelacion * 60000);
}

const PALETA_COLORES = [
  "#3563e9", "#22c55e", "#ef4444", "#8b5cf6",
  "#f59e0b", "#06b6d4", "#eab308", "#ec4899",
];

// Genera un color determinístico para una categoría (no viene del backend)
export function colorParaCategoria(nombre: string): string {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) {
    hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PALETA_COLORES.length;
  return PALETA_COLORES[index];
}

// Asigna un color distinto a cada clave de una misma gráfica. Parte del color
// determinístico de colorParaCategoria() y, si dos claves chocan (la paleta
// solo tiene 8 colores), toma el siguiente color libre.
export function asignarColores(claves: string[]): Record<string, string> {
  const asignados: Record<string, string> = {};
  const usados = new Set<string>();
  claves.forEach((clave) => {
    let color = colorParaCategoria(clave);
    if (usados.has(color)) {
      const libre = PALETA_COLORES.find((c) => !usados.has(c));
      if (libre) color = libre;
    }
    usados.add(color);
    asignados[clave] = color;
  });
  return asignados;
}

export const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
