import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { gastosService } from "../services/gastosService";
import type { Gasto } from "../interfaces/gasto";
import { ENLACES_MENU } from "../utils/navegacion";
import type { EnlaceMenu } from "../utils/navegacion";
import { claveMes } from "../utils/estadisticas";
import { colorParaCategoria, formatDateTime, formatMoney } from "../utils/format";

interface FiltroRapido {
  id: string;
  icono: string;
  texto: string;
  ruta: string; // pantalla de Gastos ya filtrada (/gastos?estado=... o ?mes=...)
  palabras: string;
}

interface CategoriaTop {
  nombre: string;
  total: number;
}

type Resultado =
  | { tipo: "pagina"; clave: string; enlace: EnlaceMenu }
  | { tipo: "filtro"; clave: string; filtro: FiltroRapido }
  | { tipo: "categoria"; clave: string; categoria: CategoriaTop }
  | { tipo: "gasto"; clave: string; gasto: Gasto };

const MAX_GASTOS = 6;
const MAX_CATEGORIAS = 5;
const REFRESCO_MS = 30000;

// Quita tildes y mayúsculas para que "estadisticas" encuentre "Estadísticas".
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function crearFiltrosRapidos(): FiltroRapido[] {
  const hoy = new Date();
  const esteMes = claveMes(hoy.getFullYear(), hoy.getMonth());
  const anterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const mesPasado = claveMes(anterior.getFullYear(), anterior.getMonth());
  return [
    { id: "pendientes", icono: "⏳", texto: "Pendientes", ruta: "/gastos?estado=pendiente", palabras: "por pagar" },
    { id: "vencidos", icono: "⚠️", texto: "Vencidos", ruta: "/gastos?estado=vencido", palabras: "atrasados mora" },
    { id: "pagados", icono: "✅", texto: "Pagados", ruta: "/gastos?estado=pagado", palabras: "cancelados al dia" },
    { id: "este-mes", icono: "📅", texto: "Este mes", ruta: `/gastos?mes=${esteMes}`, palabras: "mes actual" },
    { id: "mes-pasado", icono: "🗓️", texto: "Mes pasado", ruta: `/gastos?mes=${mesPasado}`, palabras: "mes anterior" },
  ];
}

