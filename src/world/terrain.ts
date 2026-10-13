import * as THREE from 'three'
import { BUILDINGS, POND, TERRACE, VILLAGE_RADIUS, WORLD_RADIUS, distToPath, PATH_WIDTH } from './layout'

// Ruído de valor 2D determinístico (sem dependências)
function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return s - Math.floor(s)
}

export function noise2(x: number, z: number): number {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz
  const ux = fx * fx * (3 - 2 * fx)
  const uz = fz * fz * (3 - 2 * fz)
  const a = hash(ix, iz)
  const b = hash(ix + 1, iz)
  const c = hash(ix, iz + 1)
  const d = hash(ix + 1, iz + 1)
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

// fbm: algumas oitavas de ruído somadas (relevo com detalhe grande e pequeno)
function fbm(x: number, z: number, octaves = 4): number {
  let sum = 0
  let amp = 0.5
  let freq = 1
  for (let i = 0; i < octaves; i++) {
    sum += noise2(x * freq + i * 17.3, z * freq - i * 9.1) * amp
    amp *= 0.5
    freq *= 2.03
  }
  return sum
}

// 0 perto de construções, caminhos, lago e terraço; 1 em campo aberto. Só ali a vila ganha morrinhos.
function openGround(x: number, z: number): number {
  let near = distToPath(x, z) - 3
  for (const b of BUILDINGS) near = Math.min(near, Math.hypot(x - b.x, z - b.z) - b.r)
  near = Math.min(near, Math.hypot(x - POND.x, z - POND.z) - POND.r - 3)
  near = Math.min(near, Math.abs(z - (TERRACE.zStart + TERRACE.zEnd) / 2) - 4)
  return smoothstep(0, 10, near)
}

// Fora da vila: anel de colinas e campos ondulados, tudo andável (0 dentro da vila, 1 lá fora)
export function wildFactor(x: number, z: number): number {
  const wobble = (noise2(x * 0.05, z * 0.05) - 0.5) * 12
  return smoothstep(VILLAGE_RADIUS - 8, VILLAGE_RADIUS + 25, Math.hypot(x, z) + wobble)
}

// Montanhas na borda do mundo: íngremes demais pra subir
function mountainFactor(x: number, z: number): number {
  const wobble = (noise2(x * 0.03, z * 0.03) - 0.5) * 24
  return smoothstep(WORLD_RADIUS - 25, WORLD_RADIUS + 20, Math.hypot(x, z) + wobble)
}

export function heightAt(x: number, z: number): number {
  let h = TERRACE.height * smoothstep(TERRACE.zStart, TERRACE.zEnd, z)

  // ondulação suave no vale
  h += (noise2(x * 0.08, z * 0.08) - 0.5) * 0.6

  const wild = wildFactor(x, z)

  // morrinhos dentro da vila, só em campo aberto
  if (wild < 1) h += (1 - wild) * openGround(x, z) * (fbm(x * 0.045, z * 0.045, 3) - 0.3) * 4.5

  // lago
  const dp = Math.hypot(x - POND.x, z - POND.z)
  h -= POND.depth * (1 - smoothstep(POND.r * 0.35, POND.r, dp))

  // colinas ao redor da vila e campos lá fora
  if (wild > 0) h += wild * (4 + fbm(x * 0.016, z * 0.016) * 16 + (noise2(x * 0.09, z * 0.09) - 0.5) * 1.5)

  // montanhas no limite
  const m = mountainFactor(x, z)
  if (m > 0) h += m * m * 75 + m * (noise2(x * 0.15, z * 0.15) * 5 + noise2(x * 0.5, z * 0.5) * 1.5)
  return h
}

export function createTerrain(): THREE.Mesh {
  const size = WORLD_RADIUS * 2 + 90
  const seg = 340
  const geo = new THREE.PlaneGeometry(size, size, seg, seg)
  geo.rotateX(-Math.PI / 2)

  const pos = geo.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)

  const grass = new THREE.Color(0x7fae4e)
  const grassDark = new THREE.Color(0x5d8c3a)
  const meadow = new THREE.Color(0xa7b65a) // campo mais seco lá fora
  const dirt = new THREE.Color(0xc9a46a)
  const rock = new THREE.Color(0x8a7f74)
  const rockDark = new THREE.Color(0x5f564f)
  const sand = new THREE.Color(0xb9a27a)
  const snow = new THREE.Color(0xf4f1ea)
  const tmp = new THREE.Color()
  const r = new THREE.Color()

  // 1ª passada: altura; as normais dizem onde o terreno é íngreme
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)))
  geo.computeVertexNormals()
  const normals = geo.attributes.normal as THREE.BufferAttribute

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)

    const n = noise2(x * 0.3, z * 0.3)
    tmp.copy(grass).lerp(grassDark, n * 0.7)
    const wild = wildFactor(x, z)
    if (wild > 0) tmp.lerp(meadow, wild * smoothstep(0.45, 0.75, noise2(x * 0.03, z * 0.03)) * 0.7)

    const pd = distToPath(x, z)
    if (pd < PATH_WIDTH + 0.6) {
      tmp.lerp(dirt, 1 - smoothstep(PATH_WIDTH - 0.4, PATH_WIDTH + 0.6, pd))
    }

    const dp = Math.hypot(x - POND.x, z - POND.z)
    if (dp < POND.r + 1) tmp.lerp(sand, 1 - smoothstep(POND.r - 1, POND.r + 1, dp))

    // rocha onde é íngreme (normal deitada), neve no alto das montanhas
    const steep = 1 - smoothstep(0.62, 0.86, normals.getY(i))
    if (steep > 0) {
      r.copy(rock).lerp(rockDark, noise2(x * 0.4, y * 0.6))
      tmp.lerp(r, steep)
    }
    const snowLine = 52 + (noise2(x * 0.1, z * 0.1) - 0.5) * 12
    if (y > snowLine - 6) tmp.lerp(snow, smoothstep(snowLine - 6, snowLine + 4, y) * (1 - steep * 0.5))

    colors[i * 3] = tmp.r
    colors[i * 3 + 1] = tmp.g
    colors[i * 3 + 2] = tmp.b
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: false })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.receiveShadow = true
  return mesh
}
