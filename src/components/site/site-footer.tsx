import { Gamepad2 } from "lucide-react";
import { profile } from "@/src/content";
import { GAME_HREF } from "./sectors";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        {/* convite pro modo jogo */}
        <a
          href={GAME_HREF}
          className="group relative flex flex-col items-start gap-6 overflow-hidden rounded-3xl border bg-card p-8 md:flex-row md:items-center md:justify-between md:p-12"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,#f2c87933,transparent_60%),radial-gradient(ellipse_at_bottom_left,#6fd08c22,transparent_55%)]" />
          <div className="relative">
            <p className="font-mono text-xs text-muted-foreground">modo jogo</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">Prefere explorar? Entre em Tóquio.</h2>
            <p className="mt-3 max-w-lg text-muted-foreground">
              O mesmo portfólio como uma Tóquio 3D: desça a escadaria, cruze Shibuya e escale telhados. Tem até espada.
            </p>
          </div>
          <span className="relative inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-primary px-6 font-medium text-primary-foreground transition-transform group-hover:scale-[1.03]">
            <Gamepad2 className="size-5" /> Jogar agora
          </span>
        </a>

        <div className="mt-12 flex flex-col justify-between gap-2 text-sm text-muted-foreground md:flex-row">
          <p>
            © {new Date().getFullYear()} {profile.name}
          </p>
          <p>Feito com Next.js, Three.js e muito café.</p>
        </div>
      </div>
    </footer>
  );
}
