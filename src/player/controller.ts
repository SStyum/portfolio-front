import * as THREE from 'three'
import type { Input } from '../input'
import type { Colliders } from '../world/colliders'
import { POND, WALK_RADIUS } from '../world/layout'
import { heightAt } from '../world/terrain'
import { Character } from './character'

const WALK = 5
const RUN = 9.5
const JUMP = 8.5
const GRAVITY = 24
const RADIUS = 0.4
const MAX_SLOPE = 1.25 // subida máxima (≈51°): mais que isso é paredão de montanha
const AIR_HOP = 6.5 // impulso pra cima no começo do golpe aéreo
const DIVE_SPEED = 30 // mergulho do golpe aéreo

// Movimento em terceira pessoa relativo à câmera + câmera orbital com colisão simples
export class PlayerController {
  readonly character = new Character()
  readonly position = new THREE.Vector3()
  private velocity = new THREE.Vector3()
  private velY = 0
  private onGround = true
  private facing = 0

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

  teleport(x: number, z: number, facing: number) {
    this.position.set(x, heightAt(x, z), z)
    this.velocity.set(0, 0, 0)
    this.velY = 0
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

    // ---- movimento relativo à câmera ----
    const axis = input.axis()
    const fwd = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw))
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x)
    const wish = fwd.multiplyScalar(axis.y).add(right.multiplyScalar(axis.x))

    const inWater = heightAt(this.position.x, this.position.z) < POND.water - 0.4
    const air = this.character.airPhase
    let maxSpeed = input.sprint ? RUN : WALK
    if (inWater) maxSpeed *= 0.55
    if (this.character.attacking) maxSpeed *= 0.35 // golpeando: anda devagar
    if (air === 'slam') maxSpeed = 0 // preso no impacto
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

    const prevX = this.position.x
    const prevZ = this.position.z
    this.position.x += this.velocity.x * dt
    this.position.z += this.velocity.z * dt

    // colisão com construções/árvores
    this.colliders.resolve(this.position, RADIUS)

    // ladeira íngreme demais não dá pra subir: tenta escorregar por um eixo só, senão volta
    if (this.onGround) {
      const h0 = heightAt(prevX, prevZ)
      const tooSteep = (x: number, z: number) => {
        const d = Math.hypot(x - prevX, z - prevZ)
        return d > 1e-4 && (heightAt(x, z) - h0) / d > MAX_SLOPE
      }
      if (tooSteep(this.position.x, this.position.z)) {
        if (!tooSteep(this.position.x, prevZ)) {
          this.position.z = prevZ
          this.velocity.z = 0
        } else if (!tooSteep(prevX, this.position.z)) {
          this.position.x = prevX
          this.velocity.x = 0
        } else {
          this.position.x = prevX
          this.position.z = prevZ
          this.velocity.x = this.velocity.z = 0
        }
      }
    }
    else if (
      (heightAt(this.position.x, this.position.z) - heightAt(prevX, prevZ)) /
        Math.max(1e-4, Math.hypot(this.position.x - prevX, this.position.z - prevZ)) >
      MAX_SLOPE
    ) {
      // no ar também não sobe paredão (senão dava pra escalar montanha pulando)
      this.position.x = prevX
      this.position.z = prevZ
      this.velocity.x = this.velocity.z = 0
    }
    const r = Math.hypot(this.position.x, this.position.z)
    if (r > WALK_RADIUS) {
      this.position.x *= WALK_RADIUS / r
      this.position.z *= WALK_RADIUS / r
    }

    // ---- pulo, golpes e gravidade ----
    const ground = heightAt(this.position.x, this.position.z)
    if (this.onGround && !air && input.gameplay && input.consume('Space')) {
      this.velY = JUMP
      this.onGround = false
    }
    if (input.gameplay && (input.consume('KeyF') || input.consume('Attack'))) {
      // no ar e com altura: Helm Breaker; no chão: combo
      if (!this.onGround && this.position.y - ground > 0.9 && this.character.airAttack()) this.velY = AIR_HOP
      else this.character.attack()
    }
    if (air === 'dive') this.velY = -DIVE_SPEED
    else this.velY -= GRAVITY * (air === 'rise' ? 0.35 : 1) * dt
    this.position.y += this.velY * dt
    if (this.position.y <= ground) {
      this.position.y = ground
      this.velY = 0
      this.onGround = true
      if (air === 'rise' || air === 'dive') {
        this.character.root.position.copy(this.position)
        this.character.land()
      }
    } else if (this.onGround && this.position.y - ground < 0.6 && this.velY <= 0) {
      // descendo ladeira: gruda no chão
      this.position.y = ground
      this.velY = 0
    } else {
      this.onGround = false
    }

    // ---- personagem ----
    if (this.speed > 0.3) {
      const want = Math.atan2(this.velocity.x, this.velocity.z)
      let diff = want - this.facing
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      this.facing += diff * Math.min(1, dt * 12)
    }
    this.character.root.position.copy(this.position)
    this.character.root.rotation.y = this.facing
    this.character.update(dt, this.speed, !this.onGround, t)

    const blob = this.character.blobShadow
    blob.position.y = ground - this.position.y + 0.04
    const s = Math.max(0.4, 1 - (this.position.y - ground) * 0.15)
    blob.scale.setScalar(s)

    this.updateCamera(dt)
  }

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

    // encurta a câmera se algo (construção ou chão) estiver entre ela e o jogador
    let dist = this.camDist
    const steps = 14
    for (let i = 1; i <= steps; i++) {
      const d = (this.camDist * i) / steps
      const p = this.camTarget.clone().addScaledVector(dir, d)
      if (p.y < heightAt(p.x, p.z) + 0.4 || this.insideBuilding(p)) {
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

  private insideBuilding(p: THREE.Vector3): boolean {
    for (const c of this.colliders.list) {
      if (c.type !== 'box') continue
      // construções têm até ~8m acima do chão
      if (p.y - heightAt(c.x, c.z) > 8) continue
      const dx = p.x - c.x
      const dz = p.z - c.z
      const cos = Math.cos(c.rot)
      const sin = Math.sin(c.rot)
      if (Math.abs(dx * cos - dz * sin) < c.hw && Math.abs(dx * sin + dz * cos) < c.hd) return true
    }
    return false
  }
}
