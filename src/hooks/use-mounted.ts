import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// false no servidor e na hidratação, true depois: evita divergência com dados do navegador (tema, localStorage)
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
