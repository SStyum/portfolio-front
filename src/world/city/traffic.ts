import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BLOCKS, CURB, isPlaza, streetWidth } from '../layout'
import { heightAt } from '../terrain'

// Ciclo do semáforo do cruzamento central (segundos)
const PHASES = [
  { name: 'ns', dur: 12 }, // carros norte-sul
  { name: 'ns-y', dur: 2 },
  { name: 'ew', dur: 12 }, // carros leste-oeste
  { name: 'ew-y', dur: 2 },
  { name: 'walk', dur: 22 }, // todos os pedestres atravessam (scramble), inclusive na diagonal
] as const
type Phase = (typeof PHASES)[number]['name']
const CYCLE = PHASES.reduce((a, p) => a + p.dur, 0)

const HALF = streetWidth(0) / 2 // meia largura do cruzamento
const STOP = HALF + 4.3 // linha de parada
const END = 178 // carros nascem e somem nos túneis
const CAR_LEN = 4.4
const CRUISE = 11

interface Car {
  axis: 'x' | 'z' // eixo em que anda
  dir: 1 | -1
  lane: number // deslocamento lateral da faixa
  s: number // posição ao longo do eixo
  v: number
  color: THREE.Color
}

interface Walker {
  mode: 'loop' | 'cross'
  // loop: volta no quarteirão
  rect?: { x0: number; x1: number; z0: number; z1: number }
  t: number
  dirSign: 1 | -1
  speed: number
  // cross: espera numa esquina e atravessa no verde
  corner?: number
  from?: THREE.Vector2
  to?: THREE.Vector2
  startAt?: number
  pos: THREE.Vector2
  yaw: number
  phase: number
  avoid: THREE.Vector2
}

const tmpM = new THREE.Matrix4()
const tmpQ = new THREE.Quaternion()
const tmpS = new THREE.Vector3(1, 1, 1)
const tmpP = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

export interface Traffic {
  group: THREE.Group
  phase: () => Phase
  update(dt: number, t: number, player: THREE.Vector3, night: number): void
}

