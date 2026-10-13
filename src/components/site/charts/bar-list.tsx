import { fmtInt } from "../format";

// Barras horizontais finas: rótulo em cima, valor na ponta, ponta arredondada e base reta
export function BarList({ items, color = "var(--series-1)" }: { items: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="grid gap-3">
      {items.map((it) => (
        <li key={it.label} className="group" title={`${it.label}: ${fmtInt(it.value)} requisições`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <code className="truncate font-mono text-muted-foreground group-hover:text-foreground">{it.label}</code>
            <span className="tabular-nums">{fmtInt(it.value)}</span>
          </div>
          <div className="h-2 w-full">
            <div
              className="h-full rounded-r-[4px] transition-[width] duration-700 group-hover:opacity-80"
              style={{ width: `${(it.value / max) * 100}%`, background: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
