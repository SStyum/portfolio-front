import * as THREE from 'three'
import type { GroundMark } from '../player/character'
import { POND } from './layout'
import { heightAt } from './terrain'

const MAX_MARKS = 40
const LIFE = 45 // segundos até sumir
const FADE = 6 // segundos finais apagando

// Sulco desenhado num canvas: afinado nas pontas, borda de terra revirada e fundo escuro.
function gashTexture(): THREE.CanvasTexture {
  const w = 256
  const h = 64
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  const shape = (inset: number, color: string) => {
    const n = 24
    const top: [number, number][] = []
    const bottom: [number, number][] = []
    for (let i = 0; i <= n; i++) {
      const u = i / n
      const half = Math.pow(Math.sin(Math.PI * u), 0.7) * (h / 2 - inset) * (0.8 + Math.random() * 0.35)
      top.push([u * w, h / 2 - half])
      bottom.push([u * w, h / 2 + half * (0.8 + Math.random() * 0.35)])
    }
    ctx.beginPath()
    ctx.moveTo(top[0][0], top[0][1])
    for (const [x, y] of top) ctx.lineTo(x, y)
    for (const [x, y] of bottom.reverse()) ctx.lineTo(x, y)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
  }

  shape(2, 'rgba(122, 94, 62, 0.55)')
  shape(12, 'rgba(52, 35, 22, 0.9)')
  shape(22, 'rgba(26, 17, 10, 0.95)')

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

interface Mark {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  age: number
  strength: number
}

// Marcas que a espada deixa no chão: seguem o relevo do terreno e somem depois de um tempo.
export class GroundMarks {
  private marks: Mark[] = []
  private texture = gashTexture()

  constructor(private scene: THREE.Scene) {}

  add({ ax, az, bx, bz, width, strength }: GroundMark) {
    const cx = (ax + bx) / 2
    const cz = (az + bz) / 2
    if (heightAt(cx, cz) < POND.water + 0.05) return // dentro d'água não marca

    const len = Math.max(0.2, Math.hypot(bx - ax, bz - az))
    const dx = (bx - ax) / len
    const dz = (bz - az) / len

    // plano subdividido no comprimento, com cada vértice apoiado no terreno
    const geo = new THREE.PlaneGeometry(1, 1, 8, 1)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) * len
      const v = pos.getY(i) * width
      // (dz, -dx) é a perpendicular que mantém a face virada pra cima
      const x = cx + dx * u + dz * v
      const z = cz + dz * u - dx * v
      pos.setXYZ(i, x, heightAt(x, z) + 0.03, z)
    }
    geo.computeVertexNormals()
    geo.computeBoundingSphere()

    const mat = new THREE.MeshStandardMaterial({
      map: this.texture,
      transparent: true,
      opacity: strength,
      depthWrite: false,
      roughness: 1,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.receiveShadow = true
    this.scene.add(mesh)
    this.marks.push({ mesh, age: 0, strength })

    while (this.marks.length > MAX_MARKS) this.remove(this.marks[0])
  }

  update(dt: number) {
    for (const m of [...this.marks]) {
      m.age += dt
      if (m.age >= LIFE) this.remove(m)
      else m.mesh.material.opacity = m.strength * Math.min(1, (LIFE - m.age) / FADE)
    }
  }

  private remove(m: Mark) {
    this.scene.remove(m.mesh)
    m.mesh.geometry.dispose()
    m.mesh.material.dispose()
    this.marks.splice(this.marks.indexOf(m), 1)
  }
}
