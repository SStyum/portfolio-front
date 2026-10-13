import { cn } from "@/src/lib/utils";

// Número sozinho: rótulo em caixa normal, valor grande, detalhe opcional
export function StatTile({
  label,
  value,
  detail,
  className,
}: {
  label: string;
  value: string;
  detail?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}
