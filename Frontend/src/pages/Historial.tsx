import React, { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { gastosService } from "../services/gastosService";
import type { Gasto, EstadoGasto } from "../interfaces/gasto";
import { formatMoney } from "../utils/format";
import EstadoBadge from "../components/EstadoBadge";
import Pagination from "../components/Pagination";
import { PERIODOS, dentroDelPeriodo, textoPeriodo } from "../utils/periodos";
import type { PeriodoHistorial } from "../utils/periodos";
import { descargarHistorialPdf } from "../utils/historialPdf";

const PAGE_SIZE = 10;

export default function Historial() {
  const { usuario } = useAuth();
  const { mostrarToast } = useToast();
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<"todos" | EstadoGasto>("todos");
  const [pagina, setPagina] = useState(1);
  const [periodo, setPeriodo] = useState<PeriodoHistorial>("todo");

  useEffect(() => {
    if (!usuario) return;
    (async () => {
      setCargando(true);
      try {
        const data = await gastosService.listarPorUsuario(usuario.id_usuario);
        setGastos(data.gastos);
      } catch (err) {
        mostrarToast(err instanceof Error ? err.message : "Error al cargar el historial");
      } finally {
        setCargando(false);
      }
    })();
  }, [usuario]);

  // El historial muestra TODOS los estados (incluidos los cancelados,
  // que ya no aparecen en la página de Gastos activos).
  const ahora = new Date();
  // Se aplican a la vez el estado (pestañas) y el periodo reciente (selector); el PDF exporta exactamente esto
  const filtrados = gastos.filter((g) => (filtro === "todos" || g.estado === filtro) && dentroDelPeriodo(g.fecha_vencimiento, periodo, ahora));

  function exportarPdf() {
    try {
      descargarHistorialPdf(filtrados, {
        usuario: usuario?.nombre ?? "",
        periodo: textoPeriodo(periodo),
        estado: filtro === "todos" ? "Todos" : filtro[0].toUpperCase() + filtro.slice(1),
      });
      mostrarToast("PDF generado ✓");
    } catch {
      mostrarToast("No se pudo generar el PDF");
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const paginados = filtrados
    .slice()
    .sort(
      (a, b) =>
        new Date(b.fecha_vencimiento).getTime() - new Date(a.fecha_vencimiento).getTime()
    )
    .slice((paginaSegura - 1) * PAGE_SIZE, paginaSegura * PAGE_SIZE);

  return (
    <>
      <header className="page-header">
        <h1>Historial</h1>
        <p>Consulta todos tus gastos, incluidos los pagados y cancelados.</p>
      </header>

      <div className="tabs">
        {(["todos", "pendiente", "pagado", "cancelado"] as const).map((valor) => (
          <span
            key={valor}
            className={`tab${filtro === valor ? " active" : ""}`}
            onClick={() => {
              setFiltro(valor);
              setPagina(1);
            }}
          >
            {valor === "todos" ? "Todos" : valor[0].toUpperCase() + valor.slice(1)}
          </span>
        ))}
      </div>

      <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "18px" }}>
        <label htmlFor="periodo-historial" style={{ fontWeight: 600 }}>Periodo:</label>
        <select
          id="periodo-historial"
          value={periodo}
          onChange={(e) => {
            setPeriodo(e.target.value as PeriodoHistorial);
            setPagina(1);
          }}
          style={{ padding: "9px 12px", border: "1px solid var(--gray-200)", borderRadius: "var(--radius-sm)", fontFamily: "inherit" }}
        >
          {PERIODOS.map((p) => (
            <option key={p.valor} value={p.valor}>{p.texto}</option>
          ))}
        </select>
        <button
          className="btn-save"
          style={{ flex: "none", padding: "10px 18px" }}
          onClick={exportarPdf}
          disabled={cargando || filtrados.length === 0}
        >
          Exportar PDF
        </button>
        <span style={{ color: "var(--gray-400)" }}>{filtrados.length} registros</span>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Categoría</th>
            <th>Vencimiento</th>
            <th>Precio</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {cargando ? (
            <tr>
              <td colSpan={4}>Cargando...</td>
            </tr>
          ) : paginados.length === 0 ? (
            <tr>
              <td colSpan={4}>No hay registros para este filtro.</td>
            </tr>
          ) : (
            paginados.map((g) => (
              <tr
                key={g.id_gasto}
                style={g.estado === "cancelado" ? { opacity: 0.55 } : undefined}
              >
                <td>{g.categoria}</td>
                <td>
                  {new Date(g.fecha_vencimiento).toLocaleString("es-CO", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </td>
                <td>{formatMoney(g.precio)}</td>
                <td>
                  <EstadoBadge estado={g.estado} fechaVencimiento={g.fecha_vencimiento} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <Pagination
        page={paginaSegura}
        totalPages={totalPaginas}
        totalItems={filtrados.length}
        pageSize={PAGE_SIZE}
        onChange={setPagina}
      />
    </>
  );
}
