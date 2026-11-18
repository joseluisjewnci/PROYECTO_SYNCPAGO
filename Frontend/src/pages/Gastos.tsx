import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { gastosService } from "../services/gastosService";
import { tipoGastoService } from "../services/tipoGastoService";
import { recordatoriosService } from "../services/recordatoriosService";
import type { Gasto, EstadoGasto } from "../interfaces/gasto";
import type { TipoGasto } from "../interfaces/tipoGasto";
import {
  formatMoney,
  formatDateTime,
  calcularFechaNotificacion,
  minutosAHoras,
  colorParaCategoria,
} from "../utils/format";
import EstadoBadge from "../components/EstadoBadge";
import GastoFormModal from "../components/GastoFormModal";
import Pagination from "../components/Pagination";
import FiltroMeses from "../components/FiltroMeses";
import { claveDeFecha, etiquetaDeClave } from "../utils/estadisticas";

const PAGE_SIZE = 8;

type FiltroEstado = "todos" | EstadoGasto;

export default function Gastos() {
  const { usuario } = useAuth();
  const { mostrarToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [categorias, setCategorias] = useState<TipoGasto[]>([]);
  // id_gasto -> minutos de antelación de su recordatorio (tabla 'recordatorio')
  const [recordatorios, setRecordatorios] = useState<Record<number, number>>({});
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");
  const [mesesSeleccionados, setMesesSeleccionados] = useState<string[]>([]); // vacío = todos
  const [pagina, setPagina] = useState(1);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [gastoEditar, setGastoEditar] = useState<Gasto | null>(null);

  useEffect(() => {
    if (!usuario) return;
    cargarTodo();
  }, [usuario]);

  // Soporta abrir el modal desde fuera de esta página (botón "Agregar
  // Gasto" de la sidebar) navegando a /gastos?nuevo=1
  // También soporta los filtros que arma el buscador global de la barra
  // superior: /gastos?q=categoría, /gastos?estado=pendiente|vencido|pagado y
  // /gastos?mes=AAAA-MM. Cada uno parte de la lista limpia.
  useEffect(() => {
    const nuevo = searchParams.get("nuevo") === "1";
    const q = searchParams.get("q");
    const estado = searchParams.get("estado");
    const mes = searchParams.get("mes");
    const hayFiltro = q !== null || estado !== null || mes !== null;
    if (nuevo) abrirNuevo();
    if (hayFiltro) {
      setBusqueda(q ?? "");
      setFiltroEstado(
        estado === "pendiente" || estado === "vencido" || estado === "pagado" ? estado : "todos"
      );
      setMesesSeleccionados(mes && /^\d{4}-\d{2}$/.test(mes) ? [mes] : []);
      setPagina(1);
    }
    if (nuevo || hayFiltro) setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function cargarTodo() {
    if (!usuario) return;
    setCargando(true);
    try {
      const [datosGastos, datosCategorias, datosRecordatorios] = await Promise.all([
        gastosService.listarPorUsuario(usuario.id_usuario),
        tipoGastoService.listarPorUsuario(usuario.id_usuario),
        recordatoriosService.obtenerPorUsuario(usuario.id_usuario),
      ]);
      setGastos(datosGastos.gastos);
      setCategorias(datosCategorias);

      const mapa: Record<number, number> = {};
      datosRecordatorios.forEach((r) => {
        mapa[r.id_gasto] = r.tiempo_antelacion;
      });
      setRecordatorios(mapa);
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : "Error al cargar los gastos");
    } finally {
      setCargando(false);
    }
  }

  // Los gastos cancelados no se muestran en la lista activa (quedan en Historial)
  // y tampoco cuentan en estadísticas ni en el presupuesto disponible.
  const activos = gastos.filter((g) => g.estado !== "cancelado");

  // Meses del filtro (del más reciente al más antiguo): los que tienen gastos
  // más los que el usuario eligió, para que un mes sin gastos muestre la tabla
  // vacía en lugar de mostrar todos los meses.
  const clavesMes = new Set(activos.map((g) => claveDeFecha(g.fecha_vencimiento)));
  mesesSeleccionados.forEach((c) => clavesMes.add(c));
  const opcionesMes = Array.from(clavesMes)
    .sort()
    .reverse()
    .map((clave) => ({ clave, etiqueta: etiquetaDeClave(clave) }));

  // Siempre del más reciente al más antiguo según la fecha de vencimiento.
  const filtrados = activos
    .filter((g) => {
      const coincideBusqueda = g.categoria.toLowerCase().includes(busqueda.toLowerCase());
      const coincideEstado = filtroEstado === "todos" || g.estado === filtroEstado;
      const coincideMes =
        mesesSeleccionados.length === 0 ||
        mesesSeleccionados.includes(claveDeFecha(g.fecha_vencimiento));
      return coincideBusqueda && coincideEstado && coincideMes;
    })
    .sort(
      (a, b) =>
        new Date(b.fecha_vencimiento).getTime() - new Date(a.fecha_vencimiento).getTime() ||
        b.id_gasto - a.id_gasto
    );

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const paginados = filtrados.slice(
    (paginaSegura - 1) * PAGE_SIZE,
    paginaSegura * PAGE_SIZE
  );

  function abrirNuevo() {
    setGastoEditar(null);
    setModalAbierto(true);
  }

  function abrirEditar(gasto: Gasto) {
    setGastoEditar(gasto);
    setModalAbierto(true);
  }

  // Como el listado solo trae el nombre de la categoría, resolvemos el
  // id_tipo real buscándolo en las categorías del usuario por su nombre.
  function resolverIdTipo(gasto: Gasto | null): number | null {
    if (!gasto) return null;
    const encontrada = categorias.find((c) => c.detalle === gasto.categoria);
    return encontrada ? encontrada.id_tipo : null;
  }

  async function marcarComoPagado(gasto: Gasto) {
    try {
      await gastosService.cambiarEstado(gasto.id_gasto, "pagado");
      mostrarToast("Gasto marcado como pagado ✓");
      cargarTodo();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : "Error al actualizar el gasto");
    }
  }

  async function cancelarGasto(gasto: Gasto) {
    if (!confirm(`¿Cancelar el gasto "${gasto.categoria}"? Pasará al historial.`)) return;
    try {
      await gastosService.cambiarEstado(gasto.id_gasto, "cancelado");
      mostrarToast("Gasto cancelado");
      cargarTodo();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : "Error al cancelar el gasto");
    }
  }

  async function eliminarGasto(gasto: Gasto) {
    if (
      !confirm(
        `¿Eliminar definitivamente el gasto "${gasto.categoria}"? Esta acción no se puede deshacer.`
      )
    )
      return;
    try {
      await gastosService.eliminar(gasto.id_gasto);
      mostrarToast("Gasto eliminado");
      cargarTodo();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : "Error al eliminar el gasto");
    }
  }

  return (
    <>
      <header className="page-header">
        <h1>Mis Gastos</h1>
        <p>Gestiona, edita y controla el estado de todos tus gastos activos.</p>
      </header>

      <div className="table-toolbar">
        <button
          className={`filter-btn${filtroEstado === "todos" ? " active" : ""}`}
          onClick={() => setFiltroEstado("todos")}
        >
          Todos
        </button>
        <button
          className={`filter-btn${filtroEstado === "pendiente" ? " active" : ""}`}
          onClick={() => setFiltroEstado("pendiente")}
        >
          Pendientes
        </button>
        <button
          className={`filter-btn${filtroEstado === "vencido" ? " active" : ""}`}
          onClick={() => setFiltroEstado("vencido")}
        >
          Vencidos
        </button>
        <button
          className={`filter-btn${filtroEstado === "pagado" ? " active" : ""}`}
          onClick={() => setFiltroEstado("pagado")}
        >
          Pagados
        </button>
        <FiltroMeses
          opciones={opcionesMes}
          seleccion={mesesSeleccionados}
          onChange={(sel) => {
            setMesesSeleccionados(sel);
            setPagina(1);
          }}
        />
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Buscar categoría..."
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
          />
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Categoría</th>
            <th>Vencimiento</th>
            <th>Precio</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {cargando ? (
            <tr>
              <td colSpan={5}>Cargando...</td>
            </tr>
          ) : paginados.length === 0 ? (
            <tr>
              <td colSpan={5}>No hay gastos para mostrar.</td>
            </tr>
          ) : (
            paginados.map((g) => {
              const minutos = recordatorios[g.id_gasto];
              return (
                <tr key={g.id_gasto}>
                  <td>
                    <span className="service-cell">
                      <span
                        className="color-dot"
                        style={{ background: colorParaCategoria(g.categoria) }}
                      />
                      {g.categoria}
                    </span>
                  </td>
                  <td>
                    {formatDateTime(g.fecha_vencimiento)}
                    {minutos !== undefined && (
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--gray-400)",
                          marginTop: 2,
                        }}
                      >
                        🔔 Aviso: {formatDateTime(
                          calcularFechaNotificacion(g.fecha_vencimiento, minutos).toISOString()
                        )}{" "}
                        ({minutosAHoras(minutos)} antes)
                      </div>
                    )}
                  </td>
                  <td>{formatMoney(g.precio)}</td>
                  <td>
                    <EstadoBadge estado={g.estado} fechaVencimiento={g.fecha_vencimiento} />
                  </td>
                  <td>
                    {g.estado !== "pagado" && (
                      <button
                        className="action-btn"
                        title="Marcar como pagado"
                        onClick={() => marcarComoPagado(g)}
                      >
                        ✅
                      </button>
                    )}
                    <button
                      className="action-btn"
                      title="Editar"
                      onClick={() => abrirEditar(g)}
                    >
                      ✏️
                    </button>
                    <button
                      className="action-btn"
                      title="Cancelar"
                      onClick={() => cancelarGasto(g)}
                    >
                      🚫
                    </button>
                    <button
                      className="action-btn del"
                      title="Eliminar"
                      onClick={() => eliminarGasto(g)}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              );
            })
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

      <GastoFormModal
        open={modalAbierto}
        onClose={() => setModalAbierto(false)}
        onSaved={cargarTodo}
        categorias={categorias}
        onCategoriaCreada={(cat) => setCategorias((prev) => [...prev, cat])}
        gastoEditar={gastoEditar}
        idTipoResuelto={resolverIdTipo(gastoEditar)}
      />
    </>
  );
}