// Buscador de la barra superior: encuentra páginas, filtros rápidos,
// categorías principales y gastos del usuario. Atajo: "/" enfoca el
// buscador, flechas + Enter para elegir y Escape para cerrar.
export default function BuscadorGlobal() {
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const [consulta, setConsulta] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [cargando, setCargando] = useState(false);

  const contenedorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cargadoEn = useRef(0);

  // Los gastos se piden al enfocar el buscador (y se refrescan cada 30 s)
  // para no consultar el backend si el usuario nunca busca.
  async function cargarGastos() {
    if (!usuario) return;
    if (Date.now() - cargadoEn.current < REFRESCO_MS) return;
    cargadoEn.current = Date.now();
    setCargando(true);
    try {
      const data = await gastosService.listarPorUsuario(usuario.id_usuario);
      setGastos(data.gastos);
    } catch {
      cargadoEn.current = 0; // permite reintentar en el próximo foco
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    function atajo(e: KeyboardEvent) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const escribiendo =
        el && (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable);
      if (escribiendo) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    function cerrarAlTocarFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("keydown", atajo);
    document.addEventListener("mousedown", cerrarAlTocarFuera);
    return () => {
      document.removeEventListener("keydown", atajo);
      document.removeEventListener("mousedown", cerrarAlTocarFuera);
    };
  }, []);

  const q = normalizar(consulta.trim());
  const activos = gastos.filter((g) => g.estado !== "cancelado");

  // Categorías principales = las 5 en las que más dinero llevas gastado.
  const totalesPorCategoria: Record<string, number> = {};
  activos.forEach((g) => {
    totalesPorCategoria[g.categoria] = (totalesPorCategoria[g.categoria] ?? 0) + g.precio;
  });
  const categoriasTop: CategoriaTop[] = Object.entries(totalesPorCategoria)
    .map(([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, MAX_CATEGORIAS)
    .filter((c) => q === "" || normalizar(c.nombre).includes(q));

  const filtros = crearFiltrosRapidos().filter(
    (f) => q === "" || normalizar(`${f.texto} ${f.palabras}`).includes(q)
  );

  const paginas = ENLACES_MENU.filter(
    (e) => q === "" || normalizar(`${e.texto} ${e.palabras}`).includes(q)
  );

  const gastosEncontrados =
    q === ""
      ? []
      : activos
          .filter((g) =>
            normalizar(
              `${g.categoria} ${g.estado} ${g.precio} ${formatMoney(g.precio)} ${formatDateTime(g.fecha_vencimiento)}`
            ).includes(q)
          )
          .sort(
            (a, b) =>
              new Date(b.fecha_vencimiento).getTime() - new Date(a.fecha_vencimiento).getTime()
          )
          .slice(0, MAX_GASTOS);

  // Mismo orden que se dibuja en pantalla, para que las flechas recorran la lista.
  const resultados: Resultado[] = [
    ...paginas.map((enlace): Resultado => ({ tipo: "pagina", clave: `p-${enlace.to}`, enlace })),
    ...filtros.map((filtro): Resultado => ({ tipo: "filtro", clave: `f-${filtro.id}`, filtro })),
    ...categoriasTop.map(
      (categoria): Resultado => ({ tipo: "categoria", clave: `c-${categoria.nombre}`, categoria })
    ),
    ...gastosEncontrados.map(
      (gasto): Resultado => ({ tipo: "gasto", clave: `g-${gasto.id_gasto}`, gasto })
    ),
  ];
  const indiceActivo = Math.min(activo, Math.max(0, resultados.length - 1));

  function cerrar() {
    setAbierto(false);
    setConsulta("");
    setActivo(0);
    inputRef.current?.blur();
  }

  function elegir(r: Resultado) {
    if (r.tipo === "pagina") navigate(r.enlace.to);
    else if (r.tipo === "filtro") navigate(r.filtro.ruta);
    else if (r.tipo === "categoria") navigate(`/gastos?q=${encodeURIComponent(r.categoria.nombre)}`);
    else navigate(`/gastos?q=${encodeURIComponent(r.gasto.categoria)}`);
    cerrar();
  }

  function alPulsarTecla(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      cerrar();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setAbierto(true);
      setActivo((indiceActivo + 1) % Math.max(1, resultados.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((indiceActivo - 1 + resultados.length) % Math.max(1, resultados.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (resultados.length > 0) elegir(resultados[indiceActivo]);
      else if (consulta.trim()) {
        navigate(`/gastos?q=${encodeURIComponent(consulta.trim())}`);
        cerrar();
      }
    }
  }

  function propsDe(r: Resultado) {
    const indice = resultados.indexOf(r);
    return {
      type: "button" as const,
      role: "option",
      "aria-selected": indice === indiceActivo,
      onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
      onMouseEnter: () => setActivo(indice),
      onClick: () => elegir(r),
      activo: indice === indiceActivo,
    };
  }

  function renderFila(r: Resultado) {
    const { activo: esActivo, ...props } = propsDe(r);
    return (
      <button key={r.clave} {...props} className={`search-result${esActivo ? " activo" : ""}`}>
        {r.tipo === "pagina" ? (
          <>
            <span className="search-result-icon" aria-hidden="true">
              {r.enlace.icono}
            </span>
            <span className="search-result-text">{r.enlace.texto}</span>
          </>
        ) : r.tipo === "gasto" ? (
          <>
            <span className="search-result-icon" aria-hidden="true">
              💳
            </span>
            <span className="search-result-text">
              {r.gasto.categoria}
              <small>
                {formatDateTime(r.gasto.fecha_vencimiento)} · {r.gasto.estado}
              </small>
            </span>
            <span className="search-result-monto">{formatMoney(r.gasto.precio)}</span>
          </>
        ) : null}
      </button>
    );
  }

  function renderChip(r: Resultado) {
    const { activo: esActivo, ...props } = propsDe(r);
    return (
      <button key={r.clave} {...props} className={`search-chip${esActivo ? " activo" : ""}`}>
        {r.tipo === "filtro" ? (
          <>
            <span aria-hidden="true">{r.filtro.icono}</span>
            {r.filtro.texto}
          </>
        ) : r.tipo === "categoria" ? (
          <>
            <span
              className="search-chip-dot"
              style={{ background: colorParaCategoria(r.categoria.nombre) }}
            />
            {r.categoria.nombre}
            <small>{formatMoney(r.categoria.total)}</small>
          </>
        ) : null}
      </button>
    );
  }

  return (
    <div className="search-bar" role="search" ref={contenedorRef}>
      <span className="search-icon" aria-hidden="true">
        🔍
      </span>
      <input
        ref={inputRef}
        type="text"
        placeholder="Buscar gastos o páginas...  ( / )"
        aria-label="Buscar gastos o páginas"
        role="combobox"
        aria-expanded={abierto}
        aria-controls="busqueda-resultados"
        aria-autocomplete="list"
        autoComplete="off"
        value={consulta}
        onChange={(e) => {
          setConsulta(e.target.value);
          setActivo(0);
          setAbierto(true);
        }}
        onFocus={() => {
          setAbierto(true);
          cargarGastos();
        }}
        onClick={() => setAbierto(true)}
        onKeyDown={alPulsarTecla}
      />

      {abierto && (
        <div className="search-results" id="busqueda-resultados" role="listbox">
          {paginas.length > 0 && (
            <>
              <div className="search-group">{q === "" ? "Ir a" : "Páginas"}</div>
              {resultados.filter((r) => r.tipo === "pagina").map(renderFila)}
            </>
          )}

          {filtros.length > 0 && (
            <>
              <div className="search-group">Filtros rápidos</div>
              <div className="search-chips">
                {resultados.filter((r) => r.tipo === "filtro").map(renderChip)}
              </div>
            </>
          )}

          {categoriasTop.length > 0 ? (
            <>
              <div className="search-group">Categorías principales</div>
              <div className="search-chips">
                {resultados.filter((r) => r.tipo === "categoria").map(renderChip)}
              </div>
            </>
          ) : (
            q === "" &&
            cargando && (
              <>
                <div className="search-group">Categorías principales</div>
                <div className="search-empty">Cargando...</div>
              </>
            )
          )}

          {q !== "" && (
            <>
              <div className="search-group">Gastos</div>
              {gastosEncontrados.length > 0 ? (
                resultados.filter((r) => r.tipo === "gasto").map(renderFila)
              ) : (
                <div className="search-empty">
                  {cargando ? "Buscando..." : "No encontré gastos con ese texto."}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}