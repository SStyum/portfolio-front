import * as THREE from 'three'
import type { Input } from '../input'
import type { Colliders, Ledge } from '../world/colliders'
import { CITY_EDGE, HILL, inHill } from '../world/layout'
import { heightAt } from '../world/terrain'
import { Character } from './character'

const WALK = 5
const RUN = 9.5
const JUMP = 8.5
const GRAVITY = 24
const RADIUS = 0.4
const AIR_HOP = 6.5 // impulso pra cima no começo do golpe aéreo
const DIVE_SPEED = 30 // mergulho do golpe aéreo

// parkour
const GRAB_MAX = 3.7 // topo até ~um boneco acima da cabeça (a partir do chão de onde pulou): agarra
const HANG_DROP = 2.05 // pendurado: pés abaixo do topo
const CLIMB_TIME = 0.8
const HANDS = 2.15 // altura das mãos esticadas acima dos pés

type Parkour = 'none' | 'kick' | 'hang' | 'climb' | 'bump'

// Movimento em terceira pessoa relativo à câmera + câmera orbital com colisão simples
export class PlayerController {
  readonly character = new Character()
  readonly position = new THREE.Vector3()
  private velocity = new THREE.Vector3()
  private velY = 0
  private onGround = true
  private facing = 0
  private groundY = 0 // chão de onde saiu o último pulo

  private pk: Parkour = 'none'
  private ledge: Ledge | null = null
  private pkT = 0
  private climbFrom = new THREE.Vector3()

  camYaw = 0
  camPitch = 0.32
  private camDist = 7
  private camDistTarget = 7
  private camTarget = new THREE.Vector3()
  private trauma = 0 // tremor de câmera (0–1), some sozinho
  private time = 0

  constructor(
    private camera: THREE.PerspectiveCamera,
    private colliders: Colliders,
  ) {}

  get facingAngle(): number {
    return this.facing
  }

