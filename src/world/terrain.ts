import * as THREE from 'three'
import { POND, TERRACE, distToPath, PATH_WIDTH } from './layout'

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

// Quanto do paredão existe neste ponto (0 = vale, 1 = topo do penhasco)
function cliffFactor(x: number, z: number): number {
  const r = Math.hypot(x, z)
  const wobble = (noise2(x * 0.06, z * 0.06) - 0.5) * 10
  return smoothstep(72, 92, r + wobble)
}

export function heightAt(x: number, z: number): number {
  let h = TERRACE.height * smoothstep(TERRACE.zStart, TERRACE.zEnd, z)

  // ondulação suave no vale
  h += (noise2(x * 0.08, z * 0.08) - 0.5) * 0.6

  // lago
  const dp = Math.hypot(x - POND.x, z - POND.z)
  h -= POND.depth * (1 - smoothstep(POND.r * 0.35, POND.r, dp))

  // paredões em volta da vila
  const c = cliffFactor(x, z)
  if (c > 0) {
    const rough = noise2(x * 0.18, z * 0.18) * 4 + noise2(x * 0.5, z * 0.5) * 1.2
    h += c * c * 34 + c * rough
  }
  return h
}

export function createTerrain(): THREE.Mesh {
  const size = 220
  const seg = 200
  const geo = new THREE.PlaneGeometry(size, size, seg, seg)
  geo.rotateX(-Math.PI / 2)

  const pos = geo.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)

  const grass = new THREE.Color(0x7fae4e)
  const grassDark = new THREE.Color(0x5d8c3a)
  const dirt = new THREE.Color(0xc9a46a)
  const rock = new THREE.Color(0x8a7f74)
  const rockDark = new THREE.Color(0x5f564f)
  const sand = new THREE.Color(0xb9a27a)
  const tmp = new THREE.Color()

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const y = heightAt(x, z)
    pos.setY(i, y)

    const n = noise2(x * 0.3, z * 0.3)
    tmp.copy(grass).lerp(grassDark, n * 0.7)

    const pd = distToPath(x, z)
    if (pd < PATH_WIDTH + 0.6) {
      tmp.lerp(dirt, 1 - smoothstep(PATH_WIDTH - 0.4, PATH_WIDTH + 0.6, pd))
    }

    const dp = Math.hypot(x - POND.x, z - POND.z)
    if (dp < POND.r + 1) tmp.lerp(sand, 1 - smoothstep(POND.r - 1, POND.r + 1, dp))

    const c = cliffFactor(x, z)
    if (c > 0.05) {
      const r = rock.clone().lerp(rockDark, noise2(x * 0.4, y * 0.6))
      // topo dos penhascos volta a ter grama
      const top = smoothstep(26, 34, y)
      tmp.lerp(r, Math.min(1, c * 2.2) * (1 - top * 0.8))
    }

    colors[i * 3] = tmp.r
    colors[i * 3 + 1] = tmp.g
    colors[i * 3 + 2] = tmp.b
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: false })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.receiveShadow = true
  return mesh
}
