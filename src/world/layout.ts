// Planta da cidade (inspirada em Shibuya). Unidades de mundo ≈ metros.
// +z é o sul (estação), -z é o norte. O cruzamento "scramble" fica no centro (0, 0).

export type SectorId = 'sobre' | 'projetos' | 'blog' | 'observatorio' | 'api' | 'contato'

export type BuildingKind = 'house' | 'skyscraper' | 'studio' | 'cafe' | 'bookstore' | 'post'

export interface SectorDef {
  id: SectorId
  name: string
  place: string
  icon: string
  color: number
  x: number
  z: number
  // rotação em Y; a frente do prédio (porta) aponta para +z local
  rot: number
  kind: BuildingKind
  w: number
  d: number
  h: number
}

// ---------- ruas ----------
// mesmas linhas nos dois eixos: avenidas em x = c (correm ao longo de z) e em z = c
export const STREETS = [-124, -82, -40, 0, 40, 82, 124]
export const streetWidth = (c: number) => (c === 0 ? 20 : Math.abs(c) === 40 ? 12 : 10)
export const SIDEWALK = 3.5
export const CURB = 0.15 // altura da calçada
// até onde se anda (depois da última rua começam os prédios da borda)
export const CITY_EDGE = 129
export const WALK_RADIUS = CITY_EDGE

// faixa de rua que contém essa coordenada, se houver
export function streetAt(v: number): number | null {
  for (const c of STREETS) if (Math.abs(v - c) < streetWidth(c) / 2) return c
  return null
}

export const isRoad = (x: number, z: number) => streetAt(x) !== null || streetAt(z) !== null

// ---------- quarteirões ----------
export interface Block {
  x0: number
  x1: number
  z0: number
  z1: number
}

const edges = (i: number) => [STREETS[i] + streetWidth(STREETS[i]) / 2, STREETS[i + 1] - streetWidth(STREETS[i + 1]) / 2]

// quarteirões andáveis entre as ruas
export const BLOCKS: Block[] = (() => {
  const out: Block[] = []
  for (let i = 0; i < STREETS.length - 1; i++) {
    for (let j = 0; j < STREETS.length - 1; j++) {
      const [x0, x1] = edges(i)
      const [z0, z1] = edges(j)
      out.push({ x0, x1, z0, z1 })
    }
  }
  return out
})()

export const blockAt = (x: number, z: number) => BLOCKS.find((b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) ?? null

// praça da estação (sudoeste do cruzamento): sem prédios, com árvores e a estátua
export const PLAZA: Block = { x0: -34, x1: -10, z0: 10, z1: 34 }
export const isPlaza = (b: Block) => b.x0 === PLAZA.x0 && b.z0 === PLAZA.z0

// ---------- setores do portfólio ----------
const S = Math.PI // frente pro norte (porta em -z)

export const SECTORS: SectorDef[] = [
  // em volta do cruzamento
  // casa inicial, no alto da colina, entre as duas escadarias (porta pra rua de cima, neon pra cidade)
  { id: 'sobre', name: 'Sobre mim', place: 'Casa', icon: '◆', color: 0xff4fa3, x: 22, z: -142, rot: Math.PI, kind: 'house', w: 7.4, d: 10, h: 6.6 },
  { id: 'observatorio', name: 'Observabilidade', place: 'Torre de Vigia', icon: '◉', color: 0x4cc9f0, x: 22, z: -22, rot: 0, kind: 'skyscraper', w: 17, d: 17, h: 112 },
  { id: 'blog', name: 'Blog', place: 'Café', icon: '✎', color: 0xff8fa3, x: 22, z: 20, rot: S, kind: 'cafe', w: 14, d: 10, h: 10 },
  // um quarteirão pra fora
  { id: 'projetos', name: 'Projetos', place: 'Ateliê', icon: '⚒', color: 0x6fd08c, x: -61, z: 20, rot: S, kind: 'studio', w: 18, d: 12, h: 16 },
  { id: 'api', name: 'Documentação da API', place: 'Biblioteca', icon: '❖', color: 0xb388ff, x: -61, z: -22, rot: 0, kind: 'bookstore', w: 18, d: 14, h: 22 },
  { id: 'contato', name: 'Contato', place: 'Correio', icon: '✉', color: 0xf4a261, x: 61, z: -22, rot: 0, kind: 'post', w: 14, d: 10, h: 9 },
]

// Ponto em frente à porta (onde o jogador interage), já na calçada
export function doorPoint(s: SectorDef, extra = 1.6): { x: number; z: number } {
  const dist = s.d / 2 + extra
  return { x: s.x + Math.sin(s.rot) * dist, z: s.z + Math.cos(s.rot) * dist }
}

// ---------- colina ao norte com as escadarias (estilo santuário Suga) ----------
export const HILL = { front: -134, back: -192, x0: -72, x1: 72, h: 8.5 }
export const STAIR_RUN = 0.36 // profundidade do degrau
export const STAIR_STEPS = 46
export const STAIR_TOP = HILL.front - STAIR_RUN * STAIR_STEPS // onde a escada chega lá em cima
// duas escadarias paralelas, com a casa inicial entre elas
export const STAIRS = [
  { x0: 14.6, x1: 17.6 },
  { x0: 26.4, x1: 29.4 },
]
// rua estreita lá em cima, ligando o topo das duas escadas
export const LANE = { z0: STAIR_TOP - 6.5, z1: STAIR_TOP, x0: HILL.x0 + 4, x1: HILL.x1 - 4 }

export const inHill = (x: number, z: number) => z < HILL.front && z > HILL.back && x > HILL.x0 && x < HILL.x1
export const stairAt = (x: number, z: number) => (z <= HILL.front && z > STAIR_TOP ? STAIRS.find((s) => x > s.x0 && x < s.x1) ?? null : null)

// começa no alto da escadaria da esquerda, olhando a cidade lá embaixo
export const SPAWN = { x: 15.35, z: STAIR_TOP - 1.6, yaw: 0 } // metade esquerda (o corrimão divide a escada)
export const HELP_SIGN = { x: 11, z: STAIR_TOP - 2.2 }

// mapa: tipo de chão em cada ponto
export type GroundKind = 'road' | 'crosswalk' | 'sidewalk' | 'plaza' | 'outside' | 'hill' | 'stairs'
export function groundKind(x: number, z: number): GroundKind {
  if (stairAt(x, z)) return 'stairs'
  if (inHill(x, z)) return z > LANE.z0 && z < LANE.z1 ? 'road' : 'hill'
  if (Math.abs(x) > CITY_EDGE + 1 || Math.abs(z) > CITY_EDGE + 1) return 'outside'
  if (isRoad(x, z)) return 'road'
  if (x >= PLAZA.x0 && x <= PLAZA.x1 && z >= PLAZA.z0 && z <= PLAZA.z1) return 'plaza'
  return 'sidewalk'
}
