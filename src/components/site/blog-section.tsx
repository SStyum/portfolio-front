"use client";

import { ArrowUpRight, MessageSquare } from "lucide-react";
import { useState } from "react";
import { usePost, usePosts } from "@/src/hooks/use-portfolio";
import { fmtDate, readingMinutes } from "./format";
import { Modal } from "./modal";
import { Reveal } from "./reveal";
import { SectionHeader } from "./section-header";
import { SourceBadge } from "./source-badge";

function PostReader({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, isLoading, isError } = usePost(id);
  const post = data?.data.post;
  const comments = data?.data.comments ?? [];

  return (
    <Modal open={!!id} onOpenChange={(o) => !o && onClose()} title={post?.title ?? "Carregando…"} className="max-w-2xl">
      {isLoading && <div className="h-40 animate-pulse rounded-lg bg-muted" />}
      {isError && <p className="text-muted-foreground">Não consegui carregar este post agora.</p>}
      {post && (
        <article>
          <p className="mb-4 flex items-center gap-3 font-mono text-xs text-muted-foreground">
            {fmtDate(post.createdAt)} · {readingMinutes(post.content)} min de leitura
          </p>
          <div className="space-y-4 leading-relaxed text-pretty">
            {post.content.split(/\n{2,}/).map((para, i) => (
              <p key={i} className="whitespace-pre-line">
                {para}
              </p>
            ))}
          </div>
          <h4 className="mb-3 mt-8 flex items-center gap-2 font-medium">
            <MessageSquare className="size-4" /> Comentários ({comments.length})
          </h4>
          {comments.length ? (
            <ul className="grid gap-3">
              {comments.map((c) => (
                <li key={c.id} className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <p className="mb-1 font-mono text-xs text-muted-foreground">{fmtDate(c.createdAt)}</p>
                  {c.content}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>
          )}
        </article>
      )}
    </Modal>
  );
}

export function BlogSection() {
  const { data, isLoading } = usePosts();
  const [open, setOpen] = useState<string | null>(null);
  const posts = data?.data ?? [];
  const [first, ...others] = posts;

  return (
    <section id="blog" className="scroll-mt-20 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeader
          id="blog"
          title="Escrevo sobre o que aprendo construindo."
          description="Arquitetura, pagamentos, observabilidade e os bastidores desta Tóquio em 3D."
        />
        <div className="mb-4">
          <SourceBadge source={data?.source} />
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl border bg-card" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            {first && (
              <Reveal className="h-full">
                <button
                  onClick={() => setOpen(first.id)}
                  className="group relative flex h-full w-full flex-col justify-end overflow-hidden rounded-2xl border bg-card p-6 text-left transition-colors hover:border-foreground/20 md:p-8"
                >
                  <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-[#ff8fa3]/15 blur-3xl" />
                  <span className="mb-auto inline-flex w-fit rounded-full bg-[#ff8fa3]/15 px-2.5 py-0.5 text-xs">Mais recente</span>
                  <p className="mt-16 font-mono text-xs text-muted-foreground">{fmtDate(first.createdAt)}</p>
                  <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-balance md:text-3xl">{first.title}</h3>
                  <p className="mt-3 line-clamp-3 text-muted-foreground">{first.excerpt}</p>
                  <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium">
                    Ler post <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </span>
                </button>
              </Reveal>
            )}
            <div className="grid gap-4">
              {others.slice(0, 3).map((p, i) => (
                <Reveal key={p.id} delay={i * 80}>
                  <button
                    onClick={() => setOpen(p.id)}
                    className="group w-full rounded-2xl border bg-card p-5 text-left transition-colors hover:border-foreground/20"
                  >
                    <p className="font-mono text-xs text-muted-foreground">{fmtDate(p.createdAt)}</p>
                    <h3 className="mt-2 font-medium leading-snug group-hover:underline group-hover:underline-offset-4">{p.title}</h3>
                  </button>
                </Reveal>
              ))}
            </div>
          </div>
        )}
      </div>
      <PostReader id={open} onClose={() => setOpen(null)} />
    </section>
  );
}
