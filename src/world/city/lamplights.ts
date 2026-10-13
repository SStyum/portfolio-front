import * as THREE from 'three'

// Luz de verdade nos postes: um número fixo de luzes que vão sempre pros postes mais perto do jogador.
// (dezenas de luzes custariam caro; com um conjunto fixo o shader não recompila e o custo é constante)
export class LampLights {
  private lights: THREE.PointLight[] = []
  private timer = 0

  constructor(
    scene: THREE.Scene,
    private spots: THREE.Vector3[],
    count = 8,
  ) {
    for (let i = 0; i < count; i++) {
      const l = new THREE.PointLight(0xffd29a, 0, 18, 2)
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
      near.forEach((n, i) => this.lights[i].position.copy(n.p))
    }
    // some aos poucos com a distância, pra não "acender" de repente quando troca de poste
    for (const l of this.lights) {
      const d = Math.hypot(l.position.x - player.x, l.position.z - player.z)
      const fade = 1 - THREE.MathUtils.smoothstep(d, 22, 34)
      l.intensity = night * 55 * fade
    }
  }
}
