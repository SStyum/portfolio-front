import * as THREE from 'three'
import { createBuildings, mulberry32 } from './city/buildings'
import { Cuttables } from './city/cuttables'
import { createGuidePost, createBeam, createInfoBoard, createSigns, type SignArm } from './city/signs'
import { createStreetProps } from './city/street'
import { createTraffic } from './city/traffic'
import { Colliders } from './colliders'
import { HELP_SIGN, HILL, SECTORS, STAIRS, STREETS, doorPoint, groundKind, streetWidth, type SectorDef } from './layout'
import { DayNight } from './sky'
import { createGround, heightAt } from './terrain'
import { createHill, gableGeometry } from './city/hill'
import { createNeonTubes } from './city/signs'
import { LampLights } from './city/lamplights'

export interface SectorRuntime {
  def: SectorDef
  door: { x: number; z: number }
  beam: THREE.Mesh
  visited: boolean
}

export interface World {
  colliders: Colliders
  sectors: SectorRuntime[]
  dayNight: DayNight
  cuttables: Cuttables
  // cor do mapa (minimapa e mapa grande)
  mapColor(x: number, z: number): [number, number, number]
  update(dt: number, t: number, player: THREE.Vector3): void
}

export function buildWorld(scene: THREE.Scene, renderer: THREE.WebGLRenderer): World {
  const rand = mulberry32(1938)
  const colliders = new Colliders()
  const dayNight = new DayNight(scene, renderer)

  scene.add(createGround())
  const hill = createHill(colliders)
  scene.add(hill.group)
  const buildings = createBuildings(colliders)
  scene.add(buildings.group)
  const neon = createNeonTubes(buildings.tubes)
  scene.add(neon.group)
  // telhados de duas águas das casinhas da colina (uma chamada de desenho)
  const gables = new THREE.InstancedMesh(gableGeometry(), new THREE.MeshStandardMaterial({ color: 0x3b4352, roughness: 0.55, metalness: 0.2, flatShading: true }), Math.max(1, buildings.gables.length))
  buildings.gables.forEach((m, i) => gables.setMatrixAt(i, m))
  gables.count = buildings.gables.length
  gables.castShadow = gables.receiveShadow = true
  scene.add(gables)

  // ---------- setores: feixe de luz no topo ----------
  const sectors: SectorRuntime[] = SECTORS.map((def) => {
    const b = buildings.beams.find((x) => x.sector.id === def.id)!
    const beam = createBeam(def.color)
    beam.position.set(b.x, b.y + 0.5, b.z)
    scene.add(beam)
    return { def, door: doorPoint(def), beam, visited: false }
  })

  // ---------- rua ----------
  const street = createStreetProps(colliders, rand)
  scene.add(street.group)
  const signs = createSigns(buildings.signs, rand)
  scene.add(signs.group)
  const lamps = new LampLights(scene, [...street.lights, ...hill.lights])
  // o neon da casa inicial pinta a rua de cima e o alto das escadas
  const house = SECTORS.find((s) => s.id === 'sobre')!
  const neonPink = new THREE.PointLight(0xff3fa4, 0, 16, 2)
  neonPink.position.set(house.x, HILL.h + 3.4, house.z - house.d / 2 - 1.6) // frente da casa, pra rua de cima
  const neonCyan = new THREE.PointLight(0x29e7ff, 0, 12, 2)
  neonCyan.position.set(house.x - house.w / 2 - 1.2, HILL.h + 4, house.z + house.d / 2 - 1.2)
  scene.add(neonPink, neonCyan)
  const traffic = createTraffic(rand)
  scene.add(traffic.group)
  const cuttables = new Cuttables(colliders, rand)
  scene.add(cuttables.group)

  // ---------- telhados: ar-condicionado e caixa d'água ----------
  const acMats: THREE.Matrix4[] = []
  const tankMats: THREE.Matrix4[] = []
  const q = new THREE.Quaternion()
  for (const r of buildings.roofs) {
    if (r.w < 5 || r.d < 5) continue
    const n = Math.min(6, Math.floor((r.w * r.d) / 45) + 1)
    const cos = Math.cos(r.rot)
    const sin = Math.sin(r.rot)
    for (let i = 0; i < n; i++) {
      const lx = (rand() - 0.5) * (r.w - 2.5)
      const lz = (rand() - 0.5) * (r.d - 2.5)
      const x = r.x + lx * cos + lz * sin
      const z = r.z - lx * sin + lz * cos
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r.rot + (rand() < 0.5 ? 0 : Math.PI / 2))
      acMats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, r.y, z), q, new THREE.Vector3(1, 1, 1)))
      // nos telhados baixos viram obstáculo/degrau do parkour
      if (r.low) colliders.box(x, z, 1.3, 1.3, 0, r.y + 0.9, r.y)
    }
    if (!r.low && rand() < 0.35) tankMats.push(new THREE.Matrix4().compose(new THREE.Vector3(r.x + (rand() - 0.5) * 2, r.y, r.z + (rand() - 0.5) * 2), q, new THREE.Vector3(1, 1, 1)))
  }
  const roofMetal = new THREE.MeshStandardMaterial({ color: 0xb4b8bd, roughness: 0.45, metalness: 0.6 })
  const ac = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 0.9, 0.8).translate(0, 0.45, 0), roofMetal, Math.max(1, acMats.length))
  acMats.forEach((m, i) => ac.setMatrixAt(i, m))
  ac.count = acMats.length
  const tankGeo = new THREE.CylinderGeometry(1.1, 1.1, 2, 16).translate(0, 2.6, 0)
  const tank = new THREE.InstancedMesh(tankGeo, new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 0.6, metalness: 0.4 }), Math.max(1, tankMats.length))
  tankMats.forEach((m, i) => tank.setMatrixAt(i, m))
  tank.count = tankMats.length
  for (const m of [ac, tank]) {
    m.castShadow = true
    m.receiveShadow = true
    scene.add(m)
  }

  // ---------- placas de orientação (azuis) ----------
  const signTo = (fx: number, fz: number, s: SectorDef): SignArm => {
    const d = doorPoint(s)
    return { label: s.place, detail: `${Math.round(Math.hypot(d.x - fx, d.z - fz))} m`, yaw: Math.atan2(d.x - fx, d.z - fz), color: s.color }
  }
  const placeGuide = (x: number, z: number, list: SectorDef[]) => {
    if (colliders.blocked(x, z, 0.3)) return
    const post = createGuidePost(list.map((s) => signTo(x, z, s)))
    const y = heightAt(x, z)
    post.position.set(x, y, z)
    scene.add(post)
    colliders.circle(x, z, 0.12, y + 4, y - 1)
  }
  // quinas dos cruzamentos da avenida principal com as ruas: os 3 setores mais próximos
  for (const cx of STREETS) {
    for (const cz of STREETS) {
      if (Math.abs(cx) > 82 || Math.abs(cz) > 82) continue
      const x = cx + streetWidth(cx) / 2 + 0.9
      const z = cz + streetWidth(cz) / 2 + 0.9
      const near = [...SECTORS].sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z)).slice(0, 3)
      placeGuide(x, z, near)
    }
  }
  // no alto da escada, logo ao lado do ponto de partida: todos os lugares
  placeGuide(HELP_SIGN.x - 2, HELP_SIGN.z + 0.6, SECTORS)

  const help = createInfoBoard('Como jogar', 'aperte E')
  const helpY = heightAt(HELP_SIGN.x, HELP_SIGN.z)
  help.position.set(HELP_SIGN.x, helpY, HELP_SIGN.z)
  help.rotation.y = -Math.PI / 2
  scene.add(help)
  colliders.box(HELP_SIGN.x, HELP_SIGN.z, 0.3, 1.6, 0, helpY + 2.2, helpY - 1)

  // pé da escadaria: placa pra cidade
  placeGuide(STAIRS[0].x0 - 1.2, HILL.front + 2.2, SECTORS.filter((s) => s.id !== 'sobre'))

  const colors: Record<ReturnType<typeof groundKind>, [number, number, number]> = {
    road: [70, 72, 78],
    crosswalk: [200, 200, 200],
    sidewalk: [168, 162, 152],
    plaza: [196, 184, 166],
    outside: [96, 96, 104],
    hill: [150, 146, 138],
    stairs: [205, 120, 110],
  }

  return {
    colliders,
    sectors,
    dayNight,
    cuttables,
    mapColor: (x, z) => colors[groundKind(x, z)],
    update(dt, t, player) {
      dayNight.update(dt, player)
      const night = dayNight.night
      signs.update(dt, t, night)
      street.update(night)
      traffic.update(dt, t, player, night)
      cuttables.update(dt)
      cuttables.setNight(night)
      hill.update(night)
      lamps.update(dt, player, night)
      neonPink.intensity = 4 + night * 24
      neonCyan.intensity = 4 + night * 25
      neon.update(t, night)
      for (const s of sectors) {
        const mat = s.beam.material as THREE.ShaderMaterial
        const dist = Math.hypot(player.x - s.def.x, player.z - s.def.z)
        mat.uniforms.uTime.value = t
        mat.uniforms.uOpacity.value = THREE.MathUtils.smoothstep(dist, 10, 30) * (s.visited ? 0.45 : 1) * (0.6 + night * 0.6)
      }
    },
  }
}
