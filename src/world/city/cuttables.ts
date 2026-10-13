import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Collider, Colliders } from '../colliders'
import { BLOCKS, LANE, PLAZA, SIDEWALK, isPlaza } from '../layout'
import { heightAt } from '../terrain'

// Objetos que a espada corta: cones, caixotes, bambus, placas de cavalete e lanternas de papel.
// O corte usa planos de recorte (clipping): cada metade é a mesma geometria cortada por um lado do plano.

type Kind = 'cone' | 'crate' | 'bamboo' | 'aframe' | 'lantern'

interface Item {
  kind: Kind
  index: number // instância dentro da malha do tipo
  x: number
  y: number
  z: number
  yaw: number
  scale: number
  radius: number
  height: number
  collider: Collider | null
  alive: boolean
  respawnAt: number
  grow: number // 0→1 ao reaparecer
}

// Molde de um tipo: a geometria inteira numa só (cores por vértice) + a parte que brilha (lanterna)
interface Template {
  solid: THREE.BufferGeometry
  glow: THREE.BufferGeometry | null
  radius: number
  height: number
}

interface Half {
  obj: THREE.Object3D
  v: THREE.Vector3
  spin: THREE.Vector3
  localPlane: THREE.Plane
  plane: THREE.Plane
  life: number
  mats: THREE.Material[]
}

const LIFE = 3.2
const RESPAWN = 14

const M = {
  orange: new THREE.MeshStandardMaterial({ color: 0xff6a13, roughness: 0.55 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }),
  black: new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.7 }),
  wood: new THREE.MeshStandardMaterial({ color: 0xa8784a, roughness: 0.85 }),
  woodDark: new THREE.MeshStandardMaterial({ color: 0x6e4b2c, roughness: 0.9 }),
  bamboo: new THREE.MeshStandardMaterial({ color: 0x7ea63a, roughness: 0.6 }),
  pot: new THREE.MeshStandardMaterial({ color: 0x3b3f45, roughness: 0.8 }),
  lantern: new THREE.MeshStandardMaterial({ color: 0xd62828, roughness: 0.8, emissive: 0xff5a2a, emissiveIntensity: 0.2 }),
  board: new THREE.MeshStandardMaterial({ color: 0x23302a, roughness: 0.8 }),
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.rotation.set(rx, 0, rz)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

function build(kind: Kind, rand: () => number): { g: THREE.Group; radius: number; height: number } {
  const g = new THREE.Group()
  if (kind === 'cone') {
    g.add(mesh(new THREE.BoxGeometry(0.42, 0.05, 0.42), M.orange, 0, 0.025, 0))
    g.add(mesh(new THREE.ConeGeometry(0.17, 0.72, 16), M.orange, 0, 0.41, 0))
    g.add(mesh(new THREE.CylinderGeometry(0.095, 0.12, 0.12, 16), M.white, 0, 0.5, 0))
    return { g, radius: 0.22, height: 0.78 }
  }
  if (kind === 'crate') {
    const s = 0.6 + rand() * 0.15
    g.add(mesh(new THREE.BoxGeometry(s, s, s), M.wood, 0, s / 2, 0))
    for (const y of [0.1, s - 0.1]) g.add(mesh(new THREE.BoxGeometry(s + 0.02, 0.06, s + 0.02), M.woodDark, 0, y, 0))
    g.rotation.y = rand()
    return { g, radius: s * 0.6, height: s }
  }
  if (kind === 'bamboo') {
    g.add(mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.45, 12), M.pot, 0, 0.225, 0))
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + rand()
      const h = 1.8 + rand() * 0.7
      const stalk = mesh(new THREE.CylinderGeometry(0.035, 0.04, h, 8), M.bamboo, Math.cos(a) * 0.12, 0.4 + h / 2, Math.sin(a) * 0.12, (rand() - 0.5) * 0.12, (rand() - 0.5) * 0.12)
      g.add(stalk)
      // gomos
      for (let k = 1; k < 5; k++) g.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 8), M.bamboo, stalk.position.x, 0.4 + (h * k) / 5, stalk.position.z))
    }
    return { g, radius: 0.35, height: 2.4 }
  }
  if (kind === 'aframe') {
    for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.62, 0.95, 0.04), M.board, 0, 0.48, s * 0.17, s * -0.2))
    g.add(mesh(new THREE.BoxGeometry(0.66, 0.05, 0.42), M.woodDark, 0, 0.94, 0))
    g.rotation.y = rand() * Math.PI
    return { g, radius: 0.36, height: 1 }
  }
  // lanterna de papel num suporte
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), M.black, 0, 0.75, 0))
  g.add(mesh(new THREE.BoxGeometry(0.4, 0.04, 0.04), M.black, 0.15, 1.5, 0))
  const body = mesh(new THREE.SphereGeometry(0.28, 16, 12), M.lantern, 0.3, 1.12, 0)
  body.scale.y = 1.35
  g.add(body)
  for (const y of [0.74, 1.5]) g.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 12), M.black, 0.3, y, 0))
  return { g, radius: 0.35, height: 1.6 }
}

