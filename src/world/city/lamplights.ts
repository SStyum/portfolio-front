import * as THREE from 'three'

// Luz de verdade nos postes: um número fixo de luzes que vão sempre pros postes mais perto do jogador.
// (dezenas de luzes custariam caro; com um conjunto fixo o shader não recompila e o custo é constante)
export class LampLights {
  private lights: THREE.PointLight[] = []
  private power: number[] = []
  private timer = 0

  constructor(
    scene: THREE.Scene,
    private spots: THREE.Vector4[], // x, y, z e a potência (luminária baixa = mais fraca)
    count = 12,
  ) {
    for (let i = 0; i < count; i++) {
      const l = new THREE.PointLight(0xffd29a, 0, 24, 1.6)
      l.position.set(0, -100, 0)
      scene.add(l)
      this.lights.push(l)
    }
  }

  update(dt: number, player: THREE.Vector3, night: number) {
    // reescolhe os postes 4x por segundo
    this.timer -= dt
    if (this.timer <= 0) {
      this.timer = 0.25
      const near = this.spots
        .map((p) => ({ p, d: (p.x - player.x) ** 2 + (p.z - player.z) ** 2 }))
        .sort((a, b) => a.d - b.d)
        .slice(0, this.lights.length)
      near.forEach((n, i) => {
        this.lights[i].position.copy(n.p)
        this.power[i] = n.p.w
      })
    }
    // some aos poucos com a distância, pra não "acender" de repente quando troca de poste
    this.lights.forEach((l, i) => {
      const d = Math.hypot(l.position.x - player.x, l.position.z - player.z)
      const fade = 1 - THREE.MathUtils.smoothstep(d, 26, 40)
      l.intensity = night * (this.power[i] ?? 0) * fade
    })
  }
}

// Mancha de luz quente na calçada em frente a cada vitrine (barata: um plano aditivo instanciado)
export function createShopGlow(spots: { x: number; z: number; yaw: number; w: number }[]) {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 64
  const ctx = c.getContext('2d')!
  // mais forte junto da vitrine (topo), sumindo pra rua
  const g = ctx.createLinearGradient(0, 0, 0, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 64)
  const side = ctx.createLinearGradient(0, 0, 128, 0)
  side.addColorStop(0, 'rgba(0,0,0,1)')
  side.addColorStop(0.2, 'rgba(0,0,0,0)')
  side.addColorStop(0.8, 'rgba(0,0,0,0)')
  side.addColorStop(1, 'rgba(0,0,0,1)')
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = side
  ctx.fillRect(0, 0, 128, 64)
  const tex = new THREE.CanvasTexture(c)
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xffe0b0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, spots.length))
  spots.forEach((s, i) => {
    const depth = 3.4
    mesh.setMatrixAt(
      i,
      new THREE.Matrix4().compose(
        new THREE.Vector3(s.x + Math.sin(s.yaw) * depth / 2, 0.17, s.z + Math.cos(s.yaw) * depth / 2),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.yaw),
        new THREE.Vector3(s.w + 2, 1, depth),
      ),
    )
  })
  mesh.count = spots.length
  mesh.renderOrder = 2
  return {
    mesh,
    setNight(night: number) {
      mat.opacity = night * 0.45
    },
  }
}
