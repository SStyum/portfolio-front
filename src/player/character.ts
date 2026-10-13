import * as THREE from 'three'

const ATTACK_TIME = 0.6 // golpe de duas mãos, mais pesado
const DRAW_TIME = 0.35 // sacar das costas
const SHEATHE_TIME = 0.7 // guardar nas costas
const SHEATHE_AFTER = 9 // segundos sem atacar até guardar a espada
const HOLD_ANGLE = 2.2 // ângulo da espada na mão em repouso (lâmina pra frente e pra baixo)

type SwordState = 'sheathed' | 'drawing' | 'drawn' | 'sheathing'

const ORIGIN = new THREE.Vector3()
const IDENTITY = new THREE.Quaternion()

// Espada larga inspirada na Rebellion: lâmina grossa com sulco, guarda de caveira com asas e cabo longo.
// Origem no meio do cabo, lâmina apontando pra +y, largura em x.
function createGreatsword(leather: THREE.Material): THREE.Group {
  const steel = new THREE.MeshStandardMaterial({ color: 0xb9c0c8, metalness: 0.9, roughness: 0.3, flatShading: true })
  const fuller = new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 0.6, roughness: 0.5 })
  const bone = new THREE.MeshStandardMaterial({ color: 0xd9d2c0, roughness: 0.7, flatShading: true })
  const silver = new THREE.MeshStandardMaterial({ color: 0x9aa1a8, metalness: 0.8, roughness: 0.35, flatShading: true })
  const dark = new THREE.MeshBasicMaterial({ color: 0x111111 })

  const sword = new THREE.Group()
  const add = (mesh: THREE.Mesh, x = 0, y = 0, z = 0) => {
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    sword.add(mesh)
    return mesh
  }

  // cabo comprido (cabe as duas mãos) com anéis e pomo
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.36, 8), leather))
  for (const y of [-0.1, 0, 0.1]) add(new THREE.Mesh(new THREE.TorusGeometry(0.037, 0.01, 4, 10), silver), 0, y).rotateX(Math.PI / 2)
  add(new THREE.Mesh(new THREE.OctahedronGeometry(0.06), silver), 0, -0.22)

  // guarda: caveira com asas curvadas pra baixo e chifres curtos
  const skull = add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), bone), 0, 0.25)
  skull.scale.set(1, 1.05, 0.75)
  add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.08), bone), 0, 0.18) // mandíbula
  for (const z of [-1, 1]) {
    for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), dark), sx * 0.035, 0.26, z * 0.06)
  }
  for (const sx of [-1, 1]) {
    const wing = add(new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.32, 4), silver), sx * 0.17, 0.2)
    wing.rotation.z = sx * 2.1
    wing.scale.z = 0.5
    const horn = add(new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.14, 4), bone), sx * 0.08, 0.34)
    horn.rotation.z = -sx * 0.5
  }

  // lâmina larga: base com ombros, corpo reto e ponta angulada
  const shape = new THREE.Shape()
  shape.moveTo(-0.12, 0)
  shape.lineTo(-0.12, 0.1)
  shape.lineTo(-0.085, 0.18)
  shape.lineTo(-0.085, 0.86)
  shape.lineTo(0, 1.05)
  shape.lineTo(0.085, 0.86)
  shape.lineTo(0.085, 0.18)
  shape.lineTo(0.12, 0.1)
  shape.lineTo(0.12, 0)
  shape.closePath()
  const bladeGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.024,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 1,
  })
  bladeGeo.translate(0, 0, -0.012)
  add(new THREE.Mesh(bladeGeo, steel), 0, 0.32)
  add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.6, 0.05), fuller), 0, 0.32 + 0.52)

  return sword
}

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
  private phase = 0
  private blend = 0
  private lean = 0
  private bob = 0

  // espada: troca de pai entre a mão e as costas, e sempre desliza até o encaixe atual
  private sword: THREE.Group
  private handSlot = new THREE.Object3D()
  private backSlot = new THREE.Object3D()
  private swordState: SwordState = 'sheathed'
  private swordT = 0
  private idleT = 0
  private queuedAttack = false
  private pendingSlot: THREE.Object3D | null = null
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

    // encaixe da mão: largura da lâmina no plano do golpe, pra cortar com o fio e não com a parte chata
    this.handSlot.position.set(0, -0.5, 0.04)
    this.handSlot.rotation.set(HOLD_ANGLE, Math.PI / 2, 0)
    this.armR.add(this.handSlot)

    // encaixe das costas: cabo acima do ombro direito, lâmina descendo na diagonal
    this.backSlot.position.set(0.2, 1.78, -0.38)
    this.backSlot.rotation.z = 2.67
    this.body.add(this.backSlot)

    // bainha nas costas + alça cruzando o peito
    const sheathMat = new THREE.MeshStandardMaterial({ color: 0x3b2416, roughness: 0.85 })
    const trim = new THREE.MeshStandardMaterial({ color: 0x9aa1a8, metalness: 0.8, roughness: 0.35 })
    const sheathShape = new THREE.Shape()
    sheathShape.moveTo(-0.15, 0)
    sheathShape.lineTo(-0.11, 0.9)
    sheathShape.lineTo(0, 1.14)
    sheathShape.lineTo(0.11, 0.9)
    sheathShape.lineTo(0.15, 0)
    sheathShape.closePath()
    const sheathGeo = new THREE.ExtrudeGeometry(sheathShape, {
      depth: 0.06,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 1,
    })
    sheathGeo.translate(0, 0, -0.03)
    this.backSlot.add(m(sheathGeo, sheathMat, 0, 0.3, 0))
    this.backSlot.add(m(new THREE.BoxGeometry(0.34, 0.06, 0.1), trim, 0, 0.33, 0)) // boca
    this.backSlot.add(m(new THREE.BoxGeometry(0.2, 0.05, 0.09), trim, 0, 1.2, 0)) // ponteira
    const strapTilt = new THREE.Group()
    strapTilt.position.set(0, 1.25, 0)
    strapTilt.rotation.z = 0.6
    const strap = m(new THREE.TorusGeometry(0.27, 0.025, 4, 18), belt)
    strap.rotation.x = Math.PI / 2
    strap.scale.x = 1.22
    strapTilt.add(strap)
    this.body.add(strapTilt)

    // começa guardada
    this.sword = createGreatsword(belt)
    this.backSlot.add(this.sword)

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

  // golpe de duas mãos; com a espada nas costas, saca primeiro e golpeia em seguida
  attack() {
    this.idleT = 0
    if (this.swordState === 'drawn') {
      if (this.attackT <= 0) this.attackT = ATTACK_TIME
    } else if (this.swordState === 'sheathed') {
      this.startTransition('drawing')
      this.queuedAttack = true
    } else {
      this.queuedAttack = true
    }
  }

  private startTransition(state: 'drawing' | 'sheathing') {
    this.swordState = state
    this.swordT = 0
  }

  // avança a máquina de estados da espada; devolve o quanto o braço direito deve alcançar as costas (0–1)
  private updateSword(dt: number): number {
    if (this.swordState === 'drawn') {
      if (this.attackT <= 0) {
        this.idleT += dt
        if (this.idleT >= SHEATHE_AFTER) this.startTransition('sheathing')
      }
      return 0
    }
    if (this.swordState === 'sheathed') return 0

    const drawing = this.swordState === 'drawing'
    const total = drawing ? DRAW_TIME : SHEATHE_TIME
    const before = this.swordT / total
    this.swordT += dt
    const p = Math.min(1, this.swordT / total)

    // no meio do movimento a mão está no ombro: a espada troca de pai
    if (before < 0.5 && p >= 0.5) this.pendingSlot = drawing ? this.handSlot : this.backSlot

    if (p >= 1) {
      this.idleT = 0
      const queued = this.queuedAttack
      this.queuedAttack = false
      if (drawing) {
        this.swordState = 'drawn'
        if (queued) this.attackT = ATTACK_TIME
      } else {
        this.swordState = 'sheathed'
        // apertou golpe enquanto guardava: saca de novo
        if (queued) this.attack()
      }
    }
    return Math.sin(Math.PI * p)
  }

  // speed: velocidade horizontal (m/s); airborne: no ar
  update(dt: number, speed: number, airborne: boolean, t: number) {
    const moving = Math.min(1, speed / 3)
    this.blend += (moving - this.blend) * Math.min(1, dt * 10)
    const running = speed > 7
    const holding = this.sword.parent === this.handSlot

    this.phase += dt * (running ? 12 : 8.5) * Math.max(0.3, this.blend)
    const swing = Math.sin(this.phase) * (running ? 0.95 : 0.6) * this.blend

    if (airborne) {
      this.legL.rotation.x = THREE.MathUtils.lerp(this.legL.rotation.x, -0.6, dt * 10)
      this.legR.rotation.x = THREE.MathUtils.lerp(this.legR.rotation.x, 0.3, dt * 10)
      this.armL.rotation.x = THREE.MathUtils.lerp(this.armL.rotation.x, -2.4, dt * 8)
      this.armR.rotation.x = THREE.MathUtils.lerp(this.armR.rotation.x, holding ? -0.6 : -2.4, dt * 8)
      this.armL.rotation.z = THREE.MathUtils.lerp(this.armL.rotation.z, -0.4, dt * 8)
      this.armR.rotation.z = THREE.MathUtils.lerp(this.armR.rotation.z, 0.4, dt * 8)
      this.bob = THREE.MathUtils.lerp(this.bob, 0, dt * 10)
    } else {
      this.legL.rotation.x = swing
      this.legR.rotation.x = -swing
      this.armL.rotation.x = -swing * 0.9
      // espada pesada: o braço dela balança bem menos
      this.armR.rotation.x = swing * 0.9 * (holding ? 0.35 : 1)
      this.armL.rotation.z = THREE.MathUtils.lerp(this.armL.rotation.z, -0.08, dt * 8)
      this.armR.rotation.z = THREE.MathUtils.lerp(this.armR.rotation.z, 0.08, dt * 8)
      // quique do passo + respiração parado
      this.bob = Math.abs(Math.sin(this.phase)) * 0.07 * this.blend + Math.sin(t * 2) * 0.012 * (1 - this.blend)
    }

    // inclina pra frente quando corre
    this.lean = THREE.MathUtils.lerp(this.lean, running ? 0.22 : 0.08 * this.blend, dt * 6)

    this.scarfTail.rotation.x = 0.4 + this.blend * 0.9 + Math.sin(t * 9) * 0.12 * (0.3 + this.blend)

    // ---- sacar / guardar: braço direito vai até o ombro, por trás ----
    const reach = this.updateSword(dt)
    if (reach > 0) {
      this.armR.rotation.x = THREE.MathUtils.lerp(this.armR.rotation.x, -3.5, reach)
      this.armR.rotation.z = THREE.MathUtils.lerp(this.armR.rotation.z, -0.2, reach)
    }

    // ---- golpe vertical de duas mãos: ergue acima da cabeça, desce cortando, volta ----
    let holdAngle = HOLD_ANGLE
    let chop = 0
    if (this.attackT > 0) {
      this.attackT = Math.max(0, this.attackT - dt)
      const p = 1 - this.attackT / ATTACK_TIME // 0 → 1
      const raise = THREE.MathUtils.smoothstep(p, 0, 0.3)
      const cut = THREE.MathUtils.smoothstep(p, 0.3, 0.5)
      const back = THREE.MathUtils.smoothstep(p, 0.6, 1)
      const armX = -3.0 * raise + 2.1 * cut // acima da cabeça → à frente e pra baixo
      const grip = 0.55 * raise // mãos se juntam no cabo
      this.armR.rotation.x = THREE.MathUtils.lerp(armX, this.armR.rotation.x, back)
      this.armL.rotation.x = THREE.MathUtils.lerp(armX, this.armL.rotation.x, back)
      this.armR.rotation.z = THREE.MathUtils.lerp(-grip, this.armR.rotation.z, back)
      this.armL.rotation.z = THREE.MathUtils.lerp(grip, this.armL.rotation.z, back)
      // lâmina aponta pra trás na preparação e segue o braço no corte
      holdAngle = THREE.MathUtils.lerp(HOLD_ANGLE - 0.6 * raise + 1.3 * cut, HOLD_ANGLE, back)
      chop = cut * (1 - back)
    }
    this.handSlot.rotation.x = holdAngle
    // corpo acompanha o corte: inclina e abaixa um pouco
    this.body.rotation.x = this.lean + 0.25 * chop
    this.body.position.y = this.bob - 0.06 * chop
    this.head.rotation.x = -this.body.rotation.x * 0.6

    if (this.pendingSlot) {
      this.pendingSlot.attach(this.sword) // mantém a posição no mundo; o deslize abaixo leva até o encaixe
      this.pendingSlot = null
    }
    const k = Math.min(1, dt * 14)
    this.sword.position.lerp(ORIGIN, k)
    this.sword.quaternion.slerp(IDENTITY, k)
  }
}
