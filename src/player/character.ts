import * as THREE from 'three'

const ATTACK_TIME = 0.45

// Personagem low-poly montado com primitivas, com membros em pivôs pra animar caminhada/corrida/pulo.
export class Character {
  readonly root = new THREE.Group()
  private body = new THREE.Group()
  private legL = new THREE.Group()
  private legR = new THREE.Group()
  private armL = new THREE.Group()
  private armR = new THREE.Group()
  private head = new THREE.Group()
  private scarfTail: THREE.Mesh
  private sword = new THREE.Group()
  private phase = 0
  private blend = 0
  private attackT = 0

  constructor() {
    const skin = new THREE.MeshStandardMaterial({ color: 0xf1c7a1, roughness: 0.8 })
    const tunic = new THREE.MeshStandardMaterial({ color: 0x2f6690, roughness: 0.85 })
    const tunicDark = new THREE.MeshStandardMaterial({ color: 0x1f4866, roughness: 0.85 })
    const pants = new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 0.9 })
    const boots = new THREE.MeshStandardMaterial({ color: 0x5a3b22, roughness: 0.9 })
    const hair = new THREE.MeshStandardMaterial({ color: 0x2b1d14, roughness: 0.9, flatShading: true })
    const scarf = new THREE.MeshStandardMaterial({ color: 0xc8553d, roughness: 0.9, side: THREE.DoubleSide })
    const belt = new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 0.8 })
    const eye = new THREE.MeshBasicMaterial({ color: 0x1a1a1a })

    const m = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(x, y, z)
      mesh.castShadow = true
      return mesh
    }

    this.root.add(this.body)

    // pernas (pivô no quadril)
    for (const [leg, sx] of [[this.legL, -1], [this.legR, 1]] as const) {
      leg.position.set(sx * 0.13, 0.88, 0)
      leg.add(m(new THREE.CapsuleGeometry(0.1, 0.5, 4, 8), pants, 0, -0.36, 0))
      leg.add(m(new THREE.BoxGeometry(0.2, 0.16, 0.3), boots, 0, -0.8, 0.04))
      this.body.add(leg)
    }

    // tronco
    this.body.add(m(new THREE.CapsuleGeometry(0.24, 0.42, 4, 10), tunic, 0, 1.2, 0))
    const skirt = m(new THREE.CylinderGeometry(0.25, 0.33, 0.3, 10), tunicDark, 0, 0.92, 0)
    this.body.add(skirt)
    this.body.add(m(new THREE.CylinderGeometry(0.26, 0.26, 0.08, 12), belt, 0, 1.03, 0))
    // bolsa de lado
    const bag = m(new THREE.BoxGeometry(0.12, 0.2, 0.22), belt, 0.28, 1.0, -0.02)
    this.body.add(bag)

    // braços (pivô no ombro)
    for (const [arm, sx] of [[this.armL, -1], [this.armR, 1]] as const) {
      arm.position.set(sx * 0.33, 1.42, 0)
      arm.add(m(new THREE.CapsuleGeometry(0.075, 0.38, 4, 8), tunic, 0, -0.22, 0))
      arm.add(m(new THREE.SphereGeometry(0.08, 8, 6), skin, 0, -0.5, 0))
      this.body.add(arm)
    }

    // cabeça
    this.head.position.set(0, 1.62, 0)
    this.head.add(m(new THREE.SphereGeometry(0.26, 16, 12), skin, 0, 0.18, 0))
    const hairCap = m(new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 0.22, -0.02)
    this.head.add(hairCap)
    const fringe = m(new THREE.ConeGeometry(0.12, 0.22, 4), hair, 0.08, 0.36, 0.2)
    fringe.rotation.set(1.2, 0, -0.4)
    this.head.add(fringe)
    const ponytail = m(new THREE.ConeGeometry(0.1, 0.35, 5), hair, 0, 0.18, -0.3)
    ponytail.rotation.x = -2.3
    this.head.add(ponytail)
    for (const sx of [-1, 1]) this.head.add(m(new THREE.SphereGeometry(0.035, 6, 4), eye, sx * 0.09, 0.2, 0.24))
    this.body.add(this.head)

    // cachecol + ponta que balança
    this.body.add(m(new THREE.TorusGeometry(0.19, 0.06, 6, 14), scarf, 0, 1.55, 0).rotateX(Math.PI / 2))
    this.scarfTail = m(new THREE.PlaneGeometry(0.16, 0.45), scarf, 0.08, 1.35, -0.22)
    this.scarfTail.geometry.translate(0, -0.2, 0)
    this.scarfTail.position.y = 1.55
    this.body.add(this.scarfTail)

    // espada na mão direita (filha do braço, então acompanha o balanço)
    const steel = new THREE.MeshStandardMaterial({ color: 0xd8dde3, metalness: 0.85, roughness: 0.25 })
    const gold = new THREE.MeshStandardMaterial({ color: 0xd4a537, metalness: 0.7, roughness: 0.3 })
    this.sword.add(m(new THREE.CylinderGeometry(0.03, 0.035, 0.2, 8), belt, 0, 0, 0)) // cabo
    this.sword.add(m(new THREE.SphereGeometry(0.045, 8, 6), gold, 0, -0.12, 0)) // pomo
    this.sword.add(m(new THREE.BoxGeometry(0.26, 0.04, 0.06), gold, 0, 0.12, 0)) // guarda
    this.sword.add(m(new THREE.BoxGeometry(0.07, 0.75, 0.02), steel, 0, 0.52, 0)) // lâmina
    const tip = m(new THREE.ConeGeometry(0.05, 0.12, 4), steel, 0, 0.95, 0)
    tip.scale.z = 0.3
    this.sword.add(tip)
    this.sword.position.set(0, -0.5, 0.04)
    this.sword.rotation.x = 1.2 // apontando pra frente e um pouco pra cima
    this.armR.add(this.sword)

    // sombra falsa sempre visível (ajuda a ler a altura no pulo)
    const blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.45, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }),
    )
    blob.rotation.x = -Math.PI / 2
    blob.name = 'blob'
    this.root.add(blob)
  }

  get blobShadow(): THREE.Object3D {
    return this.root.getObjectByName('blob')!
  }

  get attacking(): boolean {
    return this.attackT > 0
  }

  // golpe em arco; ignora se já estiver no meio de um
  attack() {
    if (this.attackT <= 0) this.attackT = ATTACK_TIME
  }

  // speed: velocidade horizontal (m/s); airborne: no ar
  update(dt: number, speed: number, airborne: boolean, t: number) {
    const moving = Math.min(1, speed / 3)
    this.blend += (moving - this.blend) * Math.min(1, dt * 10)
    const running = speed > 7

    this.phase += dt * (running ? 12 : 8.5) * Math.max(0.3, this.blend)
    const swing = Math.sin(this.phase) * (running ? 0.95 : 0.6) * this.blend

    if (airborne) {
      this.legL.rotation.x = THREE.MathUtils.lerp(this.legL.rotation.x, -0.6, dt * 10)
      this.legR.rotation.x = THREE.MathUtils.lerp(this.legR.rotation.x, 0.3, dt * 10)
      this.armL.rotation.x = THREE.MathUtils.lerp(this.armL.rotation.x, -2.4, dt * 8)
      this.armR.rotation.x = THREE.MathUtils.lerp(this.armR.rotation.x, -2.4, dt * 8)
      this.armL.rotation.z = THREE.MathUtils.lerp(this.armL.rotation.z, -0.4, dt * 8)
      this.armR.rotation.z = THREE.MathUtils.lerp(this.armR.rotation.z, 0.4, dt * 8)
      this.body.position.y = THREE.MathUtils.lerp(this.body.position.y, 0, dt * 10)
    } else {
      this.legL.rotation.x = swing
      this.legR.rotation.x = -swing
      this.armL.rotation.x = -swing * 0.9
      this.armR.rotation.x = swing * 0.9
      this.armL.rotation.z = THREE.MathUtils.lerp(this.armL.rotation.z, -0.08, dt * 8)
      this.armR.rotation.z = THREE.MathUtils.lerp(this.armR.rotation.z, 0.08, dt * 8)
      // quique do passo + respiração parado
      const bob = Math.abs(Math.sin(this.phase)) * 0.07 * this.blend + Math.sin(t * 2) * 0.012 * (1 - this.blend)
      this.body.position.y = bob
    }

    // inclina pra frente quando corre
    const lean = running ? 0.22 : 0.08 * this.blend
    this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, lean, dt * 6)
    this.head.rotation.x = -this.body.rotation.x * 0.6

    this.scarfTail.rotation.x = 0.4 + this.blend * 0.9 + Math.sin(t * 9) * 0.12 * (0.3 + this.blend)

    // ---- golpe: sobrescreve o braço direito e gira o tronco ----
    if (this.attackT > 0) {
      this.attackT = Math.max(0, this.attackT - dt)
      const p = 1 - this.attackT / ATTACK_TIME // 0 → 1
      // ergue rápido (0–25%), corta (25–60%), volta (60–100%)
      const raise = THREE.MathUtils.smoothstep(p, 0, 0.25)
      const cut = THREE.MathUtils.smoothstep(p, 0.25, 0.6)
      const back = THREE.MathUtils.smoothstep(p, 0.6, 1)
      this.armR.rotation.x = THREE.MathUtils.lerp(-2.8 * raise + 2.4 * cut, this.armR.rotation.x, back)
      this.armR.rotation.z = THREE.MathUtils.lerp(0.5 * raise - 0.9 * cut, 0.08, back)
      this.body.rotation.y = (0.35 * raise - 0.8 * cut) * (1 - back)
      this.sword.rotation.x = THREE.MathUtils.lerp(1.2 - 0.9 * raise + 0.6 * cut, 1.2, back)
    } else {
      this.body.rotation.y = THREE.MathUtils.lerp(this.body.rotation.y, 0, dt * 10)
    }
  }
}
