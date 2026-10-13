import * as THREE from 'three'
import type { Colliders } from '../colliders'
import { BLOCKS, CITY_EDGE, CURB, HILL, LANE, PLAZA, SECTORS, SIDEWALK, STAIRS, inHill, isPlaza, streetWidth, type SectorDef } from '../layout'
import { GeoBuilder } from './geo'
import { STYLE_BLANK, STYLE_GLASS, STYLE_HOUSE, STYLE_OFFICE, facadeMaterial, roofMaterial } from './materials'

// Onde pendurar letreiros (preenchido pelos prédios, desenhado por signs.ts)
export interface SignSlot {
  x: number
  y: number
  z: number
  yaw: number // pra onde a placa olha
  w: number
  h: number
  kind: 'vertical' | 'shop' | 'screen' | 'sector'
  text?: string
  sub?: string
  color?: number
}

export interface CityBuildings {
  group: THREE.Group
  signs: SignSlot[]
  // topo de cada telhado com espaço (pra props como ar-condicionado e caixa d'água)
  roofs: { x: number; z: number; w: number; d: number; rot: number; y: number; low: boolean }[]
  // pontos no topo de cada setor (feixe de luz)
  beams: { sector: SectorDef; x: number; y: number; z: number }[]
  // tubos de neon (contorno da casa inicial)
  tubes: NeonTube[]
  // telhados de duas águas das casas da colina
  gables: THREE.Matrix4[]
}

export interface NeonTube {
  a: [number, number, number]
  b: [number, number, number]
  color: number
}

// PRNG com semente: a cidade sai igual em toda visita
export function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TINTS: [number, number, number][] = [
  [1, 1, 1],
  [0.92, 0.9, 0.86],
  [0.78, 0.78, 0.8],
  [1, 0.94, 0.85],
  [0.62, 0.63, 0.66],
  [0.85, 0.88, 0.92],
]

