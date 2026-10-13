import { useQuery } from "@tanstack/react-query";
import { getDashboard, getEndpoints, getMetrics, getPost, getPosts } from "@/src/services/portfolio";

export const useMetrics = () =>
  useQuery({ queryKey: ["metrics"], queryFn: getMetrics, refetchInterval: 5000 });

export const usePosts = () => useQuery({ queryKey: ["posts"], queryFn: getPosts });

export const usePost = (id: string | null) =>
  useQuery({ queryKey: ["post", id], queryFn: () => getPost(id!), enabled: !!id });

export const useEndpoints = () => useQuery({ queryKey: ["endpoints"], queryFn: getEndpoints });

// só busca quando liberado (assinante)
export const useDashboard = (enabled: boolean) =>
  useQuery({ queryKey: ["dashboard"], queryFn: getDashboard, enabled, refetchInterval: 15000 });
