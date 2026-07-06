"use client";

import { useEffect, useState, type RefObject } from "react";

/** Track an element's content width (for responsive SVG charts). */
export function useElementWidth(
  ref: RefObject<HTMLElement>,
  fallback = 640,
): number {
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width;
      if (cw && cw > 0) setWidth(cw);
    });
    ro.observe(el);
    if (el.clientWidth > 0) setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [ref, fallback]);
  return width;
}
