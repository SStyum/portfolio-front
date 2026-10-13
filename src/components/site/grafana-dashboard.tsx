"use client";

import type { MetricsSummary } from "@/src/api";
import type { DashboardData } from "@/src/mocks/portfolio";
import { BarList } from "./charts/bar-list";
import { LineChart } from "./charts/line-chart";
import { StatTile } from "./charts/stat-tile";
import { fmtInt, fmtUptime } from "./format";

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border bg-card p-4 ${className}`}>
      <h4 className="mb-3 text-sm font-medium">{title}</h4>
      {children}
    </section>
  );
}

const ms = (v: number) => `${Math.round(v)} ms`;

// Painéis no formato do dashboard "Portfolio API" do Grafana
export function GrafanaDashboard({ data, metrics }: { data: DashboardData; metrics?: MetricsSummary }) {
  const last = (s: { v: number }[]) => s[s.length - 1]?.v ?? 0;
  const rpm = data.requestsPerMin;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Requisições por minuto" value={fmtInt(last(rpm))} detail="último minuto" />
        <StatTile label="Latência p95" value={ms(last(data.latencyP95))} detail={`p50 ${ms(last(data.latencyP50))}`} />
        <StatTile label="Taxa de erro 5xx" value={`${last(data.errorRate).toFixed(2)}%`} detail="média da última hora" />
        <StatTile label="No ar há" value={metrics?.uptimeSec ? fmtUptime(metrics.uptimeSec) : "–"} detail="desde o último deploy" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Requisições por minuto">
          <LineChart
            label="Requisições por minuto na última hora"
            series={[{ name: "Requisições", color: "var(--series-1)", points: rpm }]}
            format={(v) => fmtInt(v)}
          />
        </Panel>
        <Panel title="Latência (ms)">
          <LineChart
            label="Latência p50 e p95 em milissegundos na última hora"
            series={[
              { name: "p50", color: "var(--series-1)", points: data.latencyP50 },
              { name: "p95", color: "var(--series-2)", points: data.latencyP95 },
            ]}
            format={(v) => `${Math.round(v)}`}
          />
        </Panel>
        <Panel title="Taxa de erro 5xx (%)">
          <LineChart
            label="Porcentagem de respostas 5xx na última hora"
            series={[{ name: "Erros 5xx", color: "var(--series-1)", points: data.errorRate }]}
            format={(v) => v.toFixed(1)}
            height={180}
          />
        </Panel>
        <Panel title="Rotas mais chamadas">
          <BarList items={(metrics?.topRoutes ?? []).map((r) => ({ label: r.route, value: r.count }))} />
        </Panel>
      </div>
    </div>
  );
}
