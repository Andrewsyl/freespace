"use client";

import { useEffect, useState } from "react";

/**
 * Returns null until mounted (safe for SSR/hydration), then:
 *   true  → viewport is mobile (< 1024px, i.e. below Tailwind's lg breakpoint)
 *   false → viewport is desktop (≥ 1024px)
 */
export function useIsMobile(): boolean | null {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isMobile;
}
