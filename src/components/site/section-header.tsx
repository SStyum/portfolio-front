import { ArrowUpRight } from "lucide-react";
import type { SectorId } from "@/src/world/layout";
import { sector } from "./sectors";

export function SectionHeader({ id, title, description }: { id: SectorId; title: string; description?: string }) {
  const s = sector(id);
  return (
    <div className="mb-10 flex flex-col gap-4 md:mb-14 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 font-mono text-xs text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: s.color, boxShadow: `0 0 12px ${s.color}` }} />
          {s.place} · {s.name}
        </p>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-balance md:text-5xl">{title}</h2>
        {description && <p className="mt-4 text-pretty text-muted-foreground md:text-lg">{description}</p>}
      </div>
      {/* <a> e não <Link>: o jogo é uma página à parte, com CSS próprio */}
      <a
        href={s.gameHref}
        className="group inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground md:self-auto"
      >
        Ver na vila
        <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </a>
    </div>
  );
}