// distância entre os segmentos p1-q1 e p2-q2; devolve também o ponto no segundo
function segSeg(p1: THREE.Vector3, q1: THREE.Vector3, p2: THREE.Vector3, q2: THREE.Vector3, onB: THREE.Vector3): number {
  const d1 = q1.clone().sub(p1)
  const d2 = q2.clone().sub(p2)
  const r = p1.clone().sub(p2)
  const a = d1.dot(d1)
  const e = d2.dot(d2)
  const f = d2.dot(r)
  const c = d1.dot(r)
  const b = d1.dot(d2)
  const denom = a * e - b * b
  let s = denom > 1e-8 ? THREE.MathUtils.clamp((b * f - c * e) / denom, 0, 1) : 0
  let t = (b * s + f) / e
  if (t < 0) {
    t = 0
    s = THREE.MathUtils.clamp(-c / a, 0, 1)
  } else if (t > 1) {
    t = 1
    s = THREE.MathUtils.clamp((b - c) / a, 0, 1)
  }
  const pa = p1.clone().addScaledVector(d1, s)
  onB.copy(p2).addScaledVector(d2, t)
  return pa.distanceTo(onB)
}

export interface CutEvent {
  x: number
  y: number
  z: number
}

const KINDS: Kind[] = ['cone', 'crate', 'bamboo', 'aframe', 'lantern']

// Junta as peças do molde: aplica a posição de cada peça e pinta os vértices com a cor do material dela
function bakeTemplate(kind: Kind): Template {
  const rand = mulberrySeed(kind.length * 7919)
  const { g, radius, height } = build(kind, rand)
  g.rotation.set(0, 0, 0) // a rotação vira da instância
  g.updateMatrixWorld(true)
  const solids: THREE.BufferGeometry[] = []
  const glows: THREE.BufferGeometry[] = []
  g.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const geo = m.geometry.clone().applyMatrix4(m.matrixWorld)
    const mat = m.material as THREE.MeshStandardMaterial
    const c = mat.color
    const n = geo.attributes.position.count
    const colors = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3)
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    ;(mat === M.lantern ? glows : solids).push(geo)
  })
  return { solid: mergeGeometries(solids), glow: glows.length ? mergeGeometries(glows) : null, radius, height }
}

function mulberrySeed(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
}

