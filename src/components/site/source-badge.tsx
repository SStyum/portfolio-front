import type { Source } from "@/src/services/portfolio";
import { cn } from "@/src/lib/utils";

// Deixa claro se o dado veio da API ou dos exemplos
export function SourceBadge({ source, className }: { source?: Source; className?: string }) {
  if (!source) return null;
  const live = source === "api";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground",
        className,
      )}
    >
      <span
        className={cn("size-1.5 rounded-full", live && "live-dot")}
        style={{ background: live ? "var(--status-good)" : "var(--muted-foreground)", color: "var(--status-good)" }}
      />
      {live ? "API ao vivo" : "dados de exemplo"}
    </span>
  );
}
