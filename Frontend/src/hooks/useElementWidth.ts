import { useEffect, useRef, useState } from "react";

// Mide el ancho real de un elemento y lo actualiza cada vez que cambia
// (por ejemplo, al contraer o expandir el menú lateral). Así las gráficas
// se redibujan ocupando exactamente el espacio disponible.
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    const medir = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setWidth(Math.round(el.getBoundingClientRect().width));
      });
    };

    setWidth(Math.round(el.getBoundingClientRect().width));

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", medir);
      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", medir);
      };
    }

    const observer = new ResizeObserver(medir);
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return [ref, width] as const;
}