export function createBuildings(colliders: Colliders): CityBuildings {
  const rand = mulberry32(2026)
  const group = new THREE.Group()
  const signs: SignSlot[] = []
  const roofs: CityBuildings['roofs'] = []
  const beams: CityBuildings['beams'] = []
  const tubes: NeonTube[] = []
  const gables: THREE.Matrix4[] = []

  // um builder por material de fachada + telhados
  const facades = [
    { b: new GeoBuilder(), mat: facadeMaterial('concrete_tile_facade', 3) },
    { b: new GeoBuilder(), mat: facadeMaterial('rectangular_facade_tiles', 3) },
    { b: new GeoBuilder(), mat: facadeMaterial('exterior_wall_cladding', 3.5) },
  ]
  const roof = new GeoBuilder()

  let seed = 1
  const setStyle = (b: GeoBuilder, kind: number, cellW: number, floorH: number, tint: [number, number, number] = TINTS[Math.floor(rand() * TINTS.length)]) => {
    b.curSeed = seed++ * 0.6180339
    b.curStyle = [cellW, floorH, kind]
    b.curColor = tint
  }

  // caixa simples (com recuo opcional no alto)
  const box = (
    x: number,
    z: number,
    w: number,
    d: number,
    h: number,
    opts: { rot?: number; mat?: number; kind?: number; collide?: boolean; props?: boolean; y0?: number; tint?: [number, number, number]; cell?: number } = {},
  ) => {
    const addRoof = (r: CityBuildings['roofs'][number]) => opts.props !== false && roofs.push(r)
    const rot = opts.rot ?? 0
    const fb = facades[opts.mat ?? Math.floor(rand() * facades.length)].b
    const kind = opts.kind ?? (h > 30 && rand() < 0.5 ? STYLE_GLASS : STYLE_OFFICE)
    setStyle(fb, kind, opts.cell ?? (kind === STYLE_GLASS ? 1.7 : 2.6 + rand() * 1.0), 3.2 + rand() * 0.5, opts.tint)
    const y0 = opts.y0 ?? CURB
    // recuo: torres às vezes afinam no alto
    if (h > 34 && rand() < 0.45) {
      const split = h * (0.55 + rand() * 0.2)
      fb.walls(x, z, w, d, rot, y0, split)
      roof.top(x, z, w, d, rot, y0 + split)
      const inset = 1.5 + rand() * 2
      fb.walls(x, z, w - inset * 2, d - inset * 2, rot, y0 + split, h - split)
      roof.top(x, z, w - inset * 2, d - inset * 2, rot, y0 + h)
      addRoof({ x, z, w: w - inset * 2, d: d - inset * 2, rot, y: y0 + h, low: false })
    } else {
      fb.walls(x, z, w, d, rot, y0, h)
      roof.top(x, z, w, d, rot, y0 + h)
      addRoof({ x, z, w, d, rot, y: y0 + h, low: h < 14 })
    }
    if (opts.collide !== false) colliders.box(x, z, w, d, rot, y0 + h, y0 - 1)
  }

  // ---------- setores (prédios marcantes) ----------
  for (const s of SECTORS) buildSector(s)

  function buildSector(s: SectorDef) {
    const y0 = CURB
    const front = { x: s.x + Math.sin(s.rot) * (s.d / 2 + 0.06), z: s.z + Math.cos(s.rot) * (s.d / 2 + 0.06) }
    const signSlot = (y: number, w: number, h: number, kind: SignSlot['kind'] = 'sector') =>
      signs.push({ x: front.x, y, z: front.z, yaw: s.rot, w, h, kind, text: s.place.toUpperCase(), sub: s.name, color: s.color })

    if (s.kind === 'house') {
      buildStartHouse(s)
      return
    }

    const mat = s.kind === 'skyscraper' ? 2 : s.kind === 'post' ? 0 : 1
    const kind = s.kind === 'skyscraper' ? STYLE_GLASS : STYLE_OFFICE
    const fb = facades[mat].b
    const tint: [number, number, number] =
      s.kind === 'post' ? [1, 0.97, 0.95] : s.kind === 'cafe' ? [1, 0.9, 0.78] : s.kind === 'skyscraper' ? [0.85, 0.92, 1] : [0.95, 0.95, 0.95]
    setStyle(fb, kind, kind === STYLE_GLASS ? 1.6 : 3, 3.5, tint)
    fb.walls(s.x, s.z, s.w, s.d, s.rot, y0, s.h)
    roof.top(s.x, s.z, s.w, s.d, s.rot, y0 + s.h)
    colliders.box(s.x, s.z, s.w, s.d, s.rot, y0 + s.h, 0)
    roofs.push({ x: s.x, z: s.z, w: s.w, d: s.d, rot: s.rot, y: y0 + s.h, low: s.h < 14 })

    if (s.kind === 'skyscraper') {
      // mirante no topo: laje + guarda-corpo de vidro
      const deck = y0 + s.h
      setStyle(fb, STYLE_BLANK, 3, 3, [0.7, 0.72, 0.75])
      fb.walls(s.x, s.z, s.w + 1.2, s.d + 1.2, s.rot, deck - 1.2, 1.2)
      roof.top(s.x, s.z, s.w + 1.2, s.d + 1.2, s.rot, deck)
      signSlot(deck - 9, 12, 3.6)
      // telão de frente pro cruzamento
      signs.push({ x: front.x, y: 26, z: front.z, yaw: s.rot, w: 15, h: 8.5, kind: 'screen' })
      beams.push({ sector: s, x: s.x, y: deck, z: s.z })
      return
    }
    signSlot(4.4, Math.min(s.w - 2, 9), 1.4)
    if (s.h > 12) signs.push({ x: front.x + Math.cos(s.rot) * (s.w / 2 - 1.2), y: s.h - 4, z: front.z - Math.sin(s.rot) * (s.w / 2 - 1.2), yaw: s.rot, w: 1.6, h: 6, kind: 'vertical', text: s.place.toUpperCase(), color: s.color })
    beams.push({ sector: s, x: s.x, y: y0 + s.h, z: s.z })
  }

  // áreas reservadas (setores e estação): lotes comuns não entram
  const stZ = 40 + streetWidth(40) / 2 + SIDEWALK + 7
  const reserved = [...SECTORS.map((s) => ({ x: s.x, z: s.z, w: s.w, d: s.d })), { x: -22, z: stZ, w: 22, d: 14 }]
  // marco do cruzamento: torre redonda espelhada (estilo Shibuya 109), só decorativa
  {
    const x = -22
    const z = -22
    const r = 8
    const h = 46
    const fb = facades[2].b
    setStyle(fb, STYLE_GLASS, 1.6, 3.6, [0.95, 0.95, 0.97])
    fb.cylinder(x, z, r, CURB, h, 40)
    setStyle(fb, STYLE_BLANK, 3, 3, [0.9, 0.9, 0.92])
    fb.cylinder(x, z, r + 0.4, CURB + h, 3.2, 40)
    roof.disc(x, z, r + 0.4, CURB + h + 3.2, 40)
    colliders.circle(x, z, r, CURB + h + 3.2, 0)
    signs.push({ x: x + 0.72 * r, y: CURB + h - 12, z: z + 0.72 * r, yaw: Math.PI / 4, w: 3.2, h: 16, kind: 'sector', text: 'SHIBUYA', color: 0xffc857 })
    signs.push({ x, y: 5.2, z: z + r + 0.1, yaw: 0, w: 7, h: 1.6, kind: 'shop', text: 'TOKYO 東京', color: 0xffc857 })
    reserved.push({ x, z, w: r * 2, d: r * 2 })
  }

  const overlapsSector = (x: number, z: number, w: number, d: number) =>
    reserved.some((s) => Math.abs(x - s.x) < (w + s.w) / 2 + 1 && Math.abs(z - s.z) < (d + s.d) / 2 + 1)

  // ---------- quarteirões comuns ----------
  for (const b of BLOCKS) {
    if (isPlaza(b)) continue
    const x0 = b.x0 + SIDEWALK
    const x1 = b.x1 - SIDEWALK
    const z0 = b.z0 + SIDEWALK
    const z1 = b.z1 - SIDEWALK
    const W = x1 - x0
    const D = z1 - z0
    const nx = Math.max(1, Math.round(W / 13))
    const nz = Math.max(1, Math.round(D / 13))
    const gap = 1.4 // becos entre prédios
    const lw = (W - gap * (nx - 1)) / nx
    const ld = (D - gap * (nz - 1)) / nz
    const cx = (b.x0 + b.x1) / 2
    const cz = (b.z0 + b.z1) / 2
    const dist = Math.hypot(cx, cz)

    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const x = x0 + lw / 2 + i * (lw + gap)
        const z = z0 + ld / 2 + j * (ld + gap)
        if (overlapsSector(x, z, lw, ld)) continue
        // mais alto perto do centro; alguns lotes são lojinhas baixas (telhado alcançável)
        const low = rand() < 0.22
        const h = low
          ? 3.2 + rand() * 0.4
          : Math.max(7, 10 + rand() * 26 + Math.max(0, 1 - dist / 150) * 40 + (rand() < 0.12 ? 30 : 0))
        const w = lw - rand() * 1.2
        const d = ld - rand() * 1.2
        box(x, z, w, d, h)

        // letreiros nas fachadas que dão pra rua
        const faces: { yaw: number; fx: number; fz: number; len: number }[] = []
        if (i === 0) faces.push({ yaw: -Math.PI / 2, fx: x - w / 2 - 0.06, fz: z, len: d })
        if (i === nx - 1) faces.push({ yaw: Math.PI / 2, fx: x + w / 2 + 0.06, fz: z, len: d })
        if (j === 0) faces.push({ yaw: Math.PI, fx: x, fz: z - d / 2 - 0.06, len: w })
        if (j === nz - 1) faces.push({ yaw: 0, fx: x, fz: z + d / 2 + 0.06, len: w })
        for (const f of faces) {
          const along = { x: Math.cos(f.yaw), z: -Math.sin(f.yaw) }
          // placa da loja sobre a vitrine
          if (rand() < 0.8) signs.push({ x: f.fx, y: 4.0, z: f.fz, yaw: f.yaw, w: Math.min(f.len - 2, 5 + rand() * 4), h: 0.9, kind: 'shop' })
          // letreiro vertical de neon na quina
          if (h > 12 && rand() < 0.75) {
            const off = (f.len / 2 - 1) * (rand() < 0.5 ? -1 : 1)
            const vh = Math.min(h - 6, 6 + rand() * 8)
            signs.push({ x: f.fx + along.x * off + Math.sin(f.yaw) * 0.6, y: 5 + vh / 2 + rand() * 3, z: f.fz + along.z * off + Math.cos(f.yaw) * 0.6, yaw: f.yaw, w: 1.3, h: vh, kind: 'vertical' })
          }
        }
      }
    }
  }

  // ---------- praça da estação: circuito de parkour (cada degrau ~3 m) ----------
  const px = PLAZA.x0 + 4
  const pz = PLAZA.z1 - 4
  box(px + 9, pz - 1, 3.2, 3.2, 3.1, { mat: 0, kind: STYLE_BLANK }) // posto policial (koban)
  box(px + 3.5, pz - 1, 5, 5, 6.2, { mat: 1 }) // lojinha de dois andares
  box(px, pz - 6.5, 6, 5, 9.3, { mat: 2 }) // prédio de três andares no canto
  signs.push({ x: px + 9, y: 2.6, z: pz + 0.66, yaw: 0, w: 2.6, h: 0.6, kind: 'shop', text: '交番 KOBAN', color: 0xffffff })

  // estação (do outro lado da rua, ao sul da praça)
  box(-22, stZ, 22, 14, 12, { mat: 0, kind: STYLE_OFFICE })
  signs.push({ x: -22, y: 9.3, z: stZ - 7.06, yaw: Math.PI, w: 12, h: 2.2, kind: 'sector', text: '渋谷駅 SHIBUYA', sub: 'Estação', color: 0x2fa84f })
  signs.push({ x: -22, y: 9.5, z: stZ + 7.06, yaw: 0, w: 10, h: 2, kind: 'shop', text: '渋谷駅', color: 0x2fa84f })

  // ---------- colina: casinhas de dois andares, muros baixos e telhados de duas águas ----------
  const H = HILL.h
  const house = (x: number, z: number, w: number, d: number, yaw: number) => {
    const h = 5.6 + rand() * 1.4
    box(x, z, w, d, h, { y0: H, mat: rand() < 0.5 ? 0 : 1, kind: STYLE_HOUSE, cell: 2.4, tint: TINTS[Math.floor(rand() * 3)], props: false })
    // telhado de duas águas (prisma), com beiral
    gables.push(
      new THREE.Matrix4().compose(
        new THREE.Vector3(x, H + h, z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
        new THREE.Vector3(w + 0.8, 1.6 + rand() * 0.6, d + 0.8),
      ),
    )
  }
  const freeOfStairs = (x0: number, x1: number) => STAIRS.every((st) => x1 < st.x0 - 1.2 || x0 > st.x1 + 1.2) && (x1 < 17.6 || x0 > 26.4)
  // fileira ao norte da rua de cima (duas fileiras)
  for (const [z0, z1] of [
    [LANE.z0 - 1.5, LANE.z0 - 11],
    [LANE.z0 - 12.5, LANE.z0 - 22],
  ]) {
    for (let x = LANE.x0; x < LANE.x1 - 6; ) {
      const w = 6.5 + rand() * 3
      house(x + w / 2, (z0 + z1) / 2, w, Math.abs(z1 - z0), 0)
      x += w + 1.3
    }
  }
  // entre a rua de cima e a beira do penhasco (fora das escadas e da casa inicial)
  for (let x = LANE.x0; x < LANE.x1 - 6; ) {
    const w = 6.5 + rand() * 3
    // de 1 m depois da rua até 6 m antes da beira (sobra um mirante com guarda-corpo)
    const zN = LANE.z1 + 1
    const zS = HILL.front - 6
    if (freeOfStairs(x, x + w)) house(x + w / 2, (zN + zS) / 2, w, zS - zN, Math.PI)
    x += w + 1.3
  }

  // ---------- borda: fileira de prédios fechando a cidade ----------
  for (let s = -CITY_EDGE - 20; s <= CITY_EDGE + 20; s += 15) {
    for (const side of [-1, 1]) {
      const h = 18 + rand() * 40
      const along = s + 7.5
      const out = side * (CITY_EDGE + 8)
      // a avenida principal atravessa por baixo (túnel): ponte de prédio por cima
      const overAvenue = Math.abs(along) < streetWidth(0) / 2 + 4
      // ao norte, no trecho da colina, não tem prédio de borda (a colina é a borda)
      const hillRow = side < 0 && Math.abs(along) < HILL.x1 + 8
      if (overAvenue && !hillRow) {
        const fb = facades[0].b
        setStyle(fb, STYLE_OFFICE, 3, 3.4)
        for (const [x, z, w, d] of [
          [along, out, 15, 14],
          [out, along, 14, 15],
        ]) {
          fb.walls(x, z, w, d, 0, 7, h)
          roof.top(x, z, w, d, 0, 7 + h)
          roof.bottom(x, z, w, d, 0, 7) // teto do túnel
        }
        // paredes laterais do túnel
        const half = streetWidth(0) / 2 + 0.3
        for (const sx of [-1, 1]) {
          roof.walls(sx * half, out, 0.6, 14, 0, 0, 7)
          roof.walls(out, sx * half, 14, 0.6, 0, 0, 7)
        }
        continue
      }
      if (!hillRow) box(along, out, 14, 14, h, { collide: true })
      if (!overAvenue) box(out, along, 14, 14, h, { collide: true })
    }
  }

  // ---------- skyline ao longe (sem colisão) ----------
  for (let i = 0; i < 260; i++) {
    const a = rand() * Math.PI * 2
    const r = 160 + Math.pow(rand(), 0.7) * 260
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    // não tapar as avenidas principais olhando pro horizonte
    if (Math.abs(x) < 18 || Math.abs(z) < 18 || inHill(x, z) || (z < HILL.front && Math.abs(x) < HILL.x1 + 12 && z > HILL.back - 12)) continue
    const w = 14 + rand() * 22
    const h = 25 + rand() * 90 + (rand() < 0.1 ? 80 : 0)
    box(x, z, w, w * (0.7 + rand() * 0.6), h, { rot: rand() * 0.3, collide: false, props: false })
  }

  for (const f of facades) {
    if (f.b.empty) continue
    const mesh = new THREE.Mesh(f.b.build(), f.mat)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
  }
  const roofMesh = new THREE.Mesh(roof.build(), roofMaterial())
  roofMesh.receiveShadow = true
  roofMesh.castShadow = true
  group.add(roofMesh)

  group.add(landmarks())
  return { group, signs, roofs, beams, tubes, gables }

  // Casa inicial: dois andares em cima da colina, entre as escadarias, com neon virado pra cidade
  function buildStartHouse(s: SectorDef) {
    const y0 = HILL.h // (roda antes da const H lá de baixo existir)
    const fb = facades[1].b
    setStyle(fb, STYLE_HOUSE, 2.4, 3.2, [0.36, 0.34, 0.38])
    fb.walls(s.x, s.z, s.w, s.d, s.rot, y0, s.h)
    roof.top(s.x, s.z, s.w, s.d, s.rot, y0 + s.h)
    colliders.box(s.x, s.z, s.w, s.d, s.rot, y0 + s.h, y0 - 1)
    roofs.push({ x: s.x, z: s.z, w: s.w, d: s.d, rot: s.rot, y: y0 + s.h, low: true })

    const hw = s.w / 2
    const hd = s.d / 2
    const top = y0 + s.h
    const pink = 0xff3fa4
    const cyan = 0x29e7ff
    // contorno de neon: topo, quinas e a linha do primeiro andar
    const corners: [number, number][] = [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
    ]
    const P = (lx: number, y: number, lz: number): [number, number, number] => [s.x + lx + 0, y, s.z + lz]
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i]
      const [bx, bz] = corners[(i + 1) % 4]
      tubes.push({ a: P(ax * 1.01, top + 0.05, az * 1.01), b: P(bx * 1.01, top + 0.05, bz * 1.01), color: pink })
      tubes.push({ a: P(ax * 1.01, y0 + 3.3, az * 1.01), b: P(bx * 1.01, y0 + 3.3, bz * 1.01), color: cyan })
      tubes.push({ a: P(ax * 1.01, y0 + 0.1, az * 1.01), b: P(ax * 1.01, top, az * 1.01), color: pink })
    }
    // letreiro enorme no telhado, de frente pra cidade (sul) e visível das escadas
    signs.push({ x: s.x, y: top + 2.2, z: s.z + hd - 0.6, yaw: 0, w: 7.6, h: 2.6, kind: 'sector', text: 'ようこそ', sub: 'PORTFÓLIO · ERIC ROMERO', color: pink })
    signs.push({ x: s.x, y: top + 2.2, z: s.z + hd - 0.75, yaw: Math.PI, w: 7.6, h: 2.6, kind: 'sector', text: 'ようこそ', sub: 'PORTFÓLIO · ERIC ROMERO', color: pink })
    // vertical na quina que dá pra escada da esquerda
    signs.push({ x: s.x - hw - 0.7, y: y0 + 4, z: s.z + hd - 1.2, yaw: -Math.PI / 2, w: 1.4, h: 6.5, kind: 'vertical', text: 'カサ CASA', color: cyan })
    // placa da porta, pra rua de cima
    signs.push({ x: s.x, y: y0 + 3.0, z: s.z - hd - 0.06, yaw: Math.PI, w: 4.6, h: 0.9, kind: 'shop', text: 'CASA · SOBRE MIM', color: pink })
    beams.push({ sector: s, x: s.x, y: top + 3.6, z: s.z })
  }
}

