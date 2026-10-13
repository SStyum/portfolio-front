"use client";

import { useCallback, useId, useState } from "react";
import { fmtTime } from "../format";

export interface ChartSeries {
  name: string;
  color: string; // var(--series-n)
  points: { t: number; v: number }[]; // todas as séries com os mesmos instantes
}

// arredonda o passo do eixo pra 1, 2, 2,5 ou 5 × 10^k
function niceStep(raw: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

function useWidth() {
  const [width, setWidth] = useState(0);
  const ref = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function LineChart({
  series,
  format,
  height = 200,
  label,
}: {
  series: ChartSeries[];
  format: (v: number) => string;
  height?: number;
  label: string; // descrição pra leitor de tela
}) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const gradId = useId();

  const n = series[0]?.points.length ?? 0;
  const multi = series.length > 1;
  const m = { top: 10, right: multi ? 40 : 12, bottom: 24, left: 44 };
  const iw = Math.max(1, width - m.left - m.right);
  const ih = height - m.top - m.bottom;

  const max = Math.max(...series.flatMap((s) => s.points.map((p) => p.v)), 0);
  const step = niceStep((max * 1.1) / 4);
  const yMax = step * 4;
  const x = (i: number) => m.left + (n <= 1 ? 0 : (i / (n - 1)) * iw);
  const y = (v: number) => m.top + ih - (v / yMax) * ih;

  const path = (s: ChartSeries) => s.points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join("");

  // rótulos no fim das linhas, afastados se colidirem
  const ends = series
    .map((s) => ({ name: s.name, y: y(s.points[n - 1]?.v ?? 0) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 13);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - m.left;
    setHover(Math.max(0, Math.min(n - 1, Math.round((px / iw) * (n - 1)))));
  };

  const xTicks = n > 1 ? [0, Math.round((n - 1) / 3), Math.round(((n - 1) * 2) / 3), n - 1] : [];
  const tipLeft = hover !== null ? Math.min(Math.max(x(hover) + 12, 0), width - 168) : 0;
  const tipFlip = hover !== null && x(hover) + 12 + 160 > width;

  return (
    <div className="relative">
      {multi && (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {series.map((s) => (
            <li key={s.name} className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <div ref={ref} className="w-full" style={{ height }}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={label}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            className="touch-pan-y select-none"
          >
            <defs>
              <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={series[0]?.color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={series[0]?.color} stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* grade e eixo y, recessivos */}
            {[0, 1, 2, 3, 4].map((k) => (
              <g key={k}>
                <line x1={m.left} x2={m.left + iw} y1={y(step * k)} y2={y(step * k)} stroke="var(--chart-grid)" />
                <text x={m.left - 8} y={y(step * k)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
                  {format(step * k)}
                </text>
              </g>
            ))}
            {xTicks.map((i) => (
              <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="fill-muted-foreground text-[10px] tabular-nums">
                {fmtTime(series[0].points[i].t)}
              </text>
            ))}

            {!multi && series[0] && n > 1 && (
              <path d={`${path(series[0])}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill={`url(#${gradId})`} />
            )}
            {series.map((s) => (
              <path key={s.name} d={path(s)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}

            {multi &&
              ends.map((e) => (
                <text key={e.name} x={m.left + iw + 6} y={e.y} dy="0.32em" className="fill-muted-foreground text-[10px]">
                  {e.name}
                </text>
              ))}

            {hover !== null && (
              <g pointerEvents="none">
                <line x1={x(hover)} x2={x(hover)} y1={m.top} y2={m.top + ih} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
                {series.map((s) => (
                  <circle key={s.name} cx={x(hover)} cy={y(s.points[hover].v)} r={4} fill={s.color} stroke="var(--chart-surface)" strokeWidth={2} />
                ))}
              </g>
            )}
            {/* área de captura maior que as linhas */}
            <rect x={m.left} y={m.top} width={iw} height={ih} fill="transparent" />
          </svg>
        )}
      </div>

      {hover !== null && series[0]?.points[hover] && (
        <div
          className="pointer-events-none absolute top-8 z-10 w-40 rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg"
          style={{ left: tipFlip ? Math.max(0, x(hover) - 172) : tipLeft }}
        >
          <p className="mb-1 font-mono text-muted-foreground">{fmtTime(series[0].points[hover].t)}</p>
          {series.map((s) => (
            <p key={s.name} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2 rounded-full" style={{ background: s.color }} />
                {s.name}
              </span>
              <span className="font-medium tabular-nums">{format(s.points[hover].v)}</span>
            </p>
          ))}
        </div>
      )}

      {/* versão em tabela pra leitor de tela (últimos 10 minutos) */}
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th>Horário</th>
            {series.map((s) => (
              <th key={s.name}>{s.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {series[0]?.points.slice(-10).map((p, i) => {
            const idx = Math.max(0, n - 10) + i;
            return (
              <tr key={p.t}>
                <td>{fmtTime(p.t)}</td>
                {series.map((s) => (
                  <td key={s.name}>{format(s.points[idx]?.v ?? 0)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
