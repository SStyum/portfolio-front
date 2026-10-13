import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

// Chave também lida pelo jogo (src/ui/panels.ts) pra liberar o Grafana na Torre de Vigia
export const PREMIUM_STORAGE_KEY = 'portfolio:premium'

export const PREMIUM_PLAN = {
  name: 'Acesso Observatório',
  price: 'R$ 9,90',
  period: '/mês',
  perks: [
    'Dashboard Grafana completo, ao vivo',
    'Latência p50/p95, taxa de erro e tráfego por rota',
    'Painel embutido aqui e acesso direto ao Grafana',
    'Cancele quando quiser',
  ],
}

interface PremiumState {
  isPremium: boolean
  since: string | null
  // MOCK: em produção, isso vem do back-end depois do webhook da Stripe confirmar o pagamento
  activate: () => void
  cancel: () => void
}

export const usePremiumStore = create<PremiumState>()(
  persist(
    (set) => ({
      isPremium: false,
      since: null,
      activate: () => set({ isPremium: true, since: new Date().toISOString() }),
      cancel: () => set({ isPremium: false, since: null }),
    }),
    { name: PREMIUM_STORAGE_KEY, storage: createJSONStorage(() => localStorage) },
  ),
)

// TODO: integrar com POST /billing/checkout (Stripe Checkout) do portfolio-back.
// Hoje só simula a espera do gateway.
export async function startCheckout(): Promise<void> {
  await new Promise((r) => setTimeout(r, 1400))
}