// Tokyo Tower e Skytree ao longe: silhuetas que dizem "Tóquio"
function landmarks(): THREE.Group {
  const g = new THREE.Group()
  const red = new THREE.MeshStandardMaterial({ color: 0xe8461f, roughness: 0.6, emissive: 0x3a0800 })
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 })
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9d3dc, roughness: 0.35, metalness: 0.6 })

  // Tokyo Tower: pirâmide treliçada em faixas vermelhas e brancas
  const tower = new THREE.Group()
  const bands = 8
  for (let i = 0; i < bands; i++) {
    const y0 = i * 18
    const r0 = 26 * (1 - i / bands) ** 1.6 + 2
    const r1 = 26 * (1 - (i + 1) / bands) ** 1.6 + 1.6
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 18, 4, 1, true), i % 2 ? white : red)
    seg.position.y = y0 + 9
    seg.rotation.y = Math.PI / 4
    tower.add(seg)
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 14), white)
  deck.position.y = 52
  tower.add(deck)
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.2, 50, 6), red)
  mast.position.y = 144 + 25
  tower.add(mast)
  tower.position.set(-310, 0, -260)
  g.add(tower)

  // Skytree: torre fina altíssima com dois mirantes
  const sky = new THREE.Group()
  const body = new THREE.Mesh(new THREE.CylinderGeometry(3, 12, 360, 12), steel)
  body.position.y = 180
  sky.add(body)
  for (const [y, r] of [
    [215, 12],
    [300, 8],
  ]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 8, 16), steel)
    ring.position.y = y
    sky.add(ring)
  }
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 2.5, 90, 8), steel)
  spire.position.y = 405
  sky.add(spire)
  sky.position.set(380, 0, -420)
  g.add(sky)
  return g
}
