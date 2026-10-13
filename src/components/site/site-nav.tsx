"use client";

import Link from "next/link";
import { Gamepad2, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { profile } from "@/src/content";
import { cn } from "@/src/lib/utils";
import { AuthButtons } from "../auth/signup/signup-button";
import { ThemeToggle } from "../themeToggle/themeToggle";
import { GAME_HREF, SITE_SECTIONS } from "./sectors";

const initials = profile.name
  .split(" ")
  .map((p) => p[0])
  .slice(0, 2)
  .join("");

// base: "" na página do site (rola até a seção), "/home" nas outras páginas
export function SiteNav({ base = "" }: { base?: string }) {
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // seção ativa = a que está cruzando a faixa do meio da tela
  useEffect(() => {
    if (base) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const s of SITE_SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [base]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled || open ? "border-b bg-background/75 backdrop-blur-xl" : "border-b border-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
        <Link href={base ? "/home" : "#topo"} className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="grid size-8 place-items-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground">
            {initials}
          </span>
          <span className="hidden font-display font-semibold sm:inline">{profile.name}</span>
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {SITE_SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`${base}#${s.id}`}
                className={cn(
                  "relative rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                  active === s.id && "bg-muted text-foreground",
                )}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <div className="hidden md:block">
            <AuthButtons />
          </div>
          <a
            href={GAME_HREF}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Gamepad2 className="size-4" />
            <span className="hidden sm:inline">Modo jogo</span>
          </a>
          <button
            className="grid size-8 place-items-center rounded-lg hover:bg-muted lg:hidden"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t px-4 pb-6 pt-2 lg:hidden">
          <ul className="grid gap-1">
            {SITE_SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`${base}#${s.id}`}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-3 text-lg font-medium hover:bg-muted"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4 md:hidden">
            <AuthButtons />
          </div>
        </div>
      )}
    </header>
  );
}
