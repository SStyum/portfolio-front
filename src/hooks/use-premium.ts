import { usePremiumStore } from "@/src/stores/premium.store";
import { useMounted } from "./use-mounted";

// Assinatura (mock). Só confia no valor salvo depois de montar, pra não divergir do HTML do servidor.
export function useIsPremium(): boolean {
  const mounted = useMounted();
  const isPremium = usePremiumStore((s) => s.isPremium);
  return mounted && isPremium;
}
