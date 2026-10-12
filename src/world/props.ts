import * as THREE from 'three'
import { heightAt } from './terrain'

const shadowed = <T extends THREE.Object3D>(o: T): T => {
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = true
      c.receiveShadow = true
    }
  })
  return o
}

const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3d26, roughness: 1 })
const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 3, 6)
const leafGeo = new THREE.IcosahedronGeometry(1, 0)

const leafMats: Record<'cherry' | 'maple' | 'green', THREE.MeshStandardMaterial[]> = {
  cherry: [0xf6b8cf, 0xf29fbd, 0xfcd3e1].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true })),
  maple: [0xe76f51, 0xf4a261, 0xd9573b].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true })),
  green: [0x6a994e, 0x588b3f, 0x7db15a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true })),
}

export function createTree(kind: 'cherry' | 'maple' | 'green', scale = 1, seed = Math.random()): THREE.Group {
  const g = new THREE.Group()
  const trunk = new THREE.Mesh(trunkGeo, trunkMat)
  trunk.position.y = 1.5
  g.add(trunk)
  const mats = leafMats[kind]
  const blobs = 5
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2 + seed * 6
    const r = i === 0 ? 0 : 1.1
    const leaf = new THREE.Mesh(leafGeo, mats[i % mats.length])
    const s = (i === 0 ? 1.9 : 1.3 + ((seed * 7 + i) % 1) * 0.4)
    leaf.scale.setScalar(s)
    leaf.position.set(Math.cos(a) * r, 3.6 + (i === 0 ? 0.6 : (i % 2) * 0.5), Math.sin(a) * r)
    leaf.rotation.set(seed * 3, i, seed)
    g.add(leaf)
  }
  g.scale.setScalar(scale)
  g.rotation.y = seed * Math.PI * 2
  return shadowed(g)
}

const pineMats = [0x2f5d3a, 0x3b6e45].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true }))
const pineCones = [new THREE.ConeGeometry(2.2, 3, 7), new THREE.ConeGeometry(1.7, 2.6, 7), new THREE.ConeGeometry(1.1, 2.2, 7)]

export function createPine(scale = 1, seed = 0): THREE.Group {
  const g = new THREE.Group()
  const trunk = new THREE.Mesh(trunkGeo, trunkMat)
  trunk.position.y = 1.2
  g.add(trunk)
  pineCones.forEach((geo, i) => {
    const c = new THREE.Mesh(geo, pineMats[(i + Math.floor(seed * 10)) % 2])
    c.position.y = 3 + i * 1.5
    g.add(c)
  })
  g.scale.setScalar(scale)
  return shadowed(g)
}

const stoneMat = new THREE.MeshStandardMaterial({ color: 0xa8a196, roughness: 1, flatShading: true })
const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffb84d, emissiveIntensity: 1.6 })

// Lanterna de pedra
export function createLantern(): THREE.Group {
  const g = new THREE.Group()
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.y = y
    g.add(m)
    return m
  }
  add(new THREE.BoxGeometry(0.8, 0.3, 0.8), stoneMat, 0.15)
  add(new THREE.CylinderGeometry(0.16, 0.2, 0.9, 6), stoneMat, 0.75)
  add(new THREE.BoxGeometry(0.7, 0.15, 0.7), stoneMat, 1.25)
  add(new THREE.BoxGeometry(0.45, 0.45, 0.45), lampMat, 1.55)
  const cap = add(new THREE.ConeGeometry(0.65, 0.5, 4), stoneMat, 2.0)
  cap.rotation.y = Math.PI / 4
  add(new THREE.SphereGeometry(0.1, 6, 4), stoneMat, 2.3)
  return shadowed(g)
}

const rockGeo = new THREE.DodecahedronGeometry(1, 0)
export function createRock(scale: number, seed: number): THREE.Mesh {
  const m = new THREE.Mesh(rockGeo, stoneMat)
  m.scale.set(scale * (1 + seed * 0.4), scale * 0.6, scale * (1.2 - seed * 0.3))
  m.rotation.set(seed, seed * 5, seed * 2)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

// Portal de entrada (pilares vermelhos + duas vigas)
export function createGate(): THREE.Group {
  const g = new THREE.Group()
  const red = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.7 })
  const black = new THREE.MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.8 })
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 5.4, 10), red)
    p.position.set(sx * 3.2, 2.7, 0)
    g.add(p)
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.5, 10), black)
    foot.position.set(sx * 3.2, 0.25, 0)
    g.add(foot)
  }
  const beam1 = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.45, 0.6), black)
  beam1.position.y = 5.55
  g.add(beam1)
  const beam1b = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.35, 0.55), red)
  beam1b.position.y = 5.2
  g.add(beam1b)
  const beam2 = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.3, 0.35), red)
  beam2.position.y = 4.3
  g.add(beam2)
  return shadowed(g)
}

// Catavento que gira com o vento
export function createPinwheel(color: number): { group: THREE.Group; rotor: THREE.Group } {
  const g = new THREE.Group()
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 5), trunkMat)
  pole.position.y = 1.3
  g.add(pole)
  const rotor = new THREE.Group()
  rotor.position.set(0, 2.6, 0.08)
  const mat = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.8 })
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.8 })
  const tri = new THREE.BufferGeometry()
  tri.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.55, 0.05, 0, 0.1, 0.55, 0], 3))
  tri.computeVertexNormals()
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(tri, i % 2 ? mat : white)
    blade.rotation.z = (i * Math.PI) / 2
    rotor.add(blade)
  }
  g.add(rotor)
  return { group: shadowed(g), rotor }
}

