import * as THREE from 'three'

const LIFE = 0.14 // segundos que cada fatia do rastro dura
const MAX = 40
const SUBSTEPS = 3 // fatias extras entre quadros, pra curva não ficar quebrada em golpes rápidos

interface Sample {
  base: THREE.Vector3
  tip: THREE.Vector3
  age: number
}

// Rastro de luz da lâmina (como nos jogos de ação): uma fita entre o começo e a ponta da lâmina,
// que some do mais velho pro mais novo e da base pra ponta.
export class SwordTrail {
  readonly mesh: THREE.Mesh
  private samples: Sample[] = []
  private positions = new Float32Array(MAX * 2 * 3)
  private colors = new Float32Array(MAX * 2 * 4)
  private geo = new THREE.BufferGeometry()
  private lastBase = new THREE.Vector3()
  private lastTip = new THREE.Vector3()
  private hasLast = false

  constructor(color = 0xbfe3ff) {
    const indices: number[] = []
    for (let i = 0; i < MAX - 1; i++) {
      const a = i * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    this.geo.setIndex(indices)
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage))
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 4).setUsage(THREE.DynamicDrawUsage))
    const mat = new THREE.MeshBasicMaterial({
      color,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
    this.mesh = new THREE.Mesh(this.geo, mat)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 5
  }

  update(dt: number, base: THREE.Vector3, tip: THREE.Vector3, active: boolean) {
    for (const s of this.samples) s.age += dt
    while (this.samples.length && this.samples[0].age > LIFE) this.samples.shift()

    if (active) {
      // fatias intermediárias entre o quadro anterior e este
      const steps = this.hasLast ? SUBSTEPS : 1
      for (let i = 1; i <= steps; i++) {
        const u = i / steps
        this.samples.push({
          base: this.lastBase.clone().lerp(base, this.hasLast ? u : 1),
          tip: this.lastTip.clone().lerp(tip, this.hasLast ? u : 1),
          age: dt * (1 - u),
        })
      }
      while (this.samples.length > MAX) this.samples.shift()
      this.lastBase.copy(base)
      this.lastTip.copy(tip)
      this.hasLast = true
    } else {
      this.hasLast = false
    }

    const n = this.samples.length
    this.mesh.visible = n >= 2
    if (n < 2) return
    for (let i = 0; i < MAX; i++) {
      const s = this.samples[Math.min(i, n - 1)]
      const fade = i < n ? 1 - s.age / LIFE : 0
      const k = i * 6
      this.positions.set([s.base.x, s.base.y, s.base.z, s.tip.x, s.tip.y, s.tip.z], k)
      const c = i * 8
      // base quase transparente, ponta forte
      this.colors.set([1, 1, 1, fade * fade * 0.12, 1, 1, 1, fade * 0.85], c)
    }
    this.geo.attributes.position.needsUpdate = true
    this.geo.attributes.color.needsUpdate = true
    this.geo.setDrawRange(0, (n - 1) * 6)
  }
}
