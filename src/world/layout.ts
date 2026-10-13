// Planta da vila: setores, caminhos e marcos do terreno. Tudo em unidades de mundo (~1 = 1 metro).
// +z é o sul (entrada da vila), -z é o norte (terraço da casa principal).

export type SectorId = 'sobre' | 'projetos' | 'blog' | 'observatorio' | 'api' | 'contato'

export type BuildingKind = 'manor' | 'house' | 'tower' | 'kiosk'

export interface SectorDef {
  id: SectorId
  name: string
  place: string
  icon: string
  color: number
  x: number
  z: number
  // rotação em Y; a frente da construção (porta) aponta para +z local
  rot: number
  kind: BuildingKind
  w: number
  d: number
}

const E = Math.PI / 2
const W = -Math.PI / 2

export const SECTORS: SectorDef[] = [
  { id: 'sobre', name: 'Sobre mim', place: 'Casa Principal', icon: '⛩', color: 0xffc857, x: 0, z: -45, rot: 0, kind: 'manor', w: 13, d: 9 },
  { id: 'projetos', name: 'Projetos', place: 'Ateliê', icon: '⚒', color: 0x6fd08c, x: -30, z: -8, rot: E, kind: 'house', w: 10, d: 8 },
  { id: 'blog', name: 'Blog', place: 'Casa de Chá', icon: '✎', color: 0xff8fa3, x: 30, z: -12, rot: W, kind: 'house', w: 10, d: 8 },
  { id: 'observatorio', name: 'Observabilidade', place: 'Torre de Vigia', icon: '◉', color: 0x4cc9f0, x: -36, z: 28, rot: E, kind: 'tower', w: 5, d: 5 },
  { id: 'api', name: 'Documentação da API', place: 'Biblioteca', icon: '❖', color: 0xb388ff, x: 34, z: 30, rot: W, kind: 'house', w: 8, d: 7 },
  { id: 'contato', name: 'Contato', place: 'Correio', icon: '✉', color: 0xf4a261, x: -12, z: 50, rot: E, kind: 'kiosk', w: 4, d: 3 },
]

// Ponto em frente à porta (onde o jogador interage)
export function doorPoint(s: SectorDef, extra = 1.6): { x: number; z: number } {
  const dist = s.d / 2 + extra
  return { x: s.x + Math.sin(s.rot) * dist, z: s.z + Math.cos(s.rot) * dist }
}

export const SPAWN = { x: 0, z: 60, yaw: 0 }

// Raio da vila (casas, caminhos, grama baixa). Depois dela vêm colinas e campos abertos.
export const VILLAGE_RADIUS = 70
// Raio do mundo: perto daqui começam as montanhas (íngremes demais pra subir)
export const WORLD_RADIUS = 175
// Limite duro, por segurança (as montanhas já seguram antes)
export const WALK_RADIUS = WORLD_RADIUS + 10

// Terraço norte (mais alto), separado por um muro de pedra com escada no meio
export const TERRACE = { zStart: -27, zEnd: -31, height: 3.2, stairHalfWidth: 3.5 }

export const POND = { x: 15, z: 9, r: 7, depth: 1.5, water: -0.45 }

// Caminhos de terra (segmentos), usados na pintura do terreno e para evitar grama/árvores
const door = (id: SectorId) => {
  const s = SECTORS.find((x) => x.id === id)!
  return doorPoint(s, 1)
}

export const PATHS: [number, number, number, number][] = (() => {
  const d = Object.fromEntries(SECTORS.map((s) => [s.id, door(s.id)])) as Record<SectorId, { x: number; z: number }>
  return [
    [0, 66, 0, -39],
    [0, d.projetos.z, d.projetos.x, d.projetos.z],
    [0, d.blog.z, d.blog.x, d.blog.z],
    [0, d.observatorio.z, d.observatorio.x, d.observatorio.z],
    [0, d.api.z, d.api.x, d.api.z],
    [0, d.contato.z, d.contato.x, d.contato.z],
    [-14, -38, 14, -38],
  ]
})()

export const PATH_WIDTH = 1.9

export function distToPath(x: number, z: number): number {
  let best = Infinity
  for (const [ax, az, bx, bz] of PATHS) {
    const dx = bx - ax
    const dz = bz - az
    const len2 = dx * dx + dz * dz
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2))
    const px = ax + dx * t
    const pz = az + dz * t
    best = Math.min(best, Math.hypot(x - px, z - pz))
  }
  return best
}

// Casas decorativas (sem setor)
export const EXTRA_HOUSES: { x: number; z: number; rot: number; w: number; d: number }[] = [
  { x: -26, z: -44, rot: 0, w: 8, d: 7 },
  { x: 26, z: -45, rot: 0, w: 8, d: 7 },
  { x: -50, z: 6, rot: E, w: 8, d: 7 },
  { x: 52, z: 4, rot: W, w: 8, d: 6 },
  { x: -24, z: 40, rot: Math.PI, w: 7, d: 6 },
  { x: 22, z: 50, rot: W, w: 7, d: 6 },
  { x: -46, z: -22, rot: E, w: 7, d: 6 },
]

// Construções (setores + casas decorativas + portal) como círculos: o terreno fica plano perto delas
export const BUILDINGS: { x: number; z: number; r: number }[] = [
  ...SECTORS.map((s) => ({ x: s.x, z: s.z, r: Math.hypot(s.w, s.d) / 2 + 4 })),
  ...EXTRA_HOUSES.map((h) => ({ x: h.x, z: h.z, r: Math.hypot(h.w, h.d) / 2 + 4 })),
  { x: 0, z: 63, r: 7 },
]

// Placas de direção fixas (as dos cruzamentos e as de fora da vila são calculadas em world.ts)
export const SIGNPOSTS: { x: number; z: number }[] = [
  { x: 2.8, z: 58 }, // entrada, logo depois do portal
  { x: 5.5, z: -35.5 }, // terraço
]
