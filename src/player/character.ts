import * as THREE from 'three'
import { heightAt } from '../world/terrain'

const DRAW_TIME = 0.35 // sacar das costas
const SHEATHE_TIME = 0.7 // guardar nas costas
const SHEATHE_AFTER = 9 // segundos sem atacar até guardar a espada
const HOLD_ANGLE = 2.2 // ângulo da espada na mão em repouso (lâmina pra frente e pra baixo)

const BLADE_TIP = 1.37 // distância do meio do cabo até a ponta
const CHAIN_FROM = 0.2 // a partir daqui (fração do golpe) o próximo aperto fica guardado
const CHAIN_AT = 0.65 // e aqui o próximo golpe do combo começa
const COMBO_GRACE = 0.45 // segundos depois de um golpe em que ainda dá pra continuar o combo

type SwordState = 'sheathed' | 'drawing' | 'drawn' | 'sheathing'

const ORIGIN = new THREE.Vector3()
const IDENTITY = new THREE.Quaternion()

// Pose de ataque: rotações dos braços (x pra frente/cima, z pros lados), ângulo da espada na mão
// e o corpo (giro, inclinação, agachada).
interface Pose {
  rx: number
  rz: number
  lx: number
  lz: number
  hold: number
  twist: number
  pitch: number
  drop: number
}

const NEUTRAL: Pose = { rx: 0, rz: 0.08, lx: 0, lz: -0.08, hold: HOLD_ANGLE, twist: 0, pitch: 0, drop: 0 }
const pose = (p: Partial<Pose>): Pose => ({ ...NEUTRAL, ...p })

interface Move {
  duration: number
  // poses-chave; a primeira sai da pose em que o personagem estava
  keys: { at: number; pose: Pose }[]
  // golpe para quando a ponta encosta no chão (senão atravessa e deixa um sulco)
  stopAtGround?: boolean
}

const CHOP_END = pose({ rx: -0.3, rz: -0.5, lx: -0.3, lz: 0.5, hold: 3.1, pitch: 0.3, drop: 0.06 })

export const COMBO: Move[] = [
  // 1. diagonal: de cima, do lado da espada, descendo cruzado
  {
    duration: 0.5,
    keys: [
      { at: 0.35, pose: pose({ rx: -2.5, rz: 0.5, lx: -2.3, lz: 0.9, hold: 1.7, twist: 0.5, pitch: -0.05 }) },
      // termina com a ponta raspando o chão
      { at: 0.6, pose: pose({ rx: -0.3, rz: -0.6, lx: -0.6, lz: -0.1, hold: 3.2, twist: -0.6, pitch: 0.32 }) },
      { at: 1, pose: pose({ rx: -0.2, rz: -0.65, lx: -0.5, lz: 0, hold: 3.1, twist: -0.5, pitch: 0.27 }) },
    ],
  },
  // 2. horizontal: varre de um lado pro outro na altura da cintura
  {
    duration: 0.5,
    keys: [
      { at: 0.3, pose: pose({ rx: -1.3, rz: -1.1, lx: -1.2, lz: -0.3, hold: 3.1, twist: -0.9 }) },
      { at: 0.65, pose: pose({ rx: -1.3, rz: 1.0, lx: -1.2, lz: 1.4, hold: 3.1, twist: 0.9 }) },
      { at: 1, pose: pose({ rx: -1.1, rz: 0.8, lx: -1.0, lz: 1.2, hold: 3.0, twist: 0.7 }) },
    ],
  },
  // 3. pra baixo: ergue acima da cabeça e desce até a ponta tocar o chão
  {
    duration: 0.75,
    stopAtGround: true,
    keys: [
      { at: 0.4, pose: pose({ rx: -3.0, rz: -0.55, lx: -3.0, lz: 0.55, hold: 1.6, pitch: -0.1 }) },
      { at: 0.62, pose: CHOP_END },
      { at: 1, pose: CHOP_END },
    ],
  },
]

