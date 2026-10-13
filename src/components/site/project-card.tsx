import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Project } from "@/src/content";
import { cn } from "@/src/lib/utils";
import { CATEGORY_COLOR, ProjectCover } from "./project-cover";

export function StatusPill({ status }: { status: Project["status"] }) {
  const live = status === "Em produção";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-2.5 py-0.5 text-[11px] text-white/85 backdrop-blur">
      <span
        className={cn("size-1.5 rounded-full", live && "live-dot")}
        style={{ background: live ? "#3ddc97" : status === "Em desenvolvimento" ? "#f2c879" : "#a1a1aa", color: "#3ddc97" }}
      />
      {status}
    </span>
  );
}

export function ProjectCard({ project, large = false }: { project: Project; large?: boolean }) {
  return (
    <Link
      href={`/projetos/${project.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-foreground/20 hover:shadow-[0_20px_60px_-20px_var(--glow)]"
    >
      <div className="relative">
        <ProjectCover project={project} className={large ? "aspect-[16/8]" : "aspect-[16/9]"} />
        <div className="absolute left-3 top-3 flex gap-2">
          <StatusPill status={project.status} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5 md:p-6">
        <div className="mb-2 flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: CATEGORY_COLOR[project.category] }} />
          {project.category} · {project.year}
        </div>
        <h3 className={cn("flex items-start justify-between gap-3 font-display font-semibold tracking-tight", large ? "text-2xl" : "text-xl")}>
          {project.name}
          <ArrowUpRight className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
        </h3>
        <p className="mt-2 text-pretty text-sm text-muted-foreground">{project.description}</p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-5">
          {project.tags.slice(0, large ? 6 : 4).map((t) => (
            <span key={t} className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
              {t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