export function createTraffic(rand: () => number): Traffic {
  const group = new THREE.Group()

  // ---------- carros ----------
  const cars: Car[] = []
  const lanes: { axis: 'x' | 'z'; dir: 1 | -1; lane: number }[] = []
  // mão inglesa (Japão): quem vai pro norte (−z) usa o lado oeste (−x); quem vai pro leste (+x) usa o lado norte (−z)
  for (const lane of [-7.5, -2.5]) lanes.push({ axis: 'z', dir: -1, lane }, { axis: 'x', dir: 1, lane })
  for (const lane of [2.5, 7.5]) lanes.push({ axis: 'z', dir: 1, lane }, { axis: 'x', dir: -1, lane })
  const paints = [0xf4f4f4, 0x111111, 0x1d1f24, 0xb8bec6, 0xc0392b, 0x2e86de, 0xf5c518, 0x27ae60, 0x6c5ce7]
  for (const l of lanes) {
    for (let k = 0; k < 4; k++) {
      cars.push({ ...l, s: -l.dir * END + l.dir * (k * 40 + rand() * 20), v: CRUISE, color: new THREE.Color(paints[Math.floor(rand() * paints.length)]) })
    }
  }

  const N = cars.length
  const bodyGeo = mergeGeometries([
    new THREE.BoxGeometry(1.8, 0.62, CAR_LEN).translate(0, 0.62, 0),
    new THREE.BoxGeometry(1.7, 0.18, CAR_LEN - 0.2).translate(0, 0.38, 0),
  ])
  const cabinGeo = new THREE.BoxGeometry(1.58, 0.62, 2.3).translate(0, 1.24, -0.25)
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 14).rotateZ(Math.PI / 2)
  const lightGeo = new THREE.BoxGeometry(0.42, 0.14, 0.05)
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.08 })
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x10161d, roughness: 0.05, metalness: 0.8 })
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 })
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3d6, emissiveIntensity: 0.3 })
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1a1a, emissiveIntensity: 0.4 })
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, N)
  const cabins = new THREE.InstancedMesh(cabinGeo, glassMat, N)
  const wheels = new THREE.InstancedMesh(wheelGeo, tireMat, N * 4)
  const heads = new THREE.InstancedMesh(lightGeo, headMat, N * 2)
  const tails = new THREE.InstancedMesh(lightGeo, tailMat, N * 2)
  cars.forEach((c, i) => bodies.setColorAt(i, c.color))
  for (const m of [bodies, cabins, wheels]) {
    m.castShadow = true
    m.receiveShadow = true
  }
  for (const m of [bodies, cabins, wheels, heads, tails]) {
    m.frustumCulled = false
    group.add(m)
  }
  // faróis iluminando o asfalto à noite
  const beamTex = (() => {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 128
    const x = c.getContext('2d')!
    const g = x.createLinearGradient(0, 128, 0, 0)
    g.addColorStop(0, 'rgba(255,255,255,0.9)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = g
    x.beginPath()
    x.moveTo(20, 128)
    x.lineTo(44, 128)
    x.lineTo(64, 0)
    x.lineTo(0, 0)
    x.fill()
    return new THREE.CanvasTexture(c)
  })()
  const beamMat = new THREE.MeshBasicMaterial({ map: beamTex, color: 0xfff0d0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
  const beams = new THREE.InstancedMesh(new THREE.PlaneGeometry(3.2, 9).rotateX(-Math.PI / 2), beamMat, N)
  beams.frustumCulled = false
  beams.renderOrder = 2
  group.add(beams)

  // ---------- semáforos ----------
  const lamp = (color: number) => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: 0 })
  const sig = {
    ns: { g: lamp(0x22ff88), y: lamp(0xffb000), r: lamp(0xff2020) },
    ew: { g: lamp(0x22ff88), y: lamp(0xffb000), r: lamp(0xff2020) },
    walk: lamp(0x33ff99),
    stop: lamp(0xff3030),
  }
  const housing = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.5, metalness: 0.6 })
  // tudo junto por material: estrutura numa malha, cada lâmpada (cor/estado) noutra
  const parts = new Map<THREE.Material, THREE.BufferGeometry[]>()
  const put = (geo: THREE.BufferGeometry, mat: THREE.Material, m: THREE.Matrix4) => {
    const g = geo.clone().applyMatrix4(m)
    // a estrutura tem caixas e cilindros: guarda só o que todas têm em comum
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k)
    parts.set(mat, [...(parts.get(mat) ?? []), g.index ? g.toNonIndexed() : g])
  }
  const M4 = (x: number, y: number, z: number, yaw = 0) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(UP, yaw), new THREE.Vector3(1, 1, 1))
  const poleGeo = new THREE.CylinderGeometry(0.1, 0.12, 5.6, 8)
  const signalBoxGeo = new THREE.BoxGeometry(1.2, 0.42, 0.3)
  const lampGeo = new THREE.CircleGeometry(0.15, 14)
  const pedGeo = new THREE.BoxGeometry(0.42, 0.75, 0.2)
  const pedLampGeo = new THREE.PlaneGeometry(0.3, 0.3)
  for (const [cx, cz] of [
    [HALF + 1.2, HALF + 1.2],
    [-HALF - 1.2, HALF + 1.2],
    [HALF + 1.2, -HALF - 1.2],
    [-HALF - 1.2, -HALF - 1.2],
  ]) {
    put(poleGeo, housing, M4(cx, CURB + 2.8, cz))
    // uma cabeça de semáforo pra cada eixo, de frente pra quem chega
    for (const [axis, yaw] of [
      ['ns', Math.sign(cz) > 0 ? 0 : Math.PI],
      ['ew', Math.sign(cx) > 0 ? Math.PI / 2 : -Math.PI / 2],
    ] as const) {
      const head = M4(cx, CURB + 5.2, cz, yaw)
      put(signalBoxGeo, housing, head)
      ;(['g', 'y', 'r'] as const).forEach((k, i) => put(lampGeo, sig[axis][k], head.clone().multiply(new THREE.Matrix4().makeTranslation(-0.38 + i * 0.38, 0, 0.16))))
    }
    // sinal de pedestre nas quatro faces
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const ped = M4(cx + Math.sin(yaw) * 0.18, CURB + 2.6, cz + Math.cos(yaw) * 0.18, yaw)
      put(pedGeo, housing, ped)
      put(pedLampGeo, sig.stop, ped.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.17, 0.11)))
      put(pedLampGeo, sig.walk, ped.clone().multiply(new THREE.Matrix4().makeTranslation(0, -0.17, 0.11)))
    }
  }
  for (const [mat, geos] of parts) {
    const mesh = new THREE.Mesh(mergeGeometries(geos), mat)
    mesh.castShadow = mat === housing
    group.add(mesh)
  }

  // ---------- pedestres ----------
  const walkers: Walker[] = []
  const blocks = BLOCKS.filter((b) => !isPlaza(b))
  for (let i = 0; i < 90; i++) {
    const b = blocks[Math.floor(rand() * blocks.length)]
    const inset = 2
    walkers.push({
      mode: 'loop',
      rect: { x0: b.x0 + inset, x1: b.x1 - inset, z0: b.z0 + inset, z1: b.z1 - inset },
      t: rand(),
      dirSign: rand() < 0.5 ? 1 : -1,
      speed: 1.1 + rand() * 0.5,
      pos: new THREE.Vector2(),
      yaw: 0,
      phase: rand() * 10,
      avoid: new THREE.Vector2(),
    })
  }
  // esquinas do cruzamento: espaço em "L" na calçada
  const cornerSpot = (corner: number) => {
    const sx = corner & 1 ? 1 : -1
    const sz = corner & 2 ? 1 : -1
    const along = rand() < 0.5
    const a = HALF + 0.6 + rand() * 2.6
    const b = HALF + 0.6 + rand() * 7
    return new THREE.Vector2(sx * (along ? a : b), sz * (along ? b : a))
  }
  for (let i = 0; i < 60; i++) {
    const corner = i % 4
    const p = cornerSpot(corner)
    walkers.push({ mode: 'cross', corner, from: p.clone(), to: p.clone(), t: 1, dirSign: 1, speed: 1.6, pos: p, yaw: rand() * 6, phase: rand() * 10, avoid: new THREE.Vector2() })
  }

  const W = walkers.length
  const torsoGeo = new THREE.CapsuleGeometry(0.21, 0.5, 4, 8).translate(0, 1.12, 0)
  const headGeo = new THREE.SphereGeometry(0.13, 10, 8).translate(0, 1.66, 0)
  const legGeo = new THREE.BoxGeometry(0.13, 0.8, 0.15).translate(0, -0.4, 0)
  const clothes = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 })
  const skin = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 })
  const pants = new THREE.MeshStandardMaterial({ color: 0x23252b, roughness: 0.9 })
  const torsos = new THREE.InstancedMesh(torsoGeo, clothes, W)
  const headsP = new THREE.InstancedMesh(headGeo, skin, W)
  const legs = new THREE.InstancedMesh(legGeo, pants, W * 2)
  const outfit = [0x1c1c1c, 0xf2f2f2, 0x2b3a55, 0x8e9aaf, 0xb5838d, 0x6d6875, 0xe5989b, 0x3d5a80, 0xc9ada7, 0x495057]
  const tones = [0xf1c7a1, 0xe0ac69, 0xc68642, 0xffdbac]
  walkers.forEach((_, i) => {
    torsos.setColorAt(i, new THREE.Color(outfit[Math.floor(rand() * outfit.length)]))
    headsP.setColorAt(i, new THREE.Color(tones[Math.floor(rand() * tones.length)]))
  })
  for (const m of [torsos, headsP, legs]) {
    m.castShadow = true
    m.frustumCulled = false
    group.add(m)
  }

  let cycleT = 0
  let lastPhase: Phase = 'ns'
  const phaseAt = (time: number): { name: Phase; left: number; t0: number } => {
    let acc = 0
    for (const p of PHASES) {
      if (time < acc + p.dur) return { name: p.name, left: acc + p.dur - time, t0: acc }
      acc += p.dur
    }
    return { name: 'ns', left: PHASES[0].dur, t0: 0 }
  }

  const loopPos = (w: Walker, out: THREE.Vector2) => {
    const r = w.rect!
    const W1 = r.x1 - r.x0
    const D1 = r.z1 - r.z0
    const P = 2 * (W1 + D1)
    let s = (((w.t % 1) + 1) % 1) * P
    if (s < W1) out.set(r.x0 + s, r.z0)
    else if ((s -= W1) < D1) out.set(r.x1, r.z0 + s)
    else if ((s -= D1) < W1) out.set(r.x1 - s, r.z1)
    else out.set(r.x0, r.z1 - (s - W1))
    return P
  }

  return {
    group,
    phase: () => lastPhase,
    update(dt, t, player, night) {
      cycleT = (cycleT + dt) % CYCLE
      const ph = phaseAt(cycleT)
      lastPhase = ph.name

      // luzes do semáforo
      const set = (g: (typeof sig)['ns'], green: boolean, yellow: boolean) => {
        g.g.emissiveIntensity = green ? 3 : 0
        g.y.emissiveIntensity = yellow ? 3 : 0
        g.r.emissiveIntensity = !green && !yellow ? 3 : 0
      }
      set(sig.ns, ph.name === 'ns', ph.name === 'ns-y')
      set(sig.ew, ph.name === 'ew', ph.name === 'ew-y')
      const walking = ph.name === 'walk'
      const blink = walking && ph.left < 4 && Math.floor(t * 4) % 2 === 0
      sig.walk.emissiveIntensity = walking && !blink ? 3 : 0
      sig.stop.emissiveIntensity = walking ? 0 : 3

      // ---- carros ----
      const green = (axis: 'x' | 'z') => ph.name === (axis === 'z' ? 'ns' : 'ew')
      const yellow = (axis: 'x' | 'z') => ph.name === (axis === 'z' ? 'ns-y' : 'ew-y')
      const byLane = new Map<string, Car[]>()
      for (const c of cars) {
        const k = `${c.axis}${c.dir}${c.lane}`
        if (!byLane.has(k)) byLane.set(k, [])
        byLane.get(k)!.push(c)
      }
      for (const list of byLane.values()) {
        list.sort((a, b) => (b.s - a.s) * a.dir) // primeiro = mais à frente
        list.forEach((c, i) => {
          let target = CRUISE
          const front = c.s + c.dir * CAR_LEN * 0.5
          // sinal fechado: para antes da linha (no amarelo, quem está perto passa)
          const toStop = (-c.dir * STOP - front) * c.dir
          if (!green(c.axis) && toStop > -0.5 && !(yellow(c.axis) && toStop < 4)) target = Math.min(target, Math.sqrt(2 * 6 * Math.max(0, toStop - 0.3)))
          // distância pro carro da frente
          if (i > 0) {
            const gap = (list[i - 1].s - c.s) * c.dir - CAR_LEN - 2.5
            target = Math.min(target, Math.sqrt(2 * 6 * Math.max(0, gap)))
          }
          // jogador na frente: freia
          const px = c.axis === 'z' ? player.x : player.z
          const ps = c.axis === 'z' ? player.z : player.x
          const ahead = (ps - c.s) * c.dir
          if (Math.abs(px - c.lane) < 1.7 && ahead > 0 && ahead < 14) target = Math.min(target, Math.sqrt(2 * 8 * Math.max(0, ahead - CAR_LEN * 0.5 - 1.2)))
          c.v += Math.max(-9 * dt, Math.min(3 * dt, target - c.v))
          c.s += c.dir * c.v * dt
          if (c.s * c.dir > END) c.s = -c.dir * END // volta pelo túnel do outro lado
        })
      }
      cars.forEach((c, i) => {
        const x = c.axis === 'z' ? c.lane : c.s
        const z = c.axis === 'z' ? c.s : c.lane
        const yaw = c.axis === 'z' ? (c.dir > 0 ? 0 : Math.PI) : c.dir > 0 ? Math.PI / 2 : -Math.PI / 2
        tmpQ.setFromAxisAngle(UP, yaw)
        tmpM.compose(tmpP.set(x, 0, z), tmpQ, tmpS)
        bodies.setMatrixAt(i, tmpM)
        cabins.setMatrixAt(i, tmpM)
        const fwd = { x: Math.sin(yaw), z: Math.cos(yaw) }
        const side = { x: Math.cos(yaw), z: -Math.sin(yaw) }
        let k = 0
        for (const f of [1.4, -1.4]) {
          for (const sd of [0.82, -0.82]) {
            tmpM.compose(tmpP.set(x + fwd.x * f + side.x * sd, 0.34, z + fwd.z * f + side.z * sd), tmpQ, tmpS)
            wheels.setMatrixAt(i * 4 + k++, tmpM)
          }
        }
        for (const [j, sd] of [
          [0, 0.6],
          [1, -0.6],
        ] as const) {
          tmpM.compose(tmpP.set(x + fwd.x * 2.21 + side.x * sd, 0.72, z + fwd.z * 2.21 + side.z * sd), tmpQ, tmpS)
          heads.setMatrixAt(i * 2 + j, tmpM)
          tmpM.compose(tmpP.set(x - fwd.x * 2.21 + side.x * sd, 0.78, z - fwd.z * 2.21 + side.z * sd), tmpQ, tmpS)
          tails.setMatrixAt(i * 2 + j, tmpM)
        }
        tmpM.compose(tmpP.set(x + fwd.x * 6.7, 0.03, z + fwd.z * 6.7), tmpQ, tmpS)
        beams.setMatrixAt(i, tmpM)

        // empurra o jogador pra fora do carro
        const lx = (player.x - x) * side.x + (player.z - z) * side.z
        const lz = (player.x - x) * fwd.x + (player.z - z) * fwd.z
        if (Math.abs(lx) < 1.3 && Math.abs(lz) < 2.6 && player.y < 1.6) {
          const push = 1.3 - Math.abs(lx)
          player.x += side.x * Math.sign(lx || 1) * push
          player.z += side.z * Math.sign(lx || 1) * push
        }
      })
      for (const m of [bodies, cabins, wheels, heads, tails, beams]) m.instanceMatrix.needsUpdate = true
      headMat.emissiveIntensity = 0.3 + night * 2.2
      tailMat.emissiveIntensity = 0.4 + night * 1.5
      beamMat.opacity = night * 0.25

      // ---- pedestres ----
      const walkStart = lastPhase === 'walk' && ph.left > PHASES[4].dur - dt * 1.5
      const v2 = new THREE.Vector2()
      walkers.forEach((w, i) => {
        let moving = true
        if (w.mode === 'loop') {
          const P = loopPos(w, w.pos)
          w.t += (w.dirSign * w.speed * dt) / P
          const ahead = new THREE.Vector2()
          const save = w.t
          w.t += (w.dirSign * 0.5) / P
          loopPos(w, ahead)
          w.t = save
          w.yaw = Math.atan2(ahead.x - w.pos.x, ahead.y - w.pos.y)
        } else {
          // começa a atravessar quando abre o verde (cada um num instante)
          if (walkStart) {
            const other = (w.corner! + 1 + Math.floor(rand() * 3)) % 4
            w.from = w.pos.clone()
            w.to = cornerSpot(other)
            w.corner = other
            w.t = 0
            w.startAt = rand() * 4
            const dist = w.from.distanceTo(w.to)
            w.speed = Math.max(1.2, dist / (PHASES[4].dur - 6 - w.startAt))
          }
          const elapsed = lastPhase === 'walk' ? PHASES[4].dur - ph.left : Infinity
          if (w.t < 1 && elapsed >= (w.startAt ?? 0)) {
            const dist = Math.max(0.01, w.from!.distanceTo(w.to!))
            w.t = Math.min(1, w.t + (w.speed * dt) / dist)
            w.pos.copy(w.from!).lerp(w.to!, w.t)
            w.yaw = Math.atan2(w.to!.x - w.from!.x, w.to!.y - w.from!.y)
          } else {
            moving = false
          }
        }
        // desvia do jogador
        const dx = w.pos.x + w.avoid.x - player.x
        const dz = w.pos.y + w.avoid.y - player.z
        const d = Math.hypot(dx, dz)
        if (d < 1.1 && d > 1e-3) w.avoid.add(v2.set(dx / d, dz / d).multiplyScalar((1.1 - d) * 0.5))
        w.avoid.multiplyScalar(1 - Math.min(1, dt * 0.8))

        if (moving) w.phase += dt * w.speed * 5.5
        const bob = moving ? Math.abs(Math.sin(w.phase)) * 0.04 : 0
        const x = w.pos.x + w.avoid.x
        const z = w.pos.y + w.avoid.y
        const y = heightAt(x, z)
        tmpQ.setFromAxisAngle(UP, w.yaw)
        tmpM.compose(tmpP.set(x, y + bob, z), tmpQ, tmpS)
        torsos.setMatrixAt(i, tmpM)
        headsP.setMatrixAt(i, tmpM)
        const swing = moving ? Math.sin(w.phase) * 0.55 : 0
        for (const [j, side, sw] of [
          [0, -0.1, swing],
          [1, 0.1, -swing],
        ] as const) {
          const legQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), sw)
          const q = tmpQ.clone().multiply(legQ)
          tmpM.compose(tmpP.set(x + Math.cos(w.yaw) * side, y + 0.82 + bob, z - Math.sin(w.yaw) * side), q, tmpS)
          legs.setMatrixAt(i * 2 + j, tmpM)
        }
      })
      for (const m of [torsos, headsP, legs]) m.instanceMatrix.needsUpdate = true
    },
  }
}
