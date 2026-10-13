"use client";

import { ArrowDown, Gamepad2, MapPin } from "lucide-react";
import { profile } from "@/src/content";
import { API_URL } from "@/src/config";
import { useMetrics } from "@/src/hooks/use-portfolio";
import { fmtInt, fmtUptime } from "./format";
import { GAME_HREF } from "./sectors";

// Cartão de terminal com a saúde da API: o portfólio prova que funciona
function StatusTerminal() {
  const { data, isLoading } = useMetrics();
  const m = data?.data;
  const live = data?.source === "api";
  const host = API_URL.replace(/^https?:\/\//, "");

  const rows: [string, string][] = [
    ["status", isLoading ? "…" : live ? '"ok"' : '"demo"'],
    ["latency_ms", m?.avgLatencyMs != null ? m.avgLatencyMs.toFixed(1) : "…"],
    ["uptime", m?.uptimeSec != null ? `"${fmtUptime(m.uptimeSec)}"` : "…"],
    ["requests", m ? fmtInt(m.requests).replace(/\./g, "_") : "…"],
    ["errors_5xx", m ? String(m.errors5xx) : "…"],
  ];

  return (
    <div className="relative w-full max-w-md overflow-hidden rounded-2xl border bg-[#0c0c0f] font-mono text-[13px] text-zinc-300 shadow-[0_30px_80px_-30px_var(--glow)]">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="size-3 rounded-full bg-[#ff5f57]" />
        <span className="size-3 rounded-full bg-[#febc2e]" />
        <span className="size-3 rounded-full bg-[#28c840]" />
        <span className="ml-2 truncate text-xs text-zinc-500">~/portfolio-back</span>
      </div>
      <div className="p-5 leading-relaxed">
        <p>
          <span className="text-[#6fd08c]">$</span> curl {host}/health
        </p>
        <p className="text-zinc-500">{"{"}</p>
        {rows.map(([k, v]) => (
          <p key={k} className="pl-4">
            <span className="text-[#4cc9f0]">&quot;{k}&quot;</span>: <span className="text-[#f2c879] tabular-nums">{v}</span>,
          </p>
        ))}
        <p className="text-zinc-500">{"}"}</p>
        <p className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
          <span
            className="live-dot size-1.5 rounded-full"
            style={{ background: live ? "#3ddc97" : "#a1a1aa", color: "#3ddc97" }}
          />
          {live ? "resposta real da API, atualizada a cada 5 s" : "API offline: mostrando dados de exemplo"}
        </p>
      </div>
    </div>
  );
}

export function IntroSection() {
  return (
    <section id="topo" className="relative overflow-hidden pt-28 md:pt-36">
      {/* fundo: grade + brilhos com as cores da vila */}
      <div className="bg-grid pointer-events-none absolute inset-0" />
      <div className="animate-float-slow pointer-events-none absolute -top-40 right-[-10%] size-[520px] rounded-full bg-[#f2c879]/15 blur-3xl" />
      <div className="animate-float-slow pointer-events-none absolute left-[-15%] top-40 size-[420px] rounded-full bg-[#4cc9f0]/10 blur-3xl [animation-delay:-7s]" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 md:px-6 lg:grid-cols-[1.25fr_1fr]">
        <div>
          {profile.available && (
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-sm text-muted-foreground backdrop-blur">
              <span className="live-dot size-2 rounded-full" style={{ background: "var(--status-good)", color: "var(--status-good)" }} />
              Disponível para novos projetos
            </p>
          )}
          <h1 className="font-display text-5xl font-semibold leading-[1.02] tracking-tight text-balance sm:text-6xl md:text-7xl">
            <span className="text-gradient">{profile.name}</span>
          </h1>
          <p className="mt-4 font-display text-xl text-muted-foreground md:text-2xl">{profile.role}</p>
          <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed">{profile.pitch}</p>
          <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-4" /> {profile.location}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#projetos"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Ver projetos <ArrowDown className="size-4" />
            </a>
            <a
              href={GAME_HREF}
              className="inline-flex h-11 items-center gap-2 rounded-xl border bg-card/60 px-5 font-medium backdrop-blur transition-colors hover:bg-muted"
            >
              <Gamepad2 className="size-4" /> Explorar a vila em 3D
            </a>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <StatusTerminal />
        </div>
      </div>

      <div className="relative border-y bg-card/40 backdrop-blur">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 divide-x px-4 md:grid-cols-4 md:px-6">
          {profile.stats.map((s, i) => (
            <div key={s.label} className={`px-4 py-6 md:px-6 ${i >= 2 ? "border-t md:border-t-0" : ""} ${i === 2 ? "border-l-0 md:border-l" : ""}`}>
              <dt className="text-sm text-muted-foreground">{s.label}</dt>
              <dd className="mt-1 font-display text-3xl font-semibold tracking-tight md:text-4xl">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