  // tremor de câmera nos impactos
  shake(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount)
  }

  get speed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z)
  }

  // chão sob os pés: rua/calçada ou o topo de algo em que dá pra pisar (telhado, máquina, caixote)
  private groundAt(x: number, z: number, feet: number) {
    return Math.max(heightAt(x, z), this.colliders.platformAt(x, z, feet, RADIUS))
  }

  teleport(x: number, z: number, facing: number) {
    this.position.set(x, heightAt(x, z), z)
    this.velocity.set(0, 0, 0)
    this.velY = 0
    this.pk = 'none'
    this.character.setParkour(null)
    this.facing = facing
    // câmera atrás do personagem
    this.camYaw = facing + Math.PI
    this.camTarget.copy(this.position).add(new THREE.Vector3(0, 1.5, 0))
    this.character.root.position.copy(this.position)
    this.character.root.rotation.y = facing
  }

  update(dt: number, input: Input, t: number) {
    // ---- câmera: mouse/toque ----
    const look = input.consumeLook()
    this.camYaw -= look.x * 0.0028
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + look.y * 0.0022, -0.25, 1.2)
    this.camDistTarget = THREE.MathUtils.clamp(this.camDistTarget + look.zoom * 0.8, 3, 14)

    if (this.pk === 'hang' || this.pk === 'climb') {
      this.updateLedge(dt, input)
    } else {
      this.updateMove(dt, input)
    }

    // ---- personagem ----
    this.character.root.position.copy(this.position)
    this.character.root.rotation.y = this.facing
    if (this.ledge && (this.pk === 'hang' || this.pk === 'climb')) this.feedHands()
    this.character.update(dt, this.speed, !this.onGround, t)

    const ground = this.groundAt(this.position.x, this.position.z, this.position.y + 0.05)
    const blob = this.character.blobShadow
    blob.position.y = ground - this.position.y + 0.04
    blob.scale.setScalar(Math.max(0.4, 1 - (this.position.y - ground) * 0.15))

    this.updateCamera(dt)
  }

  // ---------- andar, pular, golpear ----------
  private updateMove(dt: number, input: Input) {
    const axis = input.axis()
    const fwd = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw))
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x)
    const wish = fwd.multiplyScalar(axis.y).add(right.multiplyScalar(axis.x))

    const air = this.character.airPhase
    let maxSpeed = input.sprint ? RUN : WALK
    if (this.character.attacking) maxSpeed *= 0.35 // golpeando: anda devagar
    if (air === 'slam' || this.pk === 'kick') maxSpeed = 0
    const target = wish.multiplyScalar(maxSpeed)
    // cada corte dá um passo pra frente
    const facingX = Math.sin(this.facing)
    const facingZ = Math.cos(this.facing)
    const lunge = this.character.lungeSpeed
    target.x += facingX * lunge
    target.z += facingZ * lunge
    const accel = this.onGround ? 14 : 4
    this.velocity.x += (target.x - this.velocity.x) * Math.min(1, accel * dt)
    this.velocity.z += (target.z - this.velocity.z) * Math.min(1, accel * dt)
    if (air === 'rise') this.velocity.multiplyScalar(1 - Math.min(1, dt * 6)) // quase para no ar
    if (air === 'dive') this.velocity.set(facingX * 5, 0, facingZ * 5)
    if (this.pk === 'kick') this.velocity.set(0, 0, 0)

    this.position.x += this.velocity.x * dt
    this.position.z += this.velocity.z * dt

    // colisão (só com o que está na altura do corpo: dá pra passar por cima do que é baixo)
    this.colliders.resolve(this.position, RADIUS, this.position.y)
    // limites: a cidade, mais a colina ao norte
    const onHill = inHill(this.position.x, this.position.z) || (this.position.z < -CITY_EDGE && this.position.x > HILL.x0 + 1 && this.position.x < HILL.x1 - 1)
    this.position.x = THREE.MathUtils.clamp(this.position.x, onHill ? HILL.x0 + 1.5 : -CITY_EDGE, onHill ? HILL.x1 - 1.5 : CITY_EDGE)
    this.position.z = THREE.MathUtils.clamp(this.position.z, onHill ? HILL.back + 2 : -CITY_EDGE, CITY_EDGE)

    // ---- pulo, parede, golpes e gravidade ----
    const ground = this.groundAt(this.position.x, this.position.z, this.position.y)
    if (input.gameplay && input.consume('Space')) {
      if (this.onGround && !air) {
        this.velY = JUMP
        this.onGround = false
        this.groundY = this.position.y
      } else if (!this.onGround && this.pk === 'none' && !air) {
        this.tryWallKick()
      }
    }
    if (input.gameplay && (input.consume('KeyF') || input.consume('Attack')) && this.pk === 'none') {
      // no ar e com altura: Helm Breaker; no chão: combo
      if (!this.onGround && this.position.y - ground > 0.9 && this.character.airAttack()) this.velY = AIR_HOP
      else this.character.attack()
    }
    if (air === 'dive') this.velY = -DIVE_SPEED
    else this.velY -= GRAVITY * (air === 'rise' ? 0.35 : 1) * dt
    this.position.y += this.velY * dt

    // subindo a parede: alcançou o topo com as mãos? agarra. Parou de subir sem alcançar? bate e cai
    if (this.pk === 'kick' && this.ledge) {
      const reachable = this.ledge.top - this.groundY <= GRAB_MAX
      if (reachable && this.position.y + HANDS >= this.ledge.top) {
        this.grab()
        return
      }
      if (this.velY <= 0) {
        this.pk = 'bump'
        this.character.setParkour('bump')
        this.velocity.set(this.ledge.nx * 2.2, 0, this.ledge.nz * 2.2)
        this.shake(0.15)
      }
    }

    if (this.position.y <= ground) {
      this.position.y = ground
      this.velY = 0
      this.onGround = true
      this.groundY = ground
      if (this.pk !== 'none') {
        this.pk = 'none'
        this.character.setParkour(null)
      }
      if (air === 'rise' || air === 'dive') {
        this.character.root.position.copy(this.position)
        this.character.land()
      }
    } else if (this.onGround && this.position.y - ground < 0.45 && this.velY <= 0) {
      // degrau pequeno pra baixo (meio-fio): gruda no chão
      this.position.y = ground
      this.velY = 0
    } else {
      this.onGround = false
    }

    if (this.speed > 0.3 && this.pk === 'none') {
      const want = Math.atan2(this.velocity.x, this.velocity.z)
      let diff = want - this.facing
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      this.facing += diff * Math.min(1, dt * 12)
    }
  }

  // No ar, encostado numa parede: impulso pra cima tentando pegar o topo
  private tryWallKick() {
    const wall = this.colliders.wallAt(this.position.x, this.position.z, RADIUS, this.position.y, 0.45)
    if (!wall) return
    this.ledge = wall
    this.pk = 'kick'
    this.facing = Math.atan2(-wall.nx, -wall.nz) // de frente pra parede
    const reachable = wall.top - this.groundY <= GRAB_MAX
    // sobe o suficiente pras mãos chegarem no topo (ou tenta e não alcança)
    const need = wall.top - (this.position.y + HANDS) + 0.15
    this.velY = reachable ? Math.min(10, Math.sqrt(2 * GRAVITY * Math.max(0.2, need))) : 6.5
    this.velocity.set(0, 0, 0)
    this.character.setParkour('kick')
  }

  private grab() {
    const l = this.ledge!
    this.pk = 'hang'
    this.velY = 0
    this.velocity.set(0, 0, 0)
    this.onGround = false
    this.position.set(l.x + l.nx * (RADIUS + 0.05), l.top - HANG_DROP, l.z + l.nz * (RADIUS + 0.05))
    this.facing = Math.atan2(-l.nx, -l.nz)
    this.character.setParkour('hang')
    this.shake(0.08)
  }

  // ---------- pendurado / subindo ----------
  private updateLedge(dt: number, input: Input) {
    const l = this.ledge!
    if (this.pk === 'hang') {
      if (input.gameplay && input.consume('Space')) {
        this.pk = 'climb'
        this.pkT = 0
        this.climbFrom.copy(this.position)
        this.character.setParkour('climb')
      } else if (input.gameplay && (input.axis().y < -0.5 || input.consume('KeyF') || input.consume('Attack'))) {
        // solta da beirada
        this.pk = 'none'
        this.character.setParkour(null)
        this.velocity.set(l.nx * 2, 0, l.nz * 2)
        this.velY = 0
        this.position.addScaledVector(new THREE.Vector3(l.nx, 0, l.nz), 0.15)
      }
      return
    }

    // subida com estilo: puxa o corpo até a beirada e dá um mortal pra cima do telhado
    this.pkT = Math.min(1, this.pkT + dt / CLIMB_TIME)
    const p = this.pkT
    this.character.setClimbProgress(p)
    const ease = (u: number) => u * u * (3 - 2 * u)
    const over = new THREE.Vector3(l.x - l.nx * 0.9, l.top, l.z - l.nz * 0.9)
    if (p < 0.45) {
      this.position.y = this.climbFrom.y + (l.top + 0.5 - this.climbFrom.y) * ease(p / 0.45)
    } else {
      const u = (p - 0.45) / 0.55
      this.position.x = THREE.MathUtils.lerp(this.climbFrom.x, over.x, ease(u))
      this.position.z = THREE.MathUtils.lerp(this.climbFrom.z, over.z, ease(u))
      this.position.y = l.top + 0.5 * (1 - u) + Math.sin(Math.PI * u) * 0.7
    }
    if (p >= 1) {
      this.position.copy(over)
      this.pk = 'none'
      this.onGround = true
      this.groundY = l.top
      this.velY = 0
      this.ledge = null
      this.character.setParkour(null)
      this.shake(0.12)
    }
  }

  // mãos nos dois lados do ponto da beirada
  private feedHands() {
    const l = this.ledge!
    const tx = -l.nz
    const tz = l.nx
    const a = new THREE.Vector3(l.x + tx * 0.24 - l.nx * 0.06, l.top + 0.02, l.z + tz * 0.24 - l.nz * 0.06)
    const b = new THREE.Vector3(l.x - tx * 0.24 - l.nx * 0.06, l.top + 0.02, l.z - tz * 0.24 - l.nz * 0.06)
    // braço direito fica no +x local do personagem
    const rx = Math.cos(this.facing)
    const rz = -Math.sin(this.facing)
    const aRight = (a.x - b.x) * rx + (a.z - b.z) * rz > 0
    this.character.setLedgeHands(aRight ? b : a, aRight ? a : b)
  }

  // ---------- câmera ----------
  private updateCamera(dt: number) {
    this.time += dt
    const desiredTarget = this.position.clone().add(new THREE.Vector3(0, 1.5, 0))
    this.camTarget.lerp(desiredTarget, Math.min(1, dt * 12))

    this.camDist += (this.camDistTarget - this.camDist) * Math.min(1, dt * 8)

    const dir = new THREE.Vector3(
      Math.sin(this.camYaw) * Math.cos(this.camPitch),
      Math.sin(this.camPitch),
      Math.cos(this.camYaw) * Math.cos(this.camPitch),
    )

    // encurta a câmera se algo (prédio ou chão) estiver entre ela e o jogador
    let dist = this.camDist
    const steps = 14
    for (let i = 1; i <= steps; i++) {
      const d = (this.camDist * i) / steps
      const p = this.camTarget.clone().addScaledVector(dir, d)
      if (p.y < heightAt(p.x, p.z) + 0.4 || this.insideSolid(p)) {
        dist = Math.max(1.2, (this.camDist * (i - 1)) / steps)
        break
      }
    }

    this.camera.position.copy(this.camTarget).addScaledVector(dir, dist)
    const minY = heightAt(this.camera.position.x, this.camera.position.z) + 0.4
    if (this.camera.position.y < minY) this.camera.position.y = minY
    this.camera.lookAt(this.camTarget)

    // tremor: proporcional ao quadrado do trauma, suave (senos de frequências diferentes)
    if (this.trauma > 0) {
      const mag = this.trauma * this.trauma * 0.35
      const t = this.time
      this.camera.position.x += Math.sin(t * 47) * mag
      this.camera.position.y += Math.sin(t * 53 + 1) * mag
      this.camera.position.z += Math.sin(t * 59 + 2) * mag
      this.camera.rotation.z += Math.sin(t * 41 + 3) * mag * 0.08
      this.trauma = Math.max(0, this.trauma - dt * 1.6)
    }
  }

  private insideSolid(p: THREE.Vector3): boolean {
    for (const c of this.colliders.near(p.x, p.z, 1)) {
      if (c.type !== 'box' || p.y > c.top || p.y < c.bottom) continue
      const dx = p.x - c.x
      const dz = p.z - c.z
      const cos = Math.cos(c.rot)
      const sin = Math.sin(c.rot)
      if (Math.abs(dx * cos - dz * sin) < c.hw && Math.abs(dx * sin + dz * cos) < c.hd) return true
    }
    return false
  }
}
