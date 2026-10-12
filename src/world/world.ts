import * as THREE from 'three'
import { Colliders } from './colliders'
import { createBeam, createHouse, createKiosk, createTower } from './buildings'
import { EXTRA_HOUSES, POND, SECTORS, TERRACE, WALK_RADIUS, distToPath, doorPoint, type SectorDef } from './layout'
import {
  Petals,
  createCloud,
  createFlowers,
  createGate,
  createGrass,
  createLantern,
  createPine,
  createPinwheel,
  createRock,
  createSky,
  createTree,
} from './props'
import { createTerrain, heightAt } from './terrain'

// PRNG com semente: a vila sai igual em toda visita
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface SectorRuntime {
  def: SectorDef
  door: { x: number; z: number }
  beam: THREE.Mesh
  visited: boolean
}

export interface World {
  colliders: Colliders
  sectors: SectorRuntime[]
  update(dt: number, t: number, player: THREE.Vector3): void
}

function groundOf(x: number, z: number, w: number, d: number, rot: number): number {
  // maior altura entre os cantos, pra construção não ficar flutuando nem enterrada
  let h = heightAt(x, z)
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
    h = Math.max(h, heightAt(x + lx * cos + lz * sin, z - lx * sin + lz * cos))
  }
  return h
}

function localToWorld(x: number, z: number, rot: number, lx: number, lz: number) {
  return { x: x + lx * Math.cos(rot) + lz * Math.sin(rot), z: z - lx * Math.sin(rot) + lz * Math.cos(rot) }
}

