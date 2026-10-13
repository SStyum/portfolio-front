"use client";

import { useState } from "react";
import { projects, type ProjectCategory } from "@/src/content";
import { cn } from "@/src/lib/utils";
import { ProjectCard } from "./project-card";
import { Reveal } from "./reveal";
import { SectionHeader } from "./section-header";

const CATEGORIES = ["Todos", ...new Set(projects.map((p) => p.category))] as ("Todos" | ProjectCategory)[];

export function ProjectsSection() {
  const [filter, setFilter] = useState<(typeof CATEGORIES)[number]>("Todos");
  const visible = projects.filter((p) => filter === "Todos" || p.category === filter);
  const featured = filter === "Todos" ? visible.filter((p) => p.featured) : [];
  const rest = visible.filter((p) => !featured.includes(p));

  return (
    <section id="projetos" className="scroll-mt-20 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeader
          id="projetos"
          title="Coisas que eu já construí."
          description="De APIs com pagamentos e mensageria a um mundo 3D inteiro desenhado em código. Clique em qualquer projeto pra ver a história completa."
        />

        <div role="group" aria-label="Filtrar projetos por categoria" className="mb-8 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const count = c === "Todos" ? projects.length : projects.filter((p) => p.category === c).length;
            return (
              <button
                key={c}
                onClick={() => setFilter(c)}
                aria-pressed={filter === c}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm transition-colors",
                  filter === c ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                )}
              >
                {c} <span className="ml-1 font-mono text-xs opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        {featured.length > 0 && (
          <div className="mb-6 grid gap-6 md:grid-cols-2">
            {featured.map((p, i) => (
              <Reveal key={p.slug} delay={i * 80} className="h-full">
                <ProjectCard project={p} large />
              </Reveal>
            ))}
          </div>
        )}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((p, i) => (
            <Reveal key={p.slug} delay={(i % 3) * 80} className="h-full">
              <ProjectCard project={p} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
