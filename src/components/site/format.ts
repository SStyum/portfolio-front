export const fmtInt = (n: number) => Math.round(n).toLocaleString("pt-BR");

export const fmtCompact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : fmtInt(n);

export const fmtUptime = (s: number) => {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
};

export const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};

export const fmtTime = (ms: number) =>
  new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export const readingMinutes = (text: string) => Math.max(1, Math.round(text.split(/\s+/).length / 200));
