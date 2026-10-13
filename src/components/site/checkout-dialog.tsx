"use client";

import { Check, CreditCard, LoaderCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { PREMIUM_PLAN, startCheckout, usePremiumStore } from "@/src/stores/premium.store";
import { Modal } from "./modal";

type Step = "plan" | "paying" | "done";

export function CheckoutDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [step, setStep] = useState<Step>("plan");
  const activate = usePremiumStore((s) => s.activate);

  const pay = async () => {
    setStep("paying");
    await startCheckout();
    activate();
    setStep("done");
  };

  const close = (o: boolean) => {
    if (step === "paying") return;
    onOpenChange(o);
    if (!o) setTimeout(() => setStep("plan"), 200);
  };

  return (
    <Modal
      open={open}
      onOpenChange={close}
      title={step === "done" ? "Acesso liberado" : PREMIUM_PLAN.name}
      description={step === "done" ? "O Observatório é todo seu." : "Assinatura mensal para ver o Grafana completo."}
    >
      {step === "done" ? (
        <div className="grid justify-items-center gap-4 py-4 text-center">
          <span className="grid size-14 place-items-center rounded-full" style={{ background: "color-mix(in oklab, var(--status-good) 18%, transparent)" }}>
            <Check className="size-7" style={{ color: "var(--status-good)" }} />
          </span>
          <p className="text-muted-foreground">Pagamento aprovado. O dashboard já está desbloqueado no site e na Torre de Vigia do jogo.</p>
          <button onClick={() => close(false)} className="h-10 w-full rounded-lg bg-primary font-medium text-primary-foreground hover:opacity-90">
            Ver o dashboard
          </button>
        </div>
      ) : (
        <div className="grid gap-5">
          <div className="flex items-baseline gap-1">
            <span className="font-display text-4xl font-semibold">{PREMIUM_PLAN.price}</span>
            <span className="text-muted-foreground">{PREMIUM_PLAN.period}</span>
          </div>
          <ul className="grid gap-2 text-sm">
            {PREMIUM_PLAN.perks.map((p) => (
              <li key={p} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                {p}
              </li>
            ))}
          </ul>
          <p className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            Ambiente de demonstração: nenhum valor é cobrado. Em produção você seria levado ao Stripe Checkout.
          </p>
          <button
            onClick={pay}
            disabled={step === "paying"}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-70"
          >
            {step === "paying" ? <LoaderCircle className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
            {step === "paying" ? "Processando pagamento…" : "Assinar com Stripe (simulado)"}
          </button>
        </div>
      )}
    </Modal>
  );
}
