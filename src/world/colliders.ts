// Colisão no plano XZ com altura: o jogador é um círculo; o mundo é feito de círculos e caixas rotacionadas,
// cada um com base e topo. Dá pra ficar em pé em cima (telhados baixos, máquinas) e agarrar a beirada.

export interface CircleCollider {
  type: 'circle'
  x: number
  z: number
  r: number
  bottom: number
  top: number
  id: number
}

export interface BoxCollider {
  type: 'box'
  x: number
  z: number
  hw: number
  hd: number
  rot: number
  bottom: number
  top: number
  id: number
}

export type Collider = CircleCollider | BoxCollider

const CELL = 8
const STEP = 0.4 // degrau que se sobe sem pular

// beirada encontrada pra agarrar
export interface Ledge {
  top: number
  // ponto da parede mais próximo do jogador e a normal (pra fora da parede)
  x: number
  z: number
  nx: number
  nz: number
  collider: Collider
}

export class Colliders {
  readonly list: Collider[] = []
  private grid = new Map<string, Collider[]>()
  private nextId = 1

  circle(x: number, z: number, r: number, top = 3, bottom = -1): Collider {
    const c: CircleCollider = { type: 'circle', x, z, r, top, bottom, id: this.nextId++ }
    this.insert(c, r)
    return c
  }

  box(x: number, z: number, w: number, d: number, rot = 0, top = 50, bottom = -1): Collider {
    const c: BoxCollider = { type: 'box', x, z, hw: w / 2, hd: d / 2, rot, top, bottom, id: this.nextId++ }
    this.insert(c, Math.hypot(w, d) / 2)
    return c
  }

  remove(c: Collider) {
    const i = this.list.indexOf(c)
    if (i >= 0) this.list.splice(i, 1)
    for (const cell of this.grid.values()) {
      const j = cell.indexOf(c)
      if (j >= 0) cell.splice(j, 1)
    }
  }

  private insert(c: Collider, radius: number) {
    this.list.push(c)
    for (let gx = Math.floor((c.x - radius) / CELL); gx <= Math.floor((c.x + radius) / CELL); gx++) {
      for (let gz = Math.floor((c.z - radius) / CELL); gz <= Math.floor((c.z + radius) / CELL); gz++) {
        const key = `${gx},${gz}`
        const cell = this.grid.get(key)
        if (cell) cell.push(c)
        else this.grid.set(key, [c])
      }
    }
  }

  // colisores perto de um ponto (sem repetir)
  near(x: number, z: number, radius: number): Collider[] {
    const out = new Set<Collider>()
    for (let gx = Math.floor((x - radius) / CELL); gx <= Math.floor((x + radius) / CELL); gx++) {
      for (let gz = Math.floor((z - radius) / CELL); gz <= Math.floor((z + radius) / CELL); gz++) {
        const cell = this.grid.get(`${gx},${gz}`)
        if (cell) for (const c of cell) out.add(c)
      }
    }
    return [...out]
  }

  // ponto no espaço local da caixa
  private local(c: BoxCollider, x: number, z: number) {
    const dx = x - c.x
    const dz = z - c.z
    const cos = Math.cos(c.rot)
    const sin = Math.sin(c.rot)
    return { lx: dx * cos - dz * sin, lz: dx * sin + dz * cos, cos, sin }
  }

  private inside(c: Collider, x: number, z: number, margin: number): boolean {
    if (c.type === 'circle') return Math.hypot(x - c.x, z - c.z) < c.r + margin
    const { lx, lz } = this.local(c, x, z)
    return Math.abs(lx) < c.hw + margin && Math.abs(lz) < c.hd + margin
  }

  // Se um ponto (com folga) cai dentro de algum colisor; usado pra espalhar decoração sem sobrepor
  blocked(x: number, z: number, margin: number): boolean {
    return this.near(x, z, margin + 1).some((c) => this.inside(c, x, z, margin))
  }

  // Topo mais alto em que dá pra pisar aqui, a partir da altura dos pés (sobe degraus pequenos)
  platformAt(x: number, z: number, feet: number, r = 0): number {
    let best = -Infinity
    for (const c of this.near(x, z, r + 1)) {
      if (c.top <= feet + STEP && c.top > best && this.inside(c, x, z, r * 0.5)) best = c.top
    }
    return best
  }

  // Empurra o círculo (x, z, r) pra fora de tudo que ele atravessa na altura do corpo
  resolve(p: { x: number; z: number }, r: number, feet = 0, height = 1.8) {
    const cands = this.near(p.x, p.z, r + 2).filter((c) => c.top > feet + STEP && c.bottom < feet + height)
    for (let iter = 0; iter < 3; iter++) {
      let moved = false
      for (const c of cands) {
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
          const { lx, lz, cos, sin } = this.local(c, p.x, p.z)
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
          p.x = c.x + nlx * cos + nlz * sin
          p.z = c.z - nlx * sin + nlz * cos
          moved = true
        }
      }
      if (!moved) break
    }
  }

  // Parede encostada no jogador (até `reach` além do raio), alta o bastante pra não ser só um degrau
  wallAt(x: number, z: number, r: number, feet: number, reach = 0.35): Ledge | null {
    let best: Ledge | null = null
    let bestD = Infinity
    for (const c of this.near(x, z, r + reach + 1)) {
      if (c.top <= feet + STEP || c.bottom > feet + 1.8) continue
      let px: number
      let pz: number
      let nx: number
      let nz: number
      if (c.type === 'circle') {
        const dx = x - c.x
        const dz = z - c.z
        const d = Math.hypot(dx, dz) || 1
        nx = dx / d
        nz = dz / d
        px = c.x + nx * c.r
        pz = c.z + nz * c.r
      } else {
        const { lx, lz, cos, sin } = this.local(c, x, z)
        const cx = Math.max(-c.hw, Math.min(c.hw, lx))
        const cz = Math.max(-c.hd, Math.min(c.hd, lz))
        let lnx = lx - cx
        let lnz = lz - cz
        const len = Math.hypot(lnx, lnz)
        if (len < 1e-6) continue
        lnx /= len
        lnz /= len
        px = c.x + cx * cos + cz * sin
        pz = c.z - cx * sin + cz * cos
        nx = lnx * cos + lnz * sin
        nz = -lnx * sin + lnz * cos
      }
      const d = Math.hypot(x - px, z - pz)
      if (d < r + reach && d < bestD) {
        bestD = d
        best = { top: c.top, x: px, z: pz, nx, nz, collider: c }
      }
    }
    return best
  }
}
