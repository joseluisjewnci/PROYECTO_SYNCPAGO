import type { Gasto } from "../interfaces/gasto";
import { formatDateTime, formatMoney } from "./format";
import { generarPdf } from "./pdf";
import { LOGO_ALFA_BASE64, LOGO_ALTO, LOGO_ANCHO, LOGO_JPEG_BASE64 } from "./logoPdf";

export interface OpcionesHistorialPdf {
  usuario: string;
  periodo: string; // por ejemplo "Últimos 3 meses"
  estado: string; // por ejemplo "Todos" o "Pagado"
}

// Texto base64 -> bytes
function desdeBase64(base64: string): Uint8Array {
  const texto = atob(base64);
  const bytes = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i++) bytes[i] = texto.charCodeAt(i);
  return bytes;
}

// Misma regla que muestra la pantalla (EstadoBadge): un pendiente con fecha pasada se ve como "Vencido".
export function etiquetaDeEstado(gasto: Gasto, ahora: Date): string {
  if (gasto.estado === "cancelado") return "Cancelado";
  if (gasto.estado === "pagado") return "Pagado";
  const vencido = gasto.estado === "vencido" || new Date(gasto.fecha_vencimiento) < ahora;
  if (vencido) return "Vencido";
  const fecha = new Date(gasto.fecha_vencimiento);
  const esHoy = fecha.getFullYear() === ahora.getFullYear() && fecha.getMonth() === ahora.getMonth() && fecha.getDate() === ahora.getDate();
  return esHoy ? "Hoy" : "Pendiente";
}

function fechaArchivo(ahora: Date): string {
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return ahora.getFullYear() + "-" + mes + "-" + dia;
}

function sinTildes(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Arma el PDF con los gastos que recibe (ya filtrados por estado y periodo) y lo descarga.
export function construirHistorialPdf(gastos: Gasto[], opciones: OpcionesHistorialPdf, ahora: Date = new Date()): Uint8Array {
  const ordenados = gastos.slice().sort((a, b) => new Date(b.fecha_vencimiento).getTime() - new Date(a.fecha_vencimiento).getTime());
  let pagados = 0;
  let totalPagado = 0;
  let porPagar = 0;
  let totalPorPagar = 0;
  let cancelados = 0;
  for (const g of ordenados) {
    const etiqueta = etiquetaDeEstado(g, ahora);
    if (etiqueta === "Pagado") {
      pagados += 1;
      totalPagado += g.precio;
    } else if (etiqueta === "Cancelado") {
      cancelados += 1;
    } else {
      porPagar += 1;
      totalPorPagar += g.precio;
    }
  }
  return generarPdf({
    titulo: "SYNCPAGO - Historial de gastos",
    encabezado: [
      "Usuario: " + (opciones.usuario || "-"),
      "Periodo: " + opciones.periodo + "   |   Estado: " + opciones.estado,
      "Generado: " + formatDateTime(ahora.toISOString()),
    ],
    resumen: [
      "Registros: " + ordenados.length,
      "Pagados: " + pagados + " (" + formatMoney(totalPagado) + ")",
      "Pendientes y vencidos: " + porPagar + " (" + formatMoney(totalPorPagar) + ")",
      "Cancelados: " + cancelados + " (no suman)",
    ],
    columnas: [
      { titulo: "Categoría", ancho: 190 },
      { titulo: "Vencimiento", ancho: 150 },
      { titulo: "Estado", ancho: 80 },
      { titulo: "Precio", ancho: 95, alinear: "der" },
    ],
    filas: ordenados.map((g) => [g.categoria, formatDateTime(g.fecha_vencimiento), etiquetaDeEstado(g, ahora), formatMoney(g.precio)]),
    vacio: "No hay registros para este filtro.",
    pie: "SYNCPAGO - " + opciones.periodo + " - " + opciones.estado,
    // Logo mediano (260 pt de ancho, unos 9 cm), semitransparente, en el centro de cada página
    marcaAgua: { ancho: LOGO_ANCHO, alto: LOGO_ALTO, jpeg: desdeBase64(LOGO_JPEG_BASE64), alfa: desdeBase64(LOGO_ALFA_BASE64), anchoEnPagina: 260, opacidad: 0.14 },
  });
}

export function descargarHistorialPdf(gastos: Gasto[], opciones: OpcionesHistorialPdf): void {
  const ahora = new Date();
  const bytes = construirHistorialPdf(gastos, opciones, ahora);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = "syncpago-historial-" + sinTildes(opciones.periodo) + "-" + fechaArchivo(ahora) + ".pdf";
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