function evalMove(move: Move, from: Pose, p: number, out: Pose) {
  let a = from
  let aAt = 0
  for (const k of move.keys) {
    if (p <= k.at) {
      const u = THREE.MathUtils.smoothstep(p, aAt, k.at)
      for (const f of Object.keys(out) as (keyof Pose)[]) out[f] = a[f] + (k.pose[f] - a[f]) * u
      return
    }
    a = k.pose
    aAt = k.at
  }
  Object.assign(out, a)
}

export interface GroundMark {
  ax: number
  az: number
  bx: number
  bz: number
  width: number
  strength: number
}

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
  private tip = new THREE.Object3D()

  // combo
  private moveIdx = -1
  private moveT = 0
  private moveFrom: Pose = { ...NEUTRAL }
  private comboNext = 0
  private graceT = 0
  private chainQueued = false
  private attackW = 0
  private curPose: Pose = { ...NEUTRAL }
  private applied: Pose = { ...NEUTRAL }
  private pinP: number | null = null
  private dragA: THREE.Vector3 | null = null
  private dragB = new THREE.Vector3()
  private tmpA = new THREE.Vector3()
  private tmpB = new THREE.Vector3()

  // chamado quando a espada marca o chão
  onGroundMark: (mark: GroundMark) => void = () => {}

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
    this.tip.position.y = BLADE_TIP
    this.sword.add(this.tip)
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
    return this.moveIdx >= 0
  }

  // combo de três golpes; com a espada nas costas, saca primeiro e golpeia em seguida
  attack() {
    this.idleT = 0
    if (this.swordState === 'drawn') {
      if (this.moveIdx < 0) this.startMove(this.graceT > 0 ? this.comboNext : 0)
      else if (this.moveT / COMBO[this.moveIdx].duration >= CHAIN_FROM) this.chainQueued = true
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
      if (this.moveIdx < 0) {
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
        if (queued) this.startMove(0)
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

    if (this.pendingSlot) {
      this.pendingSlot.attach(this.sword) // mantém a posição no mundo; o deslize abaixo leva até o encaixe
      this.pendingSlot = null
    }
    const k = Math.min(1, dt * 14)
    this.sword.position.lerp(ORIGIN, k)
    this.sword.quaternion.slerp(IDENTITY, k)

    this.updateCombo(dt)
  }

  private startMove(i: number) {
    this.flushDrag()
    this.moveIdx = i
    this.moveT = 0
    this.moveFrom = { ...this.applied }
    this.attackW = 1
    this.pinP = null
    this.chainQueued = false
  }

  private updateCombo(dt: number) {
    const walk = {
      rx: this.armR.rotation.x,
      rz: this.armR.rotation.z,
      lx: this.armL.rotation.x,
      lz: this.armL.rotation.z,
    }
    this.graceT = Math.max(0, this.graceT - dt)

    let prevP = 0
    if (this.moveIdx >= 0) {
      prevP = this.moveT / COMBO[this.moveIdx].duration
      this.moveT += dt
      const raw = this.moveT / COMBO[this.moveIdx].duration
      if (this.chainQueued && this.moveIdx < COMBO.length - 1 && raw >= CHAIN_AT) {
        this.startMove(this.moveIdx + 1)
        prevP = 0
      } else if (raw >= 1) {
        const idx = this.moveIdx
        const last = idx === COMBO.length - 1
        const again = this.chainQueued && last
        this.flushDrag()
        this.moveIdx = -1
        // pouco tempo pra continuar o combo do golpe seguinte; depois do último, recomeça
        this.comboNext = last ? 0 : idx + 1
        this.graceT = last ? 0 : COMBO_GRACE
        if (again) this.startMove(0)
      }
    }

    if (this.moveIdx < 0) {
      // fora do golpe: volta suave pra pose normal
      this.attackW = THREE.MathUtils.lerp(this.attackW, 0, Math.min(1, dt * 6))
      this.applyPose(this.curPose, walk)
      return
    }

    const move = COMBO[this.moveIdx]
    let p = Math.min(1, this.moveT / move.duration)
    if (this.pinP !== null) p = Math.min(p, this.pinP)
    evalMove(move, this.moveFrom, p, this.curPose)
    this.applyPose(this.curPose, walk)

    // só testa o chão depois da preparação do golpe
    if (p < move.keys[0].at) return
    const clearance = this.tipClearance()

    if (move.stopAtGround) {
      if (this.pinP !== null || clearance >= 0.02) return
      // acha o instante exato em que a ponta encosta e congela ali
      let lo = Math.max(prevP, move.keys[0].at)
      let hi = p
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2
        evalMove(move, this.moveFrom, mid, this.curPose)
        this.applyPose(this.curPose, walk)
        if (this.tipClearance() < 0.02) hi = mid
        else lo = mid
      }
      this.pinP = lo
      evalMove(move, this.moveFrom, lo, this.curPose)
      this.applyPose(this.curPose, walk)

      // marca leve de contato, ao longo da lâmina
      const tip = this.tip.getWorldPosition(this.tmpA)
      const hilt = this.sword.getWorldPosition(this.tmpB)
      const dir = new THREE.Vector2(tip.x - hilt.x, tip.z - hilt.z)
      if (dir.lengthSq() < 1e-4) dir.set(Math.sin(this.root.rotation.y), Math.cos(this.root.rotation.y))
      dir.normalize()
      this.onGroundMark({
        ax: tip.x - dir.x * 0.5,
        az: tip.z - dir.y * 0.5,
        bx: tip.x + dir.x * 0.05,
        bz: tip.z + dir.y * 0.05,
        width: 0.12,
        strength: 0.45,
      })
      return
    }

    // golpes que atravessam o chão: guarda por onde a ponta passou e vira um sulco
    if (clearance < 0) {
      const tip = this.tip.getWorldPosition(this.tmpA)
      if (!this.dragA) this.dragA = tip.clone()
      this.dragB.copy(tip)
    } else {
      this.flushDrag()
    }
  }

  private flushDrag() {
    if (!this.dragA) return
    const a = this.dragA
    const b = this.dragB
    this.dragA = null
    // sulco curto demais (só encostou): estica um pouco ao longo do movimento ou da lâmina
    let dx = b.x - a.x
    let dz = b.z - a.z
    let len = Math.hypot(dx, dz)
    if (len < 1e-3) {
      dx = Math.sin(this.root.rotation.y)
      dz = Math.cos(this.root.rotation.y)
      len = 1
    }
    const ext = Math.max(0, 0.35 - Math.hypot(b.x - a.x, b.z - a.z)) / 2
    const ux = dx / len
    const uz = dz / len
    this.onGroundMark({
      ax: a.x - ux * ext,
      az: a.z - uz * ext,
      bx: b.x + ux * ext,
      bz: b.z + uz * ext,
      width: 0.16,
      strength: 0.8,
    })
  }

  // altura da ponta da lâmina acima do terreno (negativa = enterrada)
  private tipClearance(): number {
    const tip = this.tip.getWorldPosition(this.tmpA)
    return tip.y - heightAt(tip.x, tip.z)
  }

  private applyPose(pose: Pose, walk: { rx: number; rz: number; lx: number; lz: number }) {
    const w = this.attackW
    const lerp = THREE.MathUtils.lerp
    this.armR.rotation.x = lerp(walk.rx, pose.rx, w)
    this.armR.rotation.z = lerp(walk.rz, pose.rz, w)
    this.armL.rotation.x = lerp(walk.lx, pose.lx, w)
    this.armL.rotation.z = lerp(walk.lz, pose.lz, w)
    this.handSlot.rotation.x = lerp(HOLD_ANGLE, pose.hold, w)
    this.body.rotation.y = pose.twist * w
    this.body.rotation.x = this.lean + pose.pitch * w
    this.body.position.y = this.bob - pose.drop * w
    this.head.rotation.x = -this.body.rotation.x * 0.6

    const a = this.applied
    a.rx = this.armR.rotation.x
    a.rz = this.armR.rotation.z
    a.lx = this.armL.rotation.x
    a.lz = this.armL.rotation.z
    a.hold = this.handSlot.rotation.x
    a.twist = this.body.rotation.y
    a.pitch = pose.pitch * w
    a.drop = pose.drop * w
  }
}
