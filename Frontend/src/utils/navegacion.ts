// Páginas principales de la app. Las usan el menú lateral (Sidebar) y el
// buscador global (BuscadorGlobal) para no repetir la lista.
export interface EnlaceMenu {
  to: string;
  icono: string;
  texto: string;
  palabras: string; // palabras extra por las que el buscador global lo encuentra
}

export const ENLACES_MENU: EnlaceMenu[] = [
  { to: "/dashboard", icono: "🏠", texto: "Inicio", palabras: "dashboard resumen panel principal" },
  { to: "/gastos", icono: "📋", texto: "Mis Gastos", palabras: "gastos pagos facturas recibos cuentas" },
  { to: "/recordatorios", icono: "🔔", texto: "Recordatorios", palabras: "avisos alertas antelacion notificaciones" },
  { to: "/estadisticas", icono: "📊", texto: "Estadísticas", palabras: "graficas presupuesto finanzas ahorro" },
  { to: "/historial", icono: "🕓", texto: "Historial", palabras: "cancelados pagados registro" },
];