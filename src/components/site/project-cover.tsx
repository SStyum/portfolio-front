import type { Project, ProjectCategory } from "@/src/content";
import { cn } from "@/src/lib/utils";

// cor de cada categoria (mesma família das cores da vila)
export const CATEGORY_COLOR: Record<ProjectCategory, string> = {
  "Back-end": "#4cc9f0",
  "Front-end": "#ff8fa3",
  Infra: "#b388ff",
  Jogo: "#6fd08c",
};

// PRNG com semente: a mesma capa pro mesmo projeto, no servidor e no navegador
function seeded(text: string) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

// Capa generativa: órbitas, grade e um monograma, tudo derivado do slug
export function ProjectCover({ project, className }: { project: Project; className?: string }) {
  const rand = seeded(project.slug);
  const color = CATEGORY_COLOR[project.category];
  const id = `cover-${project.slug}`;
  const rings = Array.from({ length: 4 }, (_, i) => ({
    cx: 60 + rand() * 280,
    cy: 30 + rand() * 160,
    r: 30 + rand() * 90 + i * 12,
  }));
  const dots = Array.from({ length: 22 }, () => ({ x: rand() * 400, y: rand() * 225, r: 0.8 + rand() * 1.8 }));
  const monogram = project.name
    .split(" ")
    .filter((w) => w.length > 2)
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

  return (
    <div className={cn("relative overflow-hidden bg-[#0d0d10]", className)}>
      <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <radialGradient id={`${id}-glow`} cx="70%" cy="20%" r="80%">
            <stop offset="0%" stopColor={color} stopOpacity="0.55" />
            <stop offset="60%" stopColor={color} stopOpacity="0.06" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
          <pattern id={`${id}-grid`} width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0H0V20" fill="none" stroke="white" strokeOpacity="0.05" />
          </pattern>
        </defs>
        <rect width="400" height="225" fill={`url(#${id}-grid)`} />
        <rect width="400" height="225" fill={`url(#${id}-glow)`} />
        {rings.map((r, i) => (
          <circle key={i} cx={r.cx} cy={r.cy} r={r.r} fill="none" stroke={color} strokeOpacity={0.12 + i * 0.06} strokeDasharray={i % 2 ? "2 6" : undefined} />
        ))}
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="white" fillOpacity={0.35} />
        ))}
      </svg>
      <span
        className="absolute bottom-3 right-4 font-display text-6xl font-bold tracking-tighter text-white/10 md:text-7xl"
        aria-hidden
      >
        {monogram}
      </span>
    </div>
  );
}
