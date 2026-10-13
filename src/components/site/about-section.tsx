import { experience, profile } from "@/src/content";
import { Reveal } from "./reveal";
import { SectionHeader } from "./section-header";

export function AboutSection() {
  return (
    <section id="sobre" className="scroll-mt-20 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeader id="sobre" title="Um pouco sobre quem constrói isso tudo." />

        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
          <Reveal>
            <div className="space-y-5 text-lg leading-relaxed text-pretty">
              {profile.bio.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>

            <h3 className="mb-6 mt-14 font-display text-xl font-semibold">Trajetória</h3>
            <ol className="relative space-y-8 border-l pl-6">
              {experience.map((e) => (
                <li key={e.period} className="relative">
                  <span className="absolute -left-[31px] top-1.5 size-3 rounded-full border-2 border-background bg-primary" />
                  <p className="font-mono text-xs text-muted-foreground">{e.period}</p>
                  <p className="mt-1 font-medium">
                    {e.role} <span className="text-muted-foreground">· {e.company}</span>
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{e.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {e.tags.map((t) => (
                      <span key={t} className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>

          <Reveal delay={120}>
            <div className="grid gap-4 sm:grid-cols-2">
              {profile.skillGroups.map((g) => (
                <div key={g.title} className="rounded-2xl border bg-card p-5 transition-colors hover:border-foreground/20">
                  <h3 className="mb-3 text-sm font-medium text-muted-foreground">{g.title}</h3>
                  <ul className="flex flex-wrap gap-1.5">
                    {g.items.map((s) => (
                      <li key={s} className="rounded-lg border bg-background px-2.5 py-1 text-sm">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