// Grama instanciada que balança no vertex shader
export function createGrass(points: { x: number; z: number }[], uniforms: { uTime: { value: number } }): THREE.InstancedMesh {
  const geo = new THREE.ConeGeometry(0.07, 0.7, 3)
  geo.translate(0, 0.35, 0)
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 })
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float ph = instanceMatrix[3].x * 0.35 + instanceMatrix[3].z * 0.27;
        #else
          float ph = 0.0;
        #endif
        float sway = sin(uTime * 1.8 + ph) * 0.5 + sin(uTime * 3.1 + ph * 1.7) * 0.25;
        transformed.x += sway * 0.18 * position.y;
        transformed.z += sway * 0.08 * position.y;`,
      )
  }
  const perTuft = 3
  const mesh = new THREE.InstancedMesh(geo, mat, points.length * perTuft)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const s = new THREE.Vector3()
  const p = new THREE.Vector3()
  const e = new THREE.Euler()
  const color = new THREE.Color()
  let i = 0
  for (const pt of points) {
    for (let k = 0; k < perTuft; k++) {
      const x = pt.x + (Math.random() - 0.5) * 0.5
      const z = pt.z + (Math.random() - 0.5) * 0.5
      p.set(x, heightAt(x, z) - 0.05, z)
      e.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI, (Math.random() - 0.5) * 0.5)
      q.setFromEuler(e)
      const sc = 0.7 + Math.random() * 0.7
      s.set(sc, sc, sc)
      m.compose(p, q, s)
      mesh.setMatrixAt(i, m)
      color.setHSL(0.24 + Math.random() * 0.06, 0.5, 0.38 + Math.random() * 0.15)
      mesh.setColorAt(i, color)
      i++
    }
  }
  mesh.receiveShadow = true
  return mesh
}

// Florzinhas coloridas instanciadas
export function createFlowers(points: { x: number; z: number }[]): THREE.InstancedMesh {
  const geo = new THREE.IcosahedronGeometry(0.12, 0)
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.8 })
  const mesh = new THREE.InstancedMesh(geo, mat, points.length)
  const palette = [0xffffff, 0xffe066, 0xff8fab, 0xc77dff, 0x90e0ef].map((c) => new THREE.Color(c))
  const m = new THREE.Matrix4()
  points.forEach((pt, i) => {
    m.makeTranslation(pt.x, heightAt(pt.x, pt.z) + 0.25, pt.z)
    mesh.setMatrixAt(i, m)
    mesh.setColorAt(i, palette[i % palette.length])
  })
  return mesh
}

// Céu em gradiente (esfera invertida)
export function createSky(top: number, horizon: number, bottom: number): THREE.Mesh {
  const geo = new THREE.SphereGeometry(450, 32, 16)
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(top) },
      uHorizon: { value: new THREE.Color(horizon) },
      uBottom: { value: new THREE.Color(bottom) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      void main() {
        vPos = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uBottom;
      varying vec3 vPos;
      void main() {
        float h = vPos.y;
        vec3 c = h > 0.0 ? mix(uHorizon, uTop, pow(smoothstep(0.0, 0.6, h), 0.8)) : mix(uHorizon, uBottom, smoothstep(0.0, -0.2, h));
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  })
  const m = new THREE.Mesh(geo, mat)
  m.renderOrder = -1
  return m
}

export function createCloud(seed: number): THREE.Group {
  const g = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, emissive: 0xffffff, emissiveIntensity: 0.25 })
  const n = 4 + Math.floor(seed * 4)
  for (let i = 0; i < n; i++) {
    const b = new THREE.Mesh(leafGeo, mat)
    b.scale.set(5 + seed * 3, 2.5 + (i % 2), 4)
    b.position.set(i * 4.5 - n * 2, (i % 2) * 1.2, ((i * 37) % 5) - 2)
    g.add(b)
  }
  return g
}

// Pétalas caindo em volta do jogador
export class Petals {
  readonly points: THREE.Points
  private velocities: Float32Array
  private count: number

  constructor(count = 260) {
    this.count = count
    const pos = new Float32Array(count * 3)
    this.velocities = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60
      pos[i * 3 + 1] = Math.random() * 18
      pos[i * 3 + 2] = (Math.random() - 0.5) * 60
      this.velocities[i] = 0.6 + Math.random() * 0.8
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.PointsMaterial({ color: 0xffc2d6, size: 0.18, transparent: true, opacity: 0.9, depthWrite: false })
    this.points = new THREE.Points(geo, mat)
    this.points.frustumCulled = false
  }

  update(dt: number, t: number, center: THREE.Vector3) {
    const attr = this.points.geometry.attributes.position as THREE.BufferAttribute
    const a = attr.array as Float32Array
    for (let i = 0; i < this.count; i++) {
      const j = i * 3
      a[j] += (Math.sin(t * 0.8 + i) * 0.6 + 0.5) * dt
      a[j + 1] -= this.velocities[i] * dt
      a[j + 2] += Math.cos(t * 0.6 + i * 1.3) * 0.4 * dt
      const dx = a[j] - center.x
      const dz = a[j + 2] - center.z
      if (a[j + 1] < heightAt(a[j], a[j + 2]) || Math.abs(dx) > 32 || Math.abs(dz) > 32) {
        a[j] = center.x + (Math.random() - 0.5) * 60
        a[j + 2] = center.z + (Math.random() - 0.5) * 60
        a[j + 1] = center.y + 8 + Math.random() * 12
      }
    }
    attr.needsUpdate = true
  }
}
