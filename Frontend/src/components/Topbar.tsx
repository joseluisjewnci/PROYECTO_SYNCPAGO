import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import BuscadorGlobal from "./BuscadorGlobal";

interface TopbarProps {
  onToggleSidebar: () => void;
  menuExpandido: boolean;
}

export default function Topbar({ onToggleSidebar, menuExpandido }: TopbarProps) {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <header className="topbar" role="banner">
      <button
        className="menu-toggle"
        onClick={onToggleSidebar}
        aria-label={menuExpandido ? "Contraer menú" : "Expandir menú"}
        aria-expanded={menuExpandido}
        aria-controls="sidebar"
      >
        <svg width="24" height="24" viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="M3 5h14M3 10h14M3 15h14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <BuscadorGlobal />
      <div className="topbar-right">
        <button className="notif-btn" aria-label="Notificaciones">🔔</button>
        <div
          className="user-menu"
          onClick={() => setDropdownOpen((v) => !v)}
          role="button"
          aria-haspopup="true"
        >
          <div className="avatar" aria-hidden="true">👤</div>
          <span>{usuario?.nombre ?? "Usuario"}</span> ▾
          <div className={`user-dropdown${dropdownOpen ? " open" : ""}`} role="menu">
            <div className="dd-header">
              <div className="dd-avatar" aria-hidden="true">👤</div>
              <div className="dd-name">{usuario?.nombre}</div>
              <div className="dd-email">{usuario?.correo}</div>
            </div>
            <div className="dd-item logout" onClick={handleLogout} role="menuitem">
              ↩ Cerrar sesión
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}