export class Cuttables {
  readonly group = new THREE.Group()
  private items: Item[] = []
  private halves: Half[] = []
  private time = 0
  private templates = new Map<Kind, Template>()
  private meshes = new Map<Kind, { solid: THREE.InstancedMesh; glow: THREE.InstancedMesh | null }>()
  private solidMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65 })
  private glowMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, emissive: 0xff5a2a, emissiveIntensity: 0.2 })
  private m4 = new THREE.Matrix4()

  constructor(
    private colliders: Colliders,
    rand: () => number,
  ) {
    for (const k of KINDS) this.templates.set(k, bakeTemplate(k))

    const place = (kind: Kind, x: number, z: number) => {
      if (this.colliders.blocked(x, z, 0.5)) return
      const t = this.templates.get(kind)!
      const scale = kind === 'crate' ? 0.85 + rand() * 0.25 : 1
      const y = heightAt(x, z)
      const item: Item = {
        kind,
        index: this.items.filter((i) => i.kind === kind).length,
        x,
        y,
        z,
        yaw: kind === 'crate' || kind === 'aframe' ? rand() * Math.PI : 0,
        scale,
        radius: t.radius * scale,
        height: t.height * scale,
        collider: null,
        alive: true,
        respawnAt: 0,
        grow: 1,
      }
      item.collider = this.colliders.circle(x, z, item.radius, y + item.height, y - 1)
      this.items.push(item)
    }

    // na frente das lojas: placas de cavalete, caixotes, lanternas e bambus
    const kinds: Kind[] = ['aframe', 'crate', 'lantern', 'bamboo', 'crate', 'aframe']
    for (const b of BLOCKS) {
      if (isPlaza(b)) continue
      for (let i = 0; i < 3; i++) {
        const k = kinds[Math.floor(rand() * kinds.length)]
        const side = Math.floor(rand() * 4)
        const u = 0.2 + rand() * 0.6
        const inset = SIDEWALK - 0.7
        const x = side < 2 ? b.x0 + (b.x1 - b.x0) * u : side === 2 ? b.x0 + inset : b.x1 - inset
        const z = side >= 2 ? b.z0 + (b.z1 - b.z0) * u : side === 0 ? b.z0 + inset : b.z1 - inset
        place(k, x, z)
        if (k === 'crate' && rand() < 0.6) place('crate', x + 0.75, z + 0.1)
      }
    }
    // rua lá de cima: lanternas, caixotes e bambus logo no começo
    for (let x = LANE.x0 + 6; x < LANE.x1 - 6; x += 9) {
      const k: Kind = (['lantern', 'crate', 'bamboo', 'lantern'] as const)[Math.floor(rand() * 4)]
      place(k, x + rand() * 2, LANE.z1 - 0.9)
    }
    // obra na praça: fileira de cones + bambus perto do posto policial
    for (let i = 0; i < 7; i++) place('cone', PLAZA.x0 + 4 + i * 1.1, PLAZA.z0 + 6)
    for (let i = 0; i < 3; i++) place('bamboo', PLAZA.x1 - 2, PLAZA.z1 - 3 - i * 1.4)

    // uma malha instanciada por tipo (+ o brilho das lanternas)
    for (const k of KINDS) {
      const t = this.templates.get(k)!
      const n = Math.max(1, this.items.filter((i) => i.kind === k).length)
      const solid = new THREE.InstancedMesh(t.solid, this.solidMat, n)
      const glow = t.glow ? new THREE.InstancedMesh(t.glow, this.glowMat, n) : null
      for (const m of [solid, glow]) {
        if (!m) continue
        m.castShadow = true
        m.receiveShadow = true
        m.count = this.items.filter((i) => i.kind === k).length
        this.group.add(m)
      }
      this.meshes.set(k, { solid, glow })
    }
    for (const item of this.items) this.writeMatrix(item)
  }

  private matrixOf(item: Item, out: THREE.Matrix4, extraScale = 1) {
    return out.compose(
      new THREE.Vector3(item.x, item.y, item.z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), item.yaw),
      new THREE.Vector3().setScalar(item.scale * extraScale),
    )
  }

  private writeMatrix(item: Item) {
    const scale = item.alive ? item.grow : 0
    this.matrixOf(item, this.m4, Math.max(1e-4, scale))
    const m = this.meshes.get(item.kind)!
    m.solid.setMatrixAt(item.index, this.m4)
    m.solid.instanceMatrix.needsUpdate = true
    if (m.glow) {
      m.glow.setMatrixAt(item.index, this.m4)
      m.glow.instanceMatrix.needsUpdate = true
    }
  }

  // testa a lâmina (segmento base→ponta) contra os objetos perto do jogador
  check(base: THREE.Vector3, tip: THREE.Vector3, prevTip: THREE.Vector3, player: THREE.Vector3): CutEvent | null {
    let hit: CutEvent | null = null
    const onAxis = new THREE.Vector3()
    for (const item of this.items) {
      if (!item.alive || Math.hypot(item.x - player.x, item.z - player.z) > 4) continue
      const a = new THREE.Vector3(item.x, item.y + 0.05, item.z)
      const b = new THREE.Vector3(item.x, item.y + item.height, item.z)
      if (segSeg(base, tip, a, b, onAxis) > item.radius + 0.12) continue

      // plano do corte: contém a lâmina e a direção em que ela se move
      const blade = tip.clone().sub(base).normalize()
      const motion = tip.clone().sub(prevTip)
      let normal = new THREE.Vector3().crossVectors(blade, motion)
      if (normal.lengthSq() < 1e-6) normal = new THREE.Vector3(-blade.z, 0, blade.x)
      normal.normalize()
      this.cut(item, onAxis, normal, motion.normalize())
      hit = { x: onAxis.x, y: onAxis.y, z: onAxis.z }
    }
    return hit
  }

  private cut(item: Item, point: THREE.Vector3, normal: THREE.Vector3, push: THREE.Vector3) {
    item.alive = false
    item.respawnAt = this.time + RESPAWN
    if (item.collider) this.colliders.remove(item.collider)
    item.collider = null
    this.writeMatrix(item)

    const t = this.templates.get(item.kind)!
    const world = this.matrixOf(item, new THREE.Matrix4())
    const inv = world.clone().invert()
    for (const sign of [1, -1]) {
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal.clone().multiplyScalar(sign), point)
      // plano guardado no espaço local da metade, pra acompanhar o giro dela
      const localPlane = plane.clone().applyMatrix4(inv)
      const obj = new THREE.Group()
      world.decompose(obj.position, obj.quaternion, obj.scale)
      const mats: THREE.Material[] = []
      for (const [geo, base] of [
        [t.solid, this.solidMat],
        [t.glow, this.glowMat],
      ] as const) {
        if (!geo) continue
        const mat = base.clone()
        mat.clippingPlanes = [plane]
        mat.clipShadows = true
        mat.side = THREE.DoubleSide // mostra o "miolo" do corte
        mat.transparent = true
        const mesh = new THREE.Mesh(geo, mat)
        mesh.castShadow = true
        obj.add(mesh)
        mats.push(mat)
      }
      this.group.add(obj)
      // a parte "de cima" do plano voa pro lado do golpe; a outra cai
      const v = normal.clone().multiplyScalar(sign * 2.2).addScaledVector(push, 2).add(new THREE.Vector3(0, 2 + Math.random() * 1.5, 0))
      const spin = new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 8)
      this.halves.push({ obj, v, spin, localPlane, plane, life: LIFE, mats })
    }
  }

  update(dt: number) {
    this.time += dt
    for (const h of this.halves) {
      h.life -= dt
      h.v.y -= 18 * dt
      h.obj.position.addScaledVector(h.v, dt)
      const ground = heightAt(h.obj.position.x, h.obj.position.z)
      if (h.obj.position.y < ground) {
        // quica e escorrega até parar
        h.obj.position.y = ground
        h.v.y *= -0.25
        h.v.x *= 0.6
        h.v.z *= 0.6
        h.spin.multiplyScalar(0.6)
      }
      h.obj.rotation.x += h.spin.x * dt
      h.obj.rotation.y += h.spin.y * dt
      h.obj.rotation.z += h.spin.z * dt
      h.obj.updateMatrixWorld(true)
      h.plane.copy(h.localPlane).applyMatrix4(h.obj.matrixWorld)
      const fade = Math.min(1, h.life / 0.8)
      for (const m of h.mats) m.opacity = fade
    }
    for (const h of this.halves.filter((x) => x.life <= 0)) {
      this.group.remove(h.obj)
      for (const m of h.mats) m.dispose()
    }
    this.halves = this.halves.filter((h) => h.life > 0)

    // reaparece depois de um tempo (crescendo)
    for (const item of this.items) {
      if (!item.alive && this.time >= item.respawnAt) {
        item.alive = true
        item.grow = 0.01
        item.collider = this.colliders.circle(item.x, item.z, item.radius, item.y + item.height, item.y - 1)
      }
      if (item.alive && item.grow < 1) {
        item.grow = Math.min(1, item.grow + dt * 2.5)
        this.writeMatrix(item)
      }
    }
  }

  // lanternas brilham à noite
  setNight(night: number) {
    this.glowMat.emissiveIntensity = 0.15 + night * 0.7
  }
}
