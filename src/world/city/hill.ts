import * as THREE from 'three'
import type { Colliders } from '../colliders'
import { CURB, HILL, LANE, STAIRS, STAIR_RUN, STAIR_STEPS, STAIR_TOP, streetWidth } from '../layout'
import { GeoBuilder } from './geo'
import { asphaltMaterial, concreteMaterial, sidewalkMaterial } from './materials'

// Colina ao norte com duas escadarias estreitas (estilo santuário Suga, de "Your Name"):
// paredão de contenção, degraus, muretas, corrimão vermelho no meio e a boca do túnel da avenida.

const RISE = (HILL.h - CURB) / STAIR_STEPS
const TUNNEL_HALF = streetWidth(0) / 2 + 0.5
const TUNNEL_H = 6.5

export interface Hill {
  group: THREE.Group
  update(night: number): void
}

export function createHill(colliders: Colliders): Hill {
  const group = new THREE.Group()
  const H = HILL.h
  const { front, back, x0, x1 } = HILL
  const tops = new GeoBuilder()
  const walls = new GeoBuilder()
  const lane = new GeoBuilder()

  // ---------- tampo da colina (fora das escadas) ----------
  const cuts = [x0, ...STAIRS.flatMap((s) => [s.x0, s.x1]), x1]
  for (let i = 0; i < cuts.length - 1; i += 2) {
    const a = cuts[i]
    const b = cuts[i + 1]
    tops.top((a + b) / 2, (front + back) / 2, b - a, front - back, 0, H)
  }
  for (const s of STAIRS) tops.top((s.x0 + s.x1) / 2, (STAIR_TOP + back) / 2, s.x1 - s.x0, STAIR_TOP - back, 0, H)
  lane.top((LANE.x0 + LANE.x1) / 2, (LANE.z0 + LANE.z1) / 2, LANE.x1 - LANE.x0, LANE.z1 - LANE.z0, 0, H + 0.01)

  // ---------- paredão da frente (com vãos das escadas e a boca do túnel) ----------
  const frontWall = (a: number, b: number, y0: number, y1: number) => {
    if (b - a < 0.01) return
    walls.quad([a, y0, front], [b, y0, front], [b, y1, front], [a, y1, front], [a, y0], [b, y0], [b, y1], [a, y1])
  }
  for (let i = 0; i < cuts.length - 1; i += 2) {
    const a = cuts[i]
    const b = cuts[i + 1]
    // o túnel fica embaixo da parte que cruza a avenida principal
    if (a < -TUNNEL_HALF && b > TUNNEL_HALF) {
      frontWall(a, -TUNNEL_HALF, 0, H)
      frontWall(-TUNNEL_HALF, TUNNEL_HALF, TUNNEL_H, H)
      frontWall(TUNNEL_HALF, b, 0, H)
    } else {
      frontWall(a, b, 0, H)
    }
  }
  // laterais e fundo
  walls.quad([x0, 0, back], [x0, 0, front], [x0, H, front], [x0, H, back], [back, 0], [front, 0], [front, H], [back, H])
  walls.quad([x1, 0, front], [x1, 0, back], [x1, H, back], [x1, H, front], [front, 0], [back, 0], [back, H], [front, H])
  // interior escuro do túnel (os carros somem nele)
  const tunnel = new GeoBuilder()
  tunnel.quad([-TUNNEL_HALF, 0, back], [TUNNEL_HALF, 0, back], [TUNNEL_HALF, TUNNEL_H, back], [-TUNNEL_HALF, TUNNEL_H, back], [0, 0], [1, 0], [1, 1], [0, 1])
  tunnel.bottom(0, (front + back) / 2, TUNNEL_HALF * 2, front - back, 0, TUNNEL_H)
  tunnel.quad([-TUNNEL_HALF, 0, front], [-TUNNEL_HALF, 0, back], [-TUNNEL_HALF, TUNNEL_H, back], [-TUNNEL_HALF, TUNNEL_H, front], [0, 0], [1, 0], [1, 1], [0, 1])
  tunnel.quad([TUNNEL_HALF, 0, back], [TUNNEL_HALF, 0, front], [TUNNEL_HALF, TUNNEL_H, front], [TUNNEL_HALF, TUNNEL_H, back], [0, 0], [1, 0], [1, 1], [0, 1])

  // ---------- escadarias ----------
  const steps = new GeoBuilder()
  const rail: THREE.Matrix4[] = []
  const lampPos: THREE.Matrix4[] = []
  for (const s of STAIRS) {
    const w = s.x1 - s.x0
    const cx = (s.x0 + s.x1) / 2
    for (let i = 0; i < STAIR_STEPS; i++) {
      const zA = front - i * STAIR_RUN
      const zB = zA - STAIR_RUN
      const yA = CURB + i * RISE
      const yB = yA + RISE
      // espelho (vertical) e piso do degrau
      steps.quad([s.x0, yA, zA], [s.x1, yA, zA], [s.x1, yB, zA], [s.x0, yB, zA], [s.x0, yA], [s.x1, yA], [s.x1, yB], [s.x0, yB])
      steps.top(cx, (zA + zB) / 2, w, STAIR_RUN, 0, yB)
    }
    // paredes laterais do corte, viradas pra dentro da escada (a mureta continua acima do tampo)
    walls.quad([s.x0, 0, front], [s.x0, 0, STAIR_TOP], [s.x0, H, STAIR_TOP], [s.x0, H, front], [front, 0], [STAIR_TOP, 0], [STAIR_TOP, H], [front, H])
    walls.quad([s.x1, 0, STAIR_TOP], [s.x1, 0, front], [s.x1, H, front], [s.x1, H, STAIR_TOP], [STAIR_TOP, 0], [front, 0], [front, H], [STAIR_TOP, H])
    // muretas em cima (com tampa), dos dois lados do corte
    for (const mx of [s.x0 - 0.15, s.x1 + 0.15]) {
      walls.walls(mx, (front + STAIR_TOP) / 2, 0.3, front - STAIR_TOP, 0, H, 1.1)
      walls.top(mx, (front + STAIR_TOP) / 2, 0.3, front - STAIR_TOP, 0, H + 1.1)
      colliders.box(mx, (front + STAIR_TOP) / 2, 0.3, front - STAIR_TOP, 0, H + 1.1, 0)
    }
    // corrimão no meio, acompanhando a inclinação, com postes a cada 6 degraus
    const len = Math.hypot(front - STAIR_TOP, H - CURB)
    const pitch = Math.atan2(H - CURB, front - STAIR_TOP)
    rail.push(
      new THREE.Matrix4().compose(
        new THREE.Vector3(cx, (CURB + H) / 2 + 0.95, (front + STAIR_TOP) / 2),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch - Math.PI / 2, 0, 0)),
        new THREE.Vector3(1, len, 1),
      ),
    )
    for (let i = 0; i <= STAIR_STEPS; i += 6) {
      const z = front - (i + 0.5) * STAIR_RUN
      const y = CURB + (i + 1) * RISE
      rail.push(new THREE.Matrix4().compose(new THREE.Vector3(cx, y + 0.47, z), new THREE.Quaternion(), new THREE.Vector3(1, 0.95, 1)))
      // luminária pequena na mureta (acende à noite)
      if (i % 12 === 0) lampPos.push(new THREE.Matrix4().makeTranslation(s.x0 + 0.08, y + 2.2, z), new THREE.Matrix4().makeTranslation(s.x1 - 0.08, y + 2.2, z))
    }
    // o corrimão também segura o jogador (não dá pra atravessar pelo meio)
    colliders.box(cx, (front + STAIR_TOP) / 2, 0.12, front - STAIR_TOP - 1.2, 0, H + 1.2, 0)
  }

  // ---------- guarda-corpo na beira do mirante (fora das escadas e da casa) ----------
  const fence: THREE.Matrix4[] = []
  for (let i = 0; i < cuts.length - 1; i += 2) {
    const a = cuts[i] + 0.4
    const b = cuts[i + 1] - 0.4
    if (b - a < 1) continue
    const z = front - 0.25
    for (let x = a; x <= b; x += 1.5) fence.push(new THREE.Matrix4().compose(new THREE.Vector3(x, H + 0.55, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)))
    fence.push(
      new THREE.Matrix4().compose(
        new THREE.Vector3((a + b) / 2, H + 1.05, z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2),
        new THREE.Vector3(1, (b - a) / 1.1, 1),
      ),
    )
    colliders.box((a + b) / 2, z, b - a, 0.2, 0, H + 1.1, H - 1)
  }

  // ---------- volume da colina (sólido pra quem está embaixo, chão pra quem está em cima) ----------
  for (let i = 0; i < cuts.length - 1; i += 2) {
    colliders.box((cuts[i] + cuts[i + 1]) / 2, (front + back) / 2, cuts[i + 1] - cuts[i], front - back, 0, H, -1)
  }
  for (const s of STAIRS) colliders.box((s.x0 + s.x1) / 2, (STAIR_TOP + back) / 2, s.x1 - s.x0, STAIR_TOP - back, 0, H, -1)

  // ---------- malhas ----------
  const add = (g: GeoBuilder, mat: THREE.Material, shadow = true) => {
    const m = new THREE.Mesh(g.build(), mat)
    m.receiveShadow = true
    m.castShadow = shadow
    group.add(m)
    return m
  }
  const concrete = concreteMaterial()
  add(tops, sidewalkMaterial(), false)
  add(lane, asphaltMaterial(), false)
  add(walls, concrete)
  add(steps, concrete)
  add(tunnel, new THREE.MeshBasicMaterial({ color: 0x050505, side: THREE.DoubleSide }), false)

  const red = new THREE.MeshStandardMaterial({ color: 0xb23a2b, roughness: 0.45, metalness: 0.6 })
  const pipe = new THREE.CylinderGeometry(0.035, 0.035, 1, 8)
  const railMesh = new THREE.InstancedMesh(pipe, red, rail.length)
  rail.forEach((m, i) => railMesh.setMatrixAt(i, m))
  railMesh.castShadow = true
  group.add(railMesh)

  const steel = new THREE.MeshStandardMaterial({ color: 0x8d949b, roughness: 0.4, metalness: 0.7 })
  const fenceMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), steel, Math.max(1, fence.length))
  fence.forEach((m, i) => fenceMesh.setMatrixAt(i, m))
  fenceMesh.count = fence.length
  fenceMesh.castShadow = true
  group.add(fenceMesh)

  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff4dc, emissive: 0xffd9a0, emissiveIntensity: 0.1 })
  const lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.24, 0.14), lampMat, Math.max(1, lampPos.length))
  lampPos.forEach((m, i) => lamps.setMatrixAt(i, m))
  lamps.count = lampPos.length
  group.add(lamps)

  return {
    group,
    update(night) {
      lampMat.emissiveIntensity = 0.1 + night * 2.4
    },
  }
}

// Telhado de duas águas (prisma com a cumeeira no eixo x), escalado por instância
export function gableGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(-0.5, 0)
  shape.lineTo(0.5, 0)
  shape.lineTo(0, 1)
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false })
  g.translate(0, 0, -0.5)
  g.rotateY(Math.PI / 2) // cumeeira ao longo de x
  return g
}
