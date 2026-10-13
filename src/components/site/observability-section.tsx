"use client";

import { Activity, ExternalLink, Lock, Sparkles } from "lucide-react";
import { useState } from "react";
import { GRAFANA_DASHBOARD_URL, PROMETHEUS_URL } from "@/src/config";
import { useIsPremium } from "@/src/hooks/use-premium";
import { useDashboard, useMetrics } from "@/src/hooks/use-portfolio";
import { mockDashboard } from "@/src/mocks/portfolio";
import { PREMIUM_PLAN, usePremiumStore } from "@/src/stores/premium.store";
import { StatTile } from "./charts/stat-tile";
import { CheckoutDialog } from "./checkout-dialog";
import { fmtDate, fmtInt, fmtUptime } from "./format";
import { GrafanaDashboard } from "./grafana-dashboard";
import { Reveal } from "./reveal";
import { SectionHeader } from "./section-header";
import { SourceBadge } from "./source-badge";

// prévia borrada atrás do cadeado: dados fixos (horário fixo, igual no servidor e no navegador), nunca os reais
const PREVIEW = mockDashboard(60, Date.UTC(2026, 0, 1, 15));

export function ObservabilitySection() {
  const premium = useIsPremium();
  const since = usePremiumStore((s) => s.since);
  const cancel = usePremiumStore((s) => s.cancel);
  const metrics = useMetrics();
  const dashboard = useDashboard(premium);
  const [checkout, setCheckout] = useState(false);
  const [embed, setEmbed] = useState(false);

  const m = metrics.data?.data;

  return (
    <section id="observatorio" className="scroll-mt-20 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeader
          id="observatorio"
          title="Tudo o que acontece na API, ao vivo."
          description="A API expõe métricas no formato Prometheus; o Prometheus coleta a cada poucos segundos e o Grafana desenha. Os números básicos são abertos. O dashboard completo é para assinantes."
        />

        <Reveal>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h3 className="inline-flex items-center gap-2 font-medium">
              <Activity className="size-4 text-primary" /> Agora
            </h3>
            <SourceBadge source={metrics.data?.source} />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <StatTile label="Requisições" value={m ? fmtInt(m.requests) : "–"} />
            <StatTile label="Latência média" value={m?.avgLatencyMs != null ? `${m.avgLatencyMs.toFixed(1)} ms` : "–"} />
            <StatTile label="Erros 5xx" value={m ? fmtInt(m.errors5xx) : "–"} />
            <StatTile label="Memória (RSS)" value={m?.memoryMb != null ? `${m.memoryMb.toFixed(0)} MB` : "–"} />
            <StatTile label="Event loop lag" value={m?.eventLoopLagMs != null ? `${m.eventLoopLagMs.toFixed(1)} ms` : "–"} />
            <StatTile label="No ar há" value={m?.uptimeSec != null ? fmtUptime(m.uptimeSec) : "–"} />
          </div>
        </Reveal>

        <Reveal className="mt-12">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="inline-flex items-center gap-2 font-medium">
              <Sparkles className="size-4 text-primary" /> Dashboard Grafana
              {premium && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-normal text-primary">assinante</span>
              )}
            </h3>
            {premium && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <a href={GRAFANA_DASHBOARD_URL} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 hover:bg-muted">
                  Abrir no Grafana <ExternalLink className="size-3.5" />
                </a>
                <a href={PROMETHEUS_URL} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 hover:bg-muted">
                  Prometheus <ExternalLink className="size-3.5" />
                </a>
                <button onClick={() => setEmbed((e) => !e)} className="rounded-lg border px-3 py-1.5 hover:bg-muted">
                  {embed ? "Ver painéis do site" : "Embutir o Grafana real"}
                </button>
              </div>
            )}
          </div>

          {premium ? (
            <>
              {embed ? (
                <div className="overflow-hidden rounded-xl border">
                  <iframe
                    src={`${GRAFANA_DASHBOARD_URL}?orgId=1&kiosk&theme=dark&refresh=5s`}
                    title="Dashboard Grafana"
                    className="h-[640px] w-full bg-card"
                  />
                  <p className="border-t p-3 text-xs text-muted-foreground">
                    Se ficar em branco, o Grafana não está rodando ou não permite ser embutido (veja <code>GF_SECURITY_ALLOW_EMBEDDING</code> no docker-compose).
                  </p>
                </div>
              ) : dashboard.data ? (
                <GrafanaDashboard data={dashboard.data.data} metrics={m} />
              ) : (
                <div className="h-96 animate-pulse rounded-xl border bg-card" />
              )}
              <p className="mt-4 text-xs text-muted-foreground">
                Assinante desde {since ? fmtDate(since) : "hoje"} ·{" "}
                <button onClick={cancel} className="underline underline-offset-2 hover:text-foreground">
                  cancelar assinatura (demonstração)
                </button>
              </p>
            </>
          ) : (
            <div className="relative overflow-hidden rounded-2xl border">
              {/* prévia borrada: dá vontade sem entregar nada */}
              <div aria-hidden className="pointer-events-none max-h-[520px] select-none overflow-hidden p-4 opacity-60 blur-[6px]">
                <GrafanaDashboard data={PREVIEW} />
              </div>
              <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-background/30 via-background/70 to-background/95 p-4">
                <div className="w-full max-w-md rounded-2xl border bg-popover/95 p-6 text-center shadow-2xl backdrop-blur">
                  <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary/15">
                    <Lock className="size-5 text-primary" />
                  </span>
                  <h4 className="mt-4 font-display text-xl font-semibold">O Observatório é exclusivo para assinantes</h4>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Latência p50/p95, taxa de erro e tráfego por rota, atualizados a cada poucos segundos, direto do Grafana.
                  </p>
                  <button
                    onClick={() => setCheckout(true)}
                    className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    Desbloquear por {PREMIUM_PLAN.price}
                    {PREMIUM_PLAN.period}
                  </button>
                  <p className="mt-3 text-xs text-muted-foreground">Pagamento simulado nesta versão.</p>
                </div>
              </div>
            </div>
          )}
        </Reveal>
      </div>
      <CheckoutDialog open={checkout} onOpenChange={setCheckout} />
    </section>
  );
}
