"use client";

import { ArrowUpRight, Check, LoaderCircle, Send } from "lucide-react";
import { useState } from "react";
import { contacts } from "@/src/content";
import { Reveal } from "./reveal";
import { SectionHeader } from "./section-header";

type State = "idle" | "sending" | "sent";

export function ContactSection() {
  const [state, setState] = useState<State>("idle");
  const visible = contacts.filter((c) => c.href);

  // TODO: enviar para a API (ex.: POST /contact). Por enquanto só simula o envio.
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setState("sending");
    await new Promise((r) => setTimeout(r, 1100));
    setState("sent");
    form.reset();
  };

  const field = "w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-ring";

  return (
    <section id="contato" className="scroll-mt-20 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeader id="contato" title="Vamos construir algo juntos?" description="Uma vaga, um freela ou só uma conversa sobre arquitetura: me manda uma carta." />

        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <Reveal>
            <ul className="grid gap-3">
              {visible.map((c) => (
                <li key={c.label}>
                  <a
                    href={c.href}
                    target={c.href.startsWith("mailto:") ? undefined : "_blank"}
                    rel="noopener"
                    className="group flex items-center justify-between rounded-2xl border bg-card p-5 transition-colors hover:border-foreground/20"
                  >
                    <span>
                      <span className="block text-sm text-muted-foreground">{c.label}</span>
                      <span className="mt-0.5 block font-medium">{c.value}</span>
                    </span>
                    <ArrowUpRight className="size-5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </a>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={120}>
            <form onSubmit={submit} className="grid gap-4 rounded-2xl border bg-card p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm">
                  Nome
                  <input name="name" required autoComplete="name" className={field} />
                </label>
                <label className="grid gap-1.5 text-sm">
                  E-mail
                  <input name="email" type="email" required autoComplete="email" className={field} />
                </label>
              </div>
              <label className="grid gap-1.5 text-sm">
                Mensagem
                <textarea name="message" required rows={5} className={`${field} resize-y`} />
              </label>
              <button
                disabled={state === "sending"}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-70"
              >
                {state === "sending" ? <LoaderCircle className="size-4 animate-spin" /> : state === "sent" ? <Check className="size-4" /> : <Send className="size-4" />}
                {state === "sending" ? "Enviando…" : state === "sent" ? "Carta enviada! Respondo em breve." : "Enviar mensagem"}
              </button>
              <p className="text-xs text-muted-foreground">Envio simulado nesta versão.</p>
            </form>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
