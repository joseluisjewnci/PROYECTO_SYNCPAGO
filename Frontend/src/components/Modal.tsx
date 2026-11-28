import React, { useEffect, useId, useRef } from "react";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ open, title, onClose, children, footer }: ModalProps) {
  const tituloId = useId();
  const dialogoRef = useRef<HTMLDivElement>(null);
  const cerrarRef = useRef(onClose);
  cerrarRef.current = onClose;

  // Con el modal abierto: el foco entra en él, Escape lo cierra, Tab no se sale de la ventana
  // y, al cerrarlo, el foco vuelve al botón que lo abrió.
  useEffect(() => {
    if (!open) return;
    const anterior = document.activeElement as HTMLElement | null;
    dialogoRef.current?.focus();

    function alPulsarTecla(e: KeyboardEvent) {
      if (e.key === "Escape") {
        cerrarRef.current();
        return;
      }
      if (e.key !== "Tab" || !dialogoRef.current) return;
      const elementos = Array.from(dialogoRef.current.querySelectorAll<HTMLElement>(ENFOCABLES));
      if (elementos.length === 0) return;
      const primero = elementos[0];
      const ultimo = elementos[elementos.length - 1];
      const activo = document.activeElement;
      if (e.shiftKey && (activo === primero || activo === dialogoRef.current)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener("keydown", alPulsarTecla);
    return () => {
      document.removeEventListener("keydown", alPulsarTecla);
      anterior?.focus();
    };
  }, [open]);

  return (
    <div className={`modal-overlay${open ? " open" : ""}`} onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        ref={dialogoRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <button type="button" className="modal-back" onClick={onClose} aria-label="Cerrar y volver">
            ←
          </button>
          <h2 id={tituloId}>{title}</h2>
          <span style={{ width: "2rem" }} aria-hidden="true" />
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}