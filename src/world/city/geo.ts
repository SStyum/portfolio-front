import * as THREE from 'three'

type V3 = [number, number, number]

// Acumula quads (com UV em metros e atributos por prédio) e gera uma geometria só: uma chamada de desenho por material.
export class GeoBuilder {
  private pos: number[] = []
  private nor: number[] = []
  private uv: number[] = []
  private seed: number[] = []
  private style: number[] = []
  private color: number[] = []
  // atributos aplicados aos próximos quads
  curSeed = 0
  curStyle: V3 = [3, 3.5, 0]
  curColor: V3 = [1, 1, 1]

  get empty() {
    return this.pos.length === 0
  }

  // quad a-b-c-d no sentido anti-horário visto de fora; uv em metros
  quad(a: V3, b: V3, c: V3, d: V3, ua: [number, number], ub: [number, number], uc: [number, number], ud: [number, number]) {
    // normal do triângulo a-b-c (funciona também pro quad degenerado das tampas de cilindro)
    const n = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
      .cross(new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]))
      .normalize()
    for (const [p, u] of [
      [a, ua],
      [b, ub],
      [c, uc],
      [a, ua],
      [c, uc],
      [d, ud],
    ] as const) {
      this.pos.push(...p)
      this.nor.push(n.x, n.y, n.z)
      this.uv.push(...u)
      this.seed.push(this.curSeed)
      this.style.push(...this.curStyle)
      this.color.push(...this.curColor)
    }
  }

  // 4 paredes de uma caixa rotacionada (base y0, altura h). UV: u = metros ao longo da parede, v = metros de altura
  walls(x: number, z: number, w: number, d: number, rot: number, y0: number, h: number) {
    const cos = Math.cos(rot)
    const sin = Math.sin(rot)
    const P = (lx: number, lz: number, y: number): V3 => [x + lx * cos + lz * sin, y, z - lx * sin + lz * cos]
    const hw = w / 2
    const hd = d / 2
    const corners: [number, number][] = [
      [-hw, hd],
      [hw, hd],
      [hw, -hd],
      [-hw, -hd],
    ]
    let u0 = 0
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i]
      const [bx, bz] = corners[(i + 1) % 4]
      const len = Math.hypot(bx - ax, bz - az)
      this.quad(P(ax, az, y0), P(bx, bz, y0), P(bx, bz, y0 + h), P(ax, az, y0 + h), [u0, y0 - y0], [u0 + len, 0], [u0 + len, h], [u0, h])
      u0 += len + 1.3 // desalinha as janelas entre faces
    }
  }

  // tampa horizontal de uma caixa (para cima)
  top(x: number, z: number, w: number, d: number, rot: number, y: number) {
    const cos = Math.cos(rot)
    const sin = Math.sin(rot)
    const P = (lx: number, lz: number): V3 => [x + lx * cos + lz * sin, y, z - lx * sin + lz * cos]
    const hw = w / 2
    const hd = d / 2
    const a = P(-hw, hd)
    const b = P(hw, hd)
    const c = P(hw, -hd)
    const dd = P(-hw, -hd)
    this.quad(a, b, c, dd, [a[0], -a[2]], [b[0], -b[2]], [c[0], -c[2]], [dd[0], -dd[2]])
  }

  // tampa virada pra baixo (teto de túnel, marquise)
  bottom(x: number, z: number, w: number, d: number, rot: number, y: number) {
    const cos = Math.cos(rot)
    const sin = Math.sin(rot)
    const P = (lx: number, lz: number): V3 => [x + lx * cos + lz * sin, y, z - lx * sin + lz * cos]
    const hw = w / 2
    const hd = d / 2
    const a = P(-hw, hd)
    const b = P(hw, hd)
    const c = P(hw, -hd)
    const dd = P(-hw, -hd)
    this.quad(a, dd, c, b, [a[0], -a[2]], [dd[0], -dd[2]], [c[0], -c[2]], [b[0], -b[2]])
  }

  // parede de cilindro (UV: u = metros ao redor, v = altura)
  cylinder(x: number, z: number, r: number, y0: number, h: number, segments = 32) {
    const circ = 2 * Math.PI * r
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2
      const a1 = ((i + 1) / segments) * Math.PI * 2
      const p = (a: number, y: number): V3 => [x + Math.sin(a) * r, y, z + Math.cos(a) * r]
      const u0 = (i / segments) * circ
      const u1 = ((i + 1) / segments) * circ
      this.quad(p(a0, y0), p(a1, y0), p(a1, y0 + h), p(a0, y0 + h), [u0, 0], [u1, 0], [u1, h], [u0, h])
    }
  }

  // tampa de cilindro
  disc(x: number, z: number, r: number, y: number, segments = 32) {
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2
      const a1 = ((i + 1) / segments) * Math.PI * 2
      const p = (a: number): V3 => [x + Math.sin(a) * r, y, z + Math.cos(a) * r]
      const c: V3 = [x, y, z]
      const pa = p(a0)
      const pb = p(a1)
      // triângulo como quad degenerado
      this.quad(c, pa, pb, c, [x, -z], [pa[0], -pa[2]], [pb[0], -pb[2]], [x, -z])
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(this.seed, 1))
    g.setAttribute('aStyle', new THREE.Float32BufferAttribute(this.style, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.color, 3))
    g.computeBoundingSphere()
    return g
  }
}
