import * as THREE from 'three'
import { heightAt } from './terrain'

const MAX_CHUNKS = 160
const MAX_PUFFS = 120
const MAX_RINGS = 4

interface Chunk {
  p: THREE.Vector3
  v: THREE.Vector3
  rot: THREE.Euler
  spin: THREE.Vector3
  life: number
  size: number
}

interface Puff {
  p: THREE.Vector3
  v: THREE.Vector3
  life: number
  max: number
  size: number
}

// Efeitos de impacto: torrões de terra voando, nuvem de poeira e onda de choque no chão
export class ImpactEffects {
  readonly group = new THREE.Group()
  private chunks: Chunk[] = []
  private puffs: Puff[] = []
  private rings: { mesh: THREE.Mesh; life: number; size: number }[] = []
  private chunkMesh: THREE.InstancedMesh
  private puffPoints: THREE.Points
  private puffPos = new Float32Array(MAX_PUFFS * 3)
  private puffAlpha = new Float32Array(MAX_PUFFS)
  private puffSize = new Float32Array(MAX_PUFFS)
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private s = new THREE.Vector3()

  constructor() {
    this.chunkMesh = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1, flatShading: true }),
      MAX_CHUNKS,
    )
    this.chunkMesh.count = 0
    this.chunkMesh.castShadow = true
    this.chunkMesh.frustumCulled = false
    this.group.add(this.chunkMesh)

    // poeira: pontos com tamanho e transparência próprios
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.puffPos, 3).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.puffAlpha, 1).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.puffSize, 1).setUsage(THREE.DynamicDrawUsage))
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color(0xd9c2a0) }, uScale: { value: window.innerHeight * 0.5 } },
      vertexShader: /* glsl */ `
        attribute float aAlpha;
        attribute float aSize;
        uniform float uScale;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.15, d) * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(uColor, a);
        }`,
    })
    this.puffPoints = new THREE.Points(geo, mat)
    this.puffPoints.frustumCulled = false
    this.group.add(this.puffPoints)

    const ringMat = new THREE.MeshBasicMaterial({ color: 0xfff1d6, transparent: true, depthWrite: false, side: THREE.DoubleSide })
    for (let i = 0; i < MAX_RINGS; i++) {
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), ringMat.clone())
      mesh.rotation.x = -Math.PI / 2
      mesh.visible = false
      this.group.add(mesh)
      this.rings.push({ mesh, life: 0, size: 1 })
    }
  }

  // strength 0–1: 1 é o golpe aéreo, ~0.3 uma espadada no chão
  burst(x: number, y: number, z: number, strength: number) {
    const chunks = Math.round(6 + strength * 26)
    for (let i = 0; i < chunks && this.chunks.length < MAX_CHUNKS; i++) {
      const a = Math.random() * Math.PI * 2
      const out = (1.5 + Math.random() * 3.5) * (0.5 + strength)
      this.chunks.push({
        p: new THREE.Vector3(x, y + 0.1, z),
        v: new THREE.Vector3(Math.cos(a) * out, 3 + Math.random() * 5 * (0.4 + strength), Math.sin(a) * out),
        rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0),
        spin: new THREE.Vector3(Math.random() * 10, Math.random() * 10, 0),
        life: 0.9 + Math.random() * 0.6,
        size: 0.05 + Math.random() * 0.09 * (0.6 + strength),
      })
    }
    const puffs = Math.round(5 + strength * 22)
    for (let i = 0; i < puffs && this.puffs.length < MAX_PUFFS; i++) {
      const a = Math.random() * Math.PI * 2
      const out = (0.6 + Math.random() * 2.2) * (0.5 + strength)
      const max = 0.7 + Math.random() * 0.7
      this.puffs.push({
        p: new THREE.Vector3(x + Math.cos(a) * 0.3, y + 0.2, z + Math.sin(a) * 0.3),
        v: new THREE.Vector3(Math.cos(a) * out, 0.4 + Math.random() * 1.2, Math.sin(a) * out),
        life: max,
        max,
        size: 0.6 + Math.random() * 0.9 * (0.5 + strength),
      })
    }
    if (strength > 0.6) {
      const ring = this.rings.find((r) => r.life <= 0) ?? this.rings[0]
      ring.life = 0.45
      ring.size = 2.5 + strength * 3.5
      ring.mesh.position.set(x, y + 0.08, z)
      ring.mesh.visible = true
    }
  }

  update(dt: number) {
    // torrões
    let n = 0
    this.chunks = this.chunks.filter((c) => (c.life -= dt) > 0)
    for (const c of this.chunks) {
      c.v.y -= 22 * dt
      c.p.addScaledVector(c.v, dt)
      const ground = heightAt(c.p.x, c.p.z)
      if (c.p.y < ground + c.size) {
        // quica e para
        c.p.y = ground + c.size
        c.v.y *= -0.25
        c.v.x *= 0.5
        c.v.z *= 0.5
      }
      c.rot.x += c.spin.x * dt
      c.rot.y += c.spin.y * dt
      const fade = Math.min(1, c.life / 0.3)
      this.m.compose(c.p, this.q.setFromEuler(c.rot), this.s.setScalar(c.size * fade))
      this.chunkMesh.setMatrixAt(n++, this.m)
    }
    this.chunkMesh.count = n
    this.chunkMesh.instanceMatrix.needsUpdate = true

    // poeira
    this.puffs = this.puffs.filter((p) => (p.life -= dt) > 0)
    this.puffs.forEach((p, i) => {
      p.v.multiplyScalar(1 - dt * 2.5)
      p.p.addScaledVector(p.v, dt)
      const t = 1 - p.life / p.max
      this.puffPos.set([p.p.x, p.p.y, p.p.z], i * 3)
      this.puffAlpha[i] = Math.sin(Math.PI * Math.min(1, t * 1.4)) * 0.55
      this.puffSize[i] = p.size * (0.6 + t * 1.6)
    })
    for (let i = this.puffs.length; i < MAX_PUFFS; i++) this.puffAlpha[i] = 0
    const g = this.puffPoints.geometry
    g.attributes.position.needsUpdate = true
    g.attributes.aAlpha.needsUpdate = true
    g.attributes.aSize.needsUpdate = true
    g.setDrawRange(0, this.puffs.length)

    // onda de choque
    for (const r of this.rings) {
      if (r.life <= 0) continue
      r.life -= dt
      const t = 1 - Math.max(0, r.life) / 0.45
      r.mesh.scale.setScalar(0.3 + t * r.size)
      ;(r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.7
      if (r.life <= 0) r.mesh.visible = false
    }
  }
}
