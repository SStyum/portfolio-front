import { SECTORS, type SectorId } from "@/src/world/layout";

// As seções do site são os mesmos setores da vila: mesmo nome, lugar e cor.

export const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

export interface SiteSector {
  id: SectorId;
  name: string;
  place: string;
  color: string;
  // abre o jogo já em frente a este lugar
  gameHref: string;
}

export function sector(id: SectorId): SiteSector {
  const s = SECTORS.find((x) => x.id === id)!;
  return { id, name: s.name, place: s.place, color: hex(s.color), gameHref: `/mundo?play=1&setor=${id}` };
}

// ordem em que aparecem no site
export const SITE_SECTIONS: { id: SectorId; label: string }[] = [
  { id: "sobre", label: "Sobre" },
  { id: "projetos", label: "Projetos" },
  { id: "observatorio", label: "Observabilidade" },
  { id: "blog", label: "Blog" },
  { id: "api", label: "API" },
  { id: "contato", label: "Contato" },
];

export const GAME_HREF = "/mundo?play=1";
