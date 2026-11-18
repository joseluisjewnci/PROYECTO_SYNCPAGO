import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { ENLACES_MENU } from "../utils/navegacion";

interface SidebarProps {
  open: boolean; // en móvil: menú desplegado sobre el contenido
  collapsed: boolean; // en escritorio: solo iconos
  onNavigate: () => void;
}

export default function Sidebar({ open, collapsed, onNavigate }: SidebarProps) {
  const navigate = useNavigate();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `nav-item${isActive ? " active" : ""}`;

  function handleAgregarGasto() {
    navigate("/gastos?nuevo=1");
    onNavigate();
  }

  return (
    <nav className={`sidebar${open ? " open" : ""}`} id="sidebar" aria-label="Menú principal">
      <div className="sidebar-logo" role="img" aria-label="SyncPago">
        <span className="logo-full">
          SYNC<span className="logo-accent">PAGO</span>
        </span>
        <span className="logo-mini" aria-hidden="true">
          S<span className="logo-accent">P</span>
        </span>
      </div>
      <div className="sidebar-nav">
        {ENLACES_MENU.map((enlace) => (
          <NavLink
            key={enlace.to}
            to={enlace.to}
            className={linkClass}
            onClick={onNavigate}
            title={collapsed ? enlace.texto : undefined}
          >
            <span className="nav-icon" aria-hidden="true">
              {enlace.icono}
            </span>
            <span className="nav-label">{enlace.texto}</span>
          </NavLink>
        ))}
      </div>
      <button
        className="nav-btn-add"
        onClick={handleAgregarGasto}
        title={collapsed ? "Agregar Gasto" : undefined}
      >
        <span className="nav-icon" aria-hidden="true">
          +
        </span>
        <span className="nav-label">Agregar Gasto</span>
      </button>
    </nav>
  );
}