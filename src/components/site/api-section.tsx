"use client";

import { ExternalLink, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Endpoint } from "@/src/api";
import { SWAGGER_URL } from "@/src/config";
import { useEndpoints } from "@/src/hooks/use-portfolio";
import { cn } from "@/src/lib/utils";
import { Reveal } from "./reveal";
import { SectionHeader } from "./section-header";
import { SourceBadge } from "./source-badge";

// método HTTP: texto na cor do tema, só o fundo leva a cor
const METHOD_BG: Record<string, string> = {
  GET: "bg-[#3987e5]/15",
  POST: "bg-[#1baf7a]/15",
  PUT: "bg-[#eda100]/15",
  PATCH: "bg-[#eda100]/15",
  DELETE: "bg-[#e34948]/15",
};

export function ApiSection() {
  const { data, isLoading } = useEndpoints();
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (data?.data ?? []).filter(
      (e) => !q || `${e.method} ${e.path} ${e.summary} ${e.tag}`.toLowerCase().includes(q),
    );
    const byTag = new Map<string, Endpoint[]>();
    for (const e of list) byTag.set(e.tag, [...(byTag.get(e.tag) ?? []), e]);
    return [...byTag.entries()];
  }, [data, query]);

  const total = data?.data.length ?? 0;

  return (
    <section id="api" className="scroll-mt-20 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeader
          id="api"
          title="Documentação viva da API."
          description="Gerada automaticamente dos schemas Zod e servida pelo Swagger. Nada de documentação desatualizada."
        />

        <Reveal>
          <div className="overflow-hidden rounded-2xl border bg-card">
            <div className="flex flex-wrap items-center gap-3 border-b p-4">
              <label className="relative flex-1">
                <span className="sr-only">Buscar endpoint</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Buscar entre ${total} endpoints…`}
                  className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus:border-ring"
                />
              </label>
              <SourceBadge source={data?.source} />
              <a
                href={SWAGGER_URL}
                target="_blank"
                rel="noopener"
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border px-4 text-sm hover:bg-muted"
              >
                Abrir Swagger <ExternalLink className="size-3.5" />
              </a>
            </div>

            <div className="max-h-[560px] overflow-y-auto p-2">
              {isLoading && <div className="m-2 h-60 animate-pulse rounded-lg bg-muted" />}
              {!isLoading && groups.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">Nenhum endpoint com &quot;{query}&quot;.</p>
              )}
              {groups.map(([tag, list]) => (
                <div key={tag} className="mb-2">
                  <h3 className="sticky top-0 z-10 bg-card/95 px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground backdrop-blur">
                    {tag}
                  </h3>
                  <ul>
                    {list.map((e) => (
                      <li
                        key={`${e.method} ${e.path}`}
                        className="grid grid-cols-[4.5rem_1fr] items-center gap-x-3 gap-y-0.5 rounded-lg px-3 py-2.5 hover:bg-muted/60 md:grid-cols-[4.5rem_minmax(0,22rem)_1fr]"
                      >
                        <span className={cn("rounded-md px-2 py-0.5 text-center font-mono text-[11px] font-semibold", METHOD_BG[e.method] ?? "bg-muted")}>
                          {e.method}
                        </span>
                        <code className="truncate font-mono text-sm">{e.path}</code>
                        <span className="col-start-2 truncate text-sm text-muted-foreground md:col-start-3">{e.summary}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
