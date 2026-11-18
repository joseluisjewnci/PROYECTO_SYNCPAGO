import { useEffect, useState } from "react";

// Indica si una media query CSS se cumple en este momento y se actualiza
// al redimensionar la ventana (p. ej. "(max-width: 768px)").
export function useMediaQuery(query: string): boolean {
  const [coincide, setCoincide] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const actualizar = () => setCoincide(mql.matches);
    actualizar();
    mql.addEventListener("change", actualizar);
    return () => mql.removeEventListener("change", actualizar);
  }, [query]);

  return coincide;
}