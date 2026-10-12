// Colisão 2D no plano XZ: o jogador é um círculo, o mundo é feito de círculos e caixas rotacionadas.

export interface CircleCollider {
  type: 'circle'
  x: number
  z: number
  r: number
}

export interface BoxCollider {
  type: 'box'
  x: number
  z: number
  hw: number
  hd: number
  rot: number
}

export type Collider = CircleCollider | BoxCollider

export class Colliders {
  readonly list: Collider[] = []

  circle(x: number, z: number, r: number) {
    this.list.push({ type: 'circle', x, z, r })
  }

  box(x: number, z: number, w: number, d: number, rot = 0) {
    this.list.push({ type: 'box', x, z, hw: w / 2, hd: d / 2, rot })
  }

  // Se um ponto (com folga) cai dentro de algum colisor; usado pra espalhar decoração sem sobrepor
  blocked(x: number, z: number, margin: number): boolean {
    for (const c of this.list) {
      if (c.type === 'circle') {
        if (Math.hypot(x - c.x, z - c.z) < c.r + margin) return true
      } else {
        const dx = x - c.x
        const dz = z - c.z
        const cos = Math.cos(c.rot)
        const sin = Math.sin(c.rot)
        const lx = dx * cos - dz * sin
        const lz = dx * sin + dz * cos
        if (Math.abs(lx) < c.hw + margin && Math.abs(lz) < c.hd + margin) return true
      }
    }
    return false
  }

  // Empurra o círculo (x, z, r) pra fora de tudo que ele atravessa
  resolve(p: { x: number; z: number }, r: number) {
    for (let iter = 0; iter < 3; iter++) {
      let moved = false
      for (const c of this.list) {
        if (c.type === 'circle') {
          const dx = p.x - c.x
          const dz = p.z - c.z
          const dist = Math.hypot(dx, dz)
          const min = c.r + r
          if (dist < min && dist > 1e-6) {
            p.x = c.x + (dx / dist) * min
            p.z = c.z + (dz / dist) * min
            moved = true
          }
        } else {
          // leva o ponto pro espaço local da caixa (rotação inversa)
          const dx = p.x - c.x
          const dz = p.z - c.z
          const cos = Math.cos(c.rot)
          const sin = Math.sin(c.rot)
          const lx = dx * cos - dz * sin
          const lz = dx * sin + dz * cos

          const cx = Math.max(-c.hw, Math.min(c.hw, lx))
          const cz = Math.max(-c.hd, Math.min(c.hd, lz))
          let ox = lx - cx
          let oz = lz - cz
          const dist = Math.hypot(ox, oz)
          let nlx = lx
          let nlz = lz

          if (dist === 0) {
            // centro dentro da caixa: sai pelo lado mais próximo
            const px = c.hw - Math.abs(lx)
            const pz = c.hd - Math.abs(lz)
            if (px < pz) nlx = Math.sign(lx || 1) * (c.hw + r)
            else nlz = Math.sign(lz || 1) * (c.hd + r)
          } else if (dist < r) {
            ox /= dist
            oz /= dist
            nlx = cx + ox * r
            nlz = cz + oz * r
          } else {
            continue
          }

          // volta pro mundo
          p.x = c.x + nlx * cos + nlz * sin
          p.z = c.z - nlx * sin + nlz * cos
          moved = true
        }
      }
      if (!moved) break
    }
  }
}
