"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/src/lib/utils";

// Aparece subindo quando entra na tela (desligado com prefers-reduced-motion, ver globals.css)
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.dataset.visible = "true";
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} data-reveal className={cn(className)} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
