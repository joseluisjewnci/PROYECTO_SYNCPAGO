import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useMediaQuery } from "../hooks/useMediaQuery";

export default function Layout() {
  // Escritorio: el botón hamburguesa contrae/expande el menú (solo iconos).
  // Móvil (<= 768px): el mismo botón abre/cierra el menú sobre el contenido.
  const esMovil = useMediaQuery("(max-width: 768px)");
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!esMovil) setSidebarOpen(false);
  }, [esMovil]);

  function alternarMenu() {
    if (esMovil) setSidebarOpen((v) => !v);
    else setCollapsed((v) => !v);
  }

  const menuExpandido = esMovil ? sidebarOpen : !collapsed;

  return (
    <div className={`app-layout${collapsed && !esMovil ? " sidebar-collapsed" : ""}`}>
      <Sidebar
        open={sidebarOpen}
        collapsed={collapsed && !esMovil}
        onNavigate={() => setSidebarOpen(false)}
      />
      <div
        className={`sidebar-overlay${sidebarOpen ? " open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      <div className="main-wrap">
        <Topbar onToggleSidebar={alternarMenu} menuExpandido={menuExpandido} />

        <main className="content">
          <Outlet />
        </main>

        <footer
          style={{
            padding: "16px 28px",
            fontSize: "0.78rem",
            color: "var(--gray-400)",
            textAlign: "center",
            borderTop: "1px solid var(--gray-200)",
          }}
        >
          © 2026 SYNCPAGO — Todos los derechos reservados
        </footer>
      </div>
    </div>
  );
}