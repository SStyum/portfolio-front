import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Gamepad2 } from "lucide-react";
import type { Project } from "@/src/content";
import { StatusPill } from "./project-card";
import { CATEGORY_COLOR, ProjectCover } from "./project-cover";
import { GAME_HREF } from "./sectors";
import { SiteFooter } from "./site-footer";
import { SiteNav } from "./site-nav";

export function ProjectDetail({ project, next }: { project: Project; next: Project }) {
  const isGame = project.slug === "vila-do-portfolio";

  return (
    <>
      <SiteNav base="/home" />
      <main className="flex-1 pt-24">
        <div className="mx-auto max-w-4xl px-4 md:px-6">
          <Link href="/home#projetos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Todos os projetos
          </Link>

          <header className="mt-8">
            <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: CATEGORY_COLOR[project.category] }} />
              {project.category} · {project.year} · {project.role}
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-balance md:text-6xl">{project.name}</h1>
            <p className="mt-5 max-w-2xl text-lg text-pretty text-muted-foreground">{project.description}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {isGame && (
                <a href={GAME_HREF} className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 font-medium text-primary-foreground hover:opacity-90">
                  <Gamepad2 className="size-4" /> Jogar agora
                </a>
              )}
              {project.url && (
                <a href={project.url} target="_blank" rel="noopener" className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 font-medium text-primary-foreground hover:opacity-90">
                  Ver online <ArrowUpRight className="size-4" />
                </a>
              )}
              {project.repo && (
                <a href={project.repo} target="_blank" rel="noopener" className="inline-flex h-11 items-center gap-2 rounded-xl border px-5 font-medium hover:bg-muted">
                  Repositório <ArrowUpRight className="size-4" />
                </a>
              )}
            </div>
          </header>

          <div className="relative mt-10 overflow-hidden rounded-3xl border">
            <ProjectCover project={project} className="aspect-[16/8]" />
            <div className="absolute left-4 top-4">
              <StatusPill status={project.status} />
            </div>
          </div>

          {project.metrics && project.metrics.length > 0 && (
            <dl className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3">
              {project.metrics.map((m) => (
                <div key={m.label} className="rounded-2xl border bg-card p-5">
                  <dt className="text-sm text-muted-foreground">{m.label}</dt>
                  <dd className="mt-1 font-display text-3xl font-semibold tracking-tight">{m.value}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="mt-14 grid gap-12 md:grid-cols-[1fr_16rem]">
            <div className="space-y-10">
              {project.story?.map((s) => (
                <section key={s.title}>
                  <h2 className="font-display text-2xl font-semibold">{s.title}</h2>
                  <p className="mt-3 text-lg leading-relaxed text-pretty text-muted-foreground">{s.body}</p>
                </section>
              ))}
              {project.highlights && (
                <section>
                  <h2 className="font-display text-2xl font-semibold">Destaques</h2>
                  <ul className="mt-4 grid gap-3">
                    {project.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-3 rounded-xl border bg-card p-4">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        {h}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
            <aside className="md:sticky md:top-24 md:self-start">
              <h2 className="text-sm font-medium text-muted-foreground">Stack</h2>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {project.tags.map((t) => (
                  <li key={t} className="rounded-lg border bg-card px-2.5 py-1 font-mono text-xs">
                    {t}
                  </li>
                ))}
              </ul>
            </aside>
          </div>

          <Link
            href={`/projetos/${next.slug}`}
            className="group mt-20 flex items-center justify-between gap-4 rounded-2xl border bg-card p-6 transition-colors hover:border-foreground/20"
          >
            <span>
              <span className="block text-sm text-muted-foreground">Próximo projeto</span>
              <span className="mt-1 block font-display text-xl font-semibold">{next.name}</span>
            </span>
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </main>
      <div className="mt-24">
        <SiteFooter />
      </div>
    </>
  );
}