export function buildWorld(scene: THREE.Scene): World {
  const rand = mulberry32(1938)
  const colliders = new Colliders()
  const animated: ((dt: number, t: number, player: THREE.Vector3) => void)[] = []
  const windUniforms = { uTime: { value: 0 } }

  scene.add(createSky(0x4f9fe0, 0xf7dcb4, 0x8fa88a))
  scene.add(createTerrain())

  // ---------- setores ----------
  const sectors: SectorRuntime[] = SECTORS.map((def) => {
    const y = groundOf(def.x, def.z, def.w + 1, def.d + 1, def.rot)
    let built: { group: THREE.Group; height: number }

    if (def.kind === 'tower') {
      const tower = createTower({ w: def.w, accent: def.color, label: def.place })
      built = tower
      animated.push((_dt, t) => {
        tower.orb.rotation.y = t * 0.8
        tower.orb.position.y = tower.height - 0.4 + Math.sin(t * 2) * 0.15
      })
      colliders.box(def.x, def.z, def.w + 1.4, def.w + 1.4, def.rot)
      const post = localToWorld(def.x, def.z, def.rot, def.w / 2 + 1.2, def.w / 2 + 1.4)
      colliders.circle(post.x, post.z, 0.3)
    } else if (def.kind === 'kiosk') {
      built = createKiosk({ w: def.w, d: def.d, accent: def.color, label: def.place })
      colliders.box(def.x, def.z, def.w + 0.6, def.d + 0.6, def.rot)
      const mail = localToWorld(def.x, def.z, def.rot, def.w / 2 + 0.9, def.d / 2 - 0.2)
      colliders.circle(mail.x, mail.z, 0.5)
    } else {
      built = createHouse({ w: def.w, d: def.d, accent: def.color, label: def.place, stories: def.kind === 'manor' ? 2 : 1, h: def.kind === 'manor' ? 3.6 : 3.2 })
      colliders.box(def.x, def.z, def.w + 1, def.d + 1, def.rot)
    }

    built.group.position.set(def.x, y, def.z)
    built.group.rotation.y = def.rot
    scene.add(built.group)

    const beam = createBeam(def.color)
    beam.position.set(def.x, y + built.height + 0.5, def.z)
    scene.add(beam)

    return { def, door: doorPoint(def), beam, visited: false }
  })

  animated.push((_dt, t, player) => {
    for (const s of sectors) {
      const mat = s.beam.material as THREE.ShaderMaterial
      const dist = Math.hypot(player.x - s.def.x, player.z - s.def.z)
      const near = THREE.MathUtils.smoothstep(dist, 8, 22)
      mat.uniforms.uTime.value = t
      mat.uniforms.uOpacity.value = near * (s.visited ? 0.45 : 1)
    }
  })

  // ---------- casas decorativas ----------
  const accents = [0x3d5a80, 0x9c6644, 0x6d597a, 0x2a9d8f, 0xbc4749]
  EXTRA_HOUSES.forEach((h, i) => {
    const y = groundOf(h.x, h.z, h.w + 1, h.d + 1, h.rot)
    const { group } = createHouse({ w: h.w, d: h.d, accent: accents[i % accents.length] })
    group.position.set(h.x, y, h.z)
    group.rotation.y = h.rot
    scene.add(group)
    colliders.box(h.x, h.z, h.w + 1, h.d + 1, h.rot)
  })

  // ---------- muro do terraço e escadaria ----------
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8d877c, roughness: 1, flatShading: true })
  const capMat = new THREE.MeshStandardMaterial({ color: 0x6f6a61, roughness: 1 })
  const wallZ = (TERRACE.zStart + TERRACE.zEnd) / 2
  const wallD = Math.abs(TERRACE.zEnd - TERRACE.zStart)
  const wallTop = TERRACE.height + 0.35
  const gap = TERRACE.stairHalfWidth
  for (const side of [-1, 1]) {
    const len = 80
    const cx = side * (gap + len / 2)
    // blocos de pedra em alturas levemente diferentes pra não parecer uma caixa só
    for (let i = 0; i < len / 4; i++) {
      const bx = side * (gap + 2 + i * 4)
      const jitter = rand() * 0.25
      const block = new THREE.Mesh(new THREE.BoxGeometry(4.02, wallTop + 1.5 + jitter, wallD), wallMat)
      block.position.set(bx, (wallTop + jitter - 1.5) / 2, wallZ)
      block.castShadow = true
      block.receiveShadow = true
      scene.add(block)
    }
    const cap = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, wallD + 0.4), capMat)
    cap.position.set(cx, wallTop + 0.12, wallZ)
    cap.receiveShadow = true
    scene.add(cap)
    colliders.box(cx, wallZ, len, wallD)
  }
  const steps = 7
  for (let i = 0; i < steps; i++) {
    const z = TERRACE.zStart + ((TERRACE.zEnd - TERRACE.zStart) * (i + 0.5)) / steps
    const top = heightAt(0, z) + 0.12
    const step = new THREE.Mesh(new THREE.BoxGeometry(gap * 2, top + 1, wallD / steps + 0.02), wallMat)
    step.position.set(0, (top - 1) / 2, z)
    step.receiveShadow = true
    scene.add(step)
  }

  // ---------- lago ----------
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(POND.r + 0.3, 40),
    new THREE.MeshStandardMaterial({ color: 0x3f8fb5, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.82 }),
  )
  water.rotation.x = -Math.PI / 2
  water.position.set(POND.x, POND.water, POND.z)
  scene.add(water)
  const padMat = new THREE.MeshStandardMaterial({ color: 0x4f8a3c, roughness: 0.9 })
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2
    const r = rand() * (POND.r - 2)
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.45 + rand() * 0.3, 0.45, 0.04, 10), padMat)
    pad.position.set(POND.x + Math.cos(a) * r, POND.water + 0.03, POND.z + Math.sin(a) * r)
    scene.add(pad)
  }
  animated.push((_dt, t) => {
    water.position.y = POND.water + Math.sin(t * 0.8) * 0.03
  })

  // ---------- portal de entrada ----------
  const gate = createGate()
  gate.position.set(0, heightAt(0, 63), 63)
  scene.add(gate)
  colliders.circle(-3.2, 63, 0.5)
  colliders.circle(3.2, 63, 0.5)

  // ---------- lanternas ----------
  const branchZ = SECTORS.map((s) => doorPoint(s).z)
  const placeLantern = (x: number, z: number) => {
    const l = createLantern()
    l.position.set(x, heightAt(x, z), z)
    scene.add(l)
    colliders.circle(x, z, 0.5)
  }
  for (let z = 56; z > -24; z -= 9) {
    if (branchZ.some((bz) => Math.abs(bz - z) < 3.5)) continue
    placeLantern(-3.4, z)
    placeLantern(3.4, z)
  }
  placeLantern(-4.8, -33)
  placeLantern(4.8, -33)
  for (const s of sectors) {
    const side = localToWorld(s.def.x, s.def.z, s.def.rot, s.def.w / 2 + 0.8, s.def.d / 2 + 1.8)
    if (s.def.kind !== 'tower') placeLantern(side.x, side.z)
  }

  // ---------- árvores ----------
  // árvore sagrada no terraço
  const sacred = createTree('cherry', 1.9, 0.3)
  sacred.position.set(11, heightAt(11, -34.5), -34.5)
  scene.add(sacred)
  colliders.circle(11, -34.5, 0.8)

  const free = (x: number, z: number, pathMargin: number, colMargin: number) =>
    Math.hypot(x, z) < WALK_RADIUS - 2 &&
    distToPath(x, z) > pathMargin &&
    Math.hypot(x - POND.x, z - POND.z) > POND.r + 1.5 &&
    !colliders.blocked(x, z, colMargin) &&
    Math.abs(z - (TERRACE.zStart + TERRACE.zEnd) / 2) > 3.5

  const kinds = ['cherry', 'maple', 'green', 'green', 'cherry'] as const
  let placed = 0
  for (let tries = 0; tries < 2000 && placed < 55; tries++) {
    const a = rand() * Math.PI * 2
    const r = 12 + Math.sqrt(rand()) * 56
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    if (!free(x, z, 4, 2.6)) continue
    const tree = createTree(kinds[placed % kinds.length], 0.8 + rand() * 0.6, rand())
    tree.position.set(x, heightAt(x, z), z)
    scene.add(tree)
    colliders.circle(x, z, 0.55)
    placed++
  }

  // pinheiros nos paredões
  for (let i = 0; i < 140; i++) {
    const a = rand() * Math.PI * 2
    const r = 78 + rand() * 40
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const pine = createPine(1 + rand() * 0.9, rand())
    pine.position.set(x, heightAt(x, z) - 0.3, z)
    scene.add(pine)
  }

  // pedras perto da borda e do lago
  for (let i = 0; i < 30; i++) {
    const a = rand() * Math.PI * 2
    const r = i < 8 ? POND.r + 0.5 : 58 + rand() * 12
    const cx = i < 8 ? POND.x : 0
    const cz = i < 8 ? POND.z : 0
    const x = cx + Math.cos(a) * r
    const z = cz + Math.sin(a) * r
    if (i >= 8 && !free(x, z, 3, 1.5)) continue
    const s = 0.5 + rand() * 1.1
    const rock = createRock(s, rand())
    rock.position.set(x, heightAt(x, z) + s * 0.15, z)
    scene.add(rock)
    if (s > 0.7) colliders.circle(x, z, s * 0.9)
  }

  // cataventos
  const pinColors = [0xe63946, 0x457b9d, 0xf4a261, 0x2a9d8f, 0xb5179e]
  let pins = 0
  for (let tries = 0; tries < 400 && pins < 14; tries++) {
    const a = rand() * Math.PI * 2
    const r = 8 + rand() * 55
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    if (!free(x, z, 2.2, 1.2) || distToPath(x, z) > 4) continue
    const { group, rotor } = createPinwheel(pinColors[pins % pinColors.length])
    group.position.set(x, heightAt(x, z), z)
    group.rotation.y = rand() * Math.PI * 2
    scene.add(group)
    const speed = 2 + rand() * 3
    animated.push((dt) => {
      rotor.rotation.z -= speed * dt
    })
    colliders.circle(x, z, 0.15)
    pins++
  }

  // ---------- grama e flores ----------
  const grassPts: { x: number; z: number }[] = []
  const flowerPts: { x: number; z: number }[] = []
  for (let tries = 0; tries < 9000 && grassPts.length < 1600; tries++) {
    const a = rand() * Math.PI * 2
    const r = Math.sqrt(rand()) * 68
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    if (distToPath(x, z) < 2.3 || Math.hypot(x - POND.x, z - POND.z) < POND.r + 0.3 || colliders.blocked(x, z, 0.4)) continue
    if (Math.abs(z - (TERRACE.zStart + TERRACE.zEnd) / 2) < 2.4 && Math.abs(x) > gap) continue
    grassPts.push({ x, z })
    if (rand() < 0.2) flowerPts.push({ x: x + 0.4, z: z - 0.3 })
  }
  scene.add(createGrass(grassPts, windUniforms))
  scene.add(createFlowers(flowerPts))

  // ---------- nuvens ----------
  const clouds: THREE.Group[] = []
  for (let i = 0; i < 12; i++) {
    const c = createCloud(rand())
    const a = rand() * Math.PI * 2
    const r = 90 + rand() * 180
    c.position.set(Math.cos(a) * r, 70 + rand() * 30, Math.sin(a) * r)
    c.rotation.y = rand() * Math.PI
    scene.add(c)
    clouds.push(c)
  }
  animated.push((dt) => {
    for (const c of clouds) {
      c.position.x += dt * 1.5
      if (c.position.x > 280) c.position.x = -280
    }
  })

  // ---------- pétalas ----------
  const petals = new Petals()
  scene.add(petals.points)
  animated.push((dt, t, player) => petals.update(dt, t, player))

  return {
    colliders,
    sectors,
    update(dt, t, player) {
      windUniforms.uTime.value = t
      for (const fn of animated) fn(dt, t, player)
    },
  }
}
