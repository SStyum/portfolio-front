import * as THREE from 'three'
import { profile, projects } from '../../content'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { NeonTube, SignSlot } from './buildings'
import { cityUniforms } from './materials'

const JP_FONT = '"Noto Sans JP", "Noto Sans CJK JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif'
const NEON = ['#ff3d7f', '#00e5ff', '#ffd23f', '#7cff6b', '#c77dff', '#ff8c42', '#ffffff', '#4d9bff']
const VERTICAL_WORDS = ['カラオケ', 'ラーメン', '居酒屋', '寿司', 'カフェ', 'ゲーム', '薬局', 'ホテル', '焼肉', '書店', '古着', '眼鏡', '時計', '美容室', '電器', '酒場', 'うどん', '珈琲', 'BAR', '24H']
const SHOP_WORDS = ['RAMEN 一蘭', 'SUSHI 寿司', 'COFFEE', 'KARAOKE', 'BOOKS 本', 'DRUG 薬', 'SALE 50%', 'CAMERA', 'SHOES 靴', 'GAME CENTER', 'IZAKAYA', 'UDON', 'TEA 茶', 'FASHION', 'MUSIC', 'ANIME', 'BAKERY', '100円', 'DONUTS', 'GYOZA']

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0')

// ---------- atlas: todos os letreiros num canvas só (uma textura, uma chamada de desenho) ----------
class Atlas {
  readonly canvas = document.createElement('canvas')
  readonly ctx: CanvasRenderingContext2D
  private x = 0
  private y = 0
  private rowH = 0
  constructor(readonly size = 2048) {
    this.canvas.width = this.canvas.height = size
    this.ctx = this.canvas.getContext('2d')!
    this.ctx.fillStyle = '#000'
    this.ctx.fillRect(0, 0, size, size)
  }
  // reserva um retângulo e devolve a região em UV
  alloc(w: number, h: number): { px: number; py: number; uv: [number, number, number, number] } {
    if (this.x + w > this.size) {
      this.x = 0
      this.y += this.rowH + 2
      this.rowH = 0
    }
    const px = this.x
    const py = this.y
    this.x += w + 2
    this.rowH = Math.max(this.rowH, h)
    const s = this.size
    return { px, py, uv: [px / s, 1 - (py + h) / s, (px + w) / s, 1 - py / s] }
  }
}

type Design = [number, number, number, number]

function drawVertical(atlas: Atlas, word: string, color: string, light: boolean): Design {
  const W = 64
  const H = 320
  const { px, py, uv } = atlas.alloc(W, H)
  const c = atlas.ctx
  c.save()
  c.translate(px, py)
  c.fillStyle = light ? '#f4f1ea' : '#121218'
  c.fillRect(0, 0, W, H)
  c.strokeStyle = color
  c.lineWidth = 4
  c.strokeRect(3, 3, W - 6, H - 6)
  const chars = [...word]
  const step = Math.min(56, (H - 20) / chars.length)
  c.font = `900 ${Math.floor(step * 0.82)}px ${JP_FONT}`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillStyle = light ? color : color
  c.shadowColor = color
  c.shadowBlur = light ? 0 : 10
  chars.forEach((ch, i) => c.fillText(ch, W / 2, 10 + step * (i + 0.5) + (H - 20 - step * chars.length) / 2))
  c.restore()
  return uv
}

function drawShop(atlas: Atlas, text: string, color: string, style: number): Design {
  const W = 384
  const H = 64
  const { px, py, uv } = atlas.alloc(W, H)
  const c = atlas.ctx
  c.save()
  c.translate(px, py)
  // 0: fundo colorido com texto branco · 1: fundo escuro com neon · 2: fundo branco
  c.fillStyle = style === 0 ? color : style === 1 ? '#111116' : '#f3f1ec'
  c.fillRect(0, 0, W, H)
  c.font = `900 40px ${JP_FONT}`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillStyle = style === 0 ? '#ffffff' : color
  if (style === 1) {
    c.shadowColor = color
    c.shadowBlur = 12
  }
  c.fillText(text, W / 2, H / 2 + 2, W - 24)
  c.restore()
  return uv
}

function drawSector(atlas: Atlas, title: string, sub: string | undefined, color: string, vertical: boolean): Design {
  const W = vertical ? 128 : 768
  const H = vertical ? 640 : 160
  const { px, py, uv } = atlas.alloc(W, H)
  const c = atlas.ctx
  c.save()
  c.translate(px, py)
  c.fillStyle = '#0d0d12'
  c.fillRect(0, 0, W, H)
  c.strokeStyle = color
  c.lineWidth = 8
  c.shadowColor = color
  c.shadowBlur = 16
  c.strokeRect(8, 8, W - 16, H - 16)
  c.fillStyle = color
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  if (vertical) {
    const chars = [...title]
    const step = Math.min(84, (H - 40) / chars.length)
    c.font = `900 ${Math.floor(step * 0.8)}px ${JP_FONT}`
    chars.forEach((ch, i) => c.fillText(ch, W / 2, 20 + step * (i + 0.5) + (H - 40 - step * chars.length) / 2))
  } else {
    c.font = `900 ${sub ? 70 : 84}px ${JP_FONT}`
    c.fillText(title, W / 2, sub ? 64 : H / 2, W - 40)
    if (sub) {
      c.shadowBlur = 0
      c.fillStyle = '#f4ecdc'
      c.font = `600 34px ${JP_FONT}`
      c.fillText(sub, W / 2, 124, W - 40)
    }
  }
  c.restore()
  return uv
}

export interface CitySigns {
  group: THREE.Group
  update(dt: number, t: number, night: number): void
}

export function createSigns(slots: SignSlot[], rand: () => number): CitySigns {
  const group = new THREE.Group()
  const atlas = new Atlas(2048)

  // repertório de designs reaproveitados entre placas comuns
  const verticals = Array.from({ length: 36 }, (_, i) =>
    drawVertical(atlas, VERTICAL_WORDS[i % VERTICAL_WORDS.length], NEON[i % NEON.length], i % 5 === 4),
  )
  const shops = Array.from({ length: 40 }, (_, i) => drawShop(atlas, SHOP_WORDS[i % SHOP_WORDS.length], NEON[(i * 3) % NEON.length], i % 3))

  const pos: number[] = []
  const uvs: number[] = []
  const nor: number[] = []
  const quad = (cx: number, cy: number, cz: number, yaw: number, w: number, h: number, uv: Design) => {
    const ax = Math.cos(yaw)
    const az = -Math.sin(yaw)
    const nx = Math.sin(yaw)
    const nz = Math.cos(yaw)
    const p = (sx: number, sy: number) => [cx + ax * sx * w * 0.5, cy + sy * h * 0.5, cz + az * sx * w * 0.5]
    const [u0, v0, u1, v1] = uv
    const verts = [
      [p(-1, -1), [u0, v0]],
      [p(1, -1), [u1, v0]],
      [p(1, 1), [u1, v1]],
      [p(-1, -1), [u0, v0]],
      [p(1, 1), [u1, v1]],
      [p(-1, 1), [u0, v1]],
    ] as const
    for (const [pp, uu] of verts) {
      pos.push(...pp)
      uvs.push(...uu)
      nor.push(nx, 0, nz)
    }
  }

  const screens: SignSlot[] = []
  for (const s of slots) {
    if (s.kind === 'screen') {
      screens.push(s)
      continue
    }
    if (s.kind === 'vertical') {
      const uv = s.text ? drawSector(atlas, s.text, undefined, hex(s.color ?? 0xffffff), true) : verticals[Math.floor(rand() * verticals.length)]
      // placa vertical sai perpendicular à fachada: legível dos dois lados da rua
      // (cada face 2 cm pro seu lado, pra não brigar no mesmo plano)
      const ox = Math.cos(s.yaw) * 0.02
      const oz = -Math.sin(s.yaw) * 0.02
      quad(s.x + ox, s.y, s.z + oz, s.yaw + Math.PI / 2, s.w, s.h, uv)
      quad(s.x - ox, s.y, s.z - oz, s.yaw - Math.PI / 2, s.w, s.h, uv)
    } else if (s.kind === 'shop') {
      const uv = s.text ? drawShop(atlas, s.text, hex(s.color ?? 0xffffff), 1) : shops[Math.floor(rand() * shops.length)]
      quad(s.x + Math.sin(s.yaw) * 0.04, s.y, s.z + Math.cos(s.yaw) * 0.04, s.yaw, s.w, s.h, uv)
    } else {
      const vertical = s.h > s.w
      const uv = drawSector(atlas, s.text ?? '', vertical ? undefined : s.sub, hex(s.color ?? 0xffffff), vertical)
      quad(s.x + Math.sin(s.yaw) * 0.08, s.y, s.z + Math.cos(s.yaw) * 0.08, s.yaw, s.w, s.h, uv)
    }
  }

  const tex = new THREE.CanvasTexture(atlas.canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: 0xffffff,
    emissiveIntensity: 0.6,
    roughness: 0.45,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  })
  group.add(new THREE.Mesh(geo, mat))

  // ---------- telões animados ----------
  const screenViews = screens.map((s) => {
    const canvas = document.createElement('canvas')
    canvas.width = 768
    canvas.height = 432
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    const m = new THREE.MeshBasicMaterial({ map: t, toneMapped: true })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), m)
    mesh.position.set(s.x + Math.sin(s.yaw) * 0.12, s.y, s.z + Math.cos(s.yaw) * 0.12)
    mesh.rotation.y = s.yaw
    group.add(mesh)
    // moldura
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(s.w + 0.6, s.h + 0.6, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.4, metalness: 0.6 }),
    )
    frame.position.set(s.x - Math.sin(s.yaw) * 0.05, s.y, s.z - Math.cos(s.yaw) * 0.05)
    frame.rotation.y = s.yaw
    group.add(frame)
    return { canvas, tex: t, mat: m }
  })

  let acc = 0
  return {
    group,
    update(dt, t, night) {
      mat.emissiveIntensity = 0.35 + night * 0.85
      cityUniforms.uTime.value = t
      acc += dt
      if (acc < 1 / 15) return // telão a 15 quadros por segundo basta
      acc = 0
      for (const v of screenViews) {
        drawScreen(v.canvas, t)
        v.tex.needsUpdate = true
        v.mat.color.setScalar(0.85 + night * 0.15)
      }
    },
  }
}

// conteúdo do telão: slides do portfólio com fundo animado
function drawScreen(canvas: HTMLCanvasElement, t: number) {
  const c = canvas.getContext('2d')!
  const W = canvas.width
  const H = canvas.height
  const slide = Math.floor(t / 5) % 4
  const k = (t % 5) / 5
  const hue = (t * 12) % 360
  const g = c.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, `hsl(${hue}, 80%, 18%)`)
  g.addColorStop(1, `hsl(${(hue + 80) % 360}, 85%, 30%)`)
  c.fillStyle = g
  c.fillRect(0, 0, W, H)
  // bolhas de luz andando
  for (let i = 0; i < 5; i++) {
    const x = (W * (i / 5 + t * 0.03 * (i + 1))) % (W + 200) - 100
    const y = H * (0.3 + 0.4 * Math.sin(t * 0.7 + i))
    const rg = c.createRadialGradient(x, y, 0, x, y, 160)
    rg.addColorStop(0, `hsla(${(hue + i * 60) % 360}, 100%, 65%, 0.45)`)
    rg.addColorStop(1, 'transparent')
    c.fillStyle = rg
    c.fillRect(0, 0, W, H)
  }
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillStyle = '#fff'
  const enter = Math.min(1, k * 4)
  c.globalAlpha = enter * Math.min(1, (1 - k) * 6)
  if (slide === 0) {
    c.font = `900 84px ${JP_FONT}`
    c.fillText(profile.name.toUpperCase(), W / 2, H / 2 - 30 + (1 - enter) * 30)
    c.font = `600 36px ${JP_FONT}`
    c.fillText(profile.role, W / 2, H / 2 + 50)
  } else if (slide === 1) {
    c.font = `900 110px ${JP_FONT}`
    c.fillText('ようこそ', W / 2, H / 2 - 40)
    c.font = `700 40px ${JP_FONT}`
    c.fillText('BEM-VINDO A SHIBUYA', W / 2, H / 2 + 70)
  } else if (slide === 2) {
    c.font = `800 34px ${JP_FONT}`
    c.fillText('PROJETOS', W / 2, 60)
    projects.slice(0, 5).forEach((p, i) => {
      c.font = `700 ${i === 0 ? 46 : 36}px ${JP_FONT}`
      c.fillText(p.name, W / 2 + (1 - enter) * (i % 2 ? 80 : -80), 130 + i * 60)
    })
  } else {
    c.font = `800 34px ${JP_FONT}`
    c.fillText('OBSERVABILIDADE AO VIVO', W / 2, 60)
    c.strokeStyle = '#7cf5ff'
    c.lineWidth = 6
    c.beginPath()
    for (let x = 0; x <= W - 120; x += 8) {
      const y = H * 0.6 - Math.sin(x * 0.02 + t * 3) * 40 - Math.sin(x * 0.051 + t) * 25
      if (x === 0) c.moveTo(60 + x, y)
      else c.lineTo(60 + x, y)
    }
    c.stroke()
  }
  c.globalAlpha = 1
}

// ---------- feixe de luz dos setores ----------
export function createBeam(color: number): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(0.7, 1.1, 70, 20, 1, true)
  geo.translate(0, 35, 0)
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vFacing;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vFacing = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;
      varying float vFacing;
      void main() {
        float fade = pow(1.0 - vUv.y, 1.6);
        float pulse = 0.75 + 0.25 * sin(uTime * 2.0 - vUv.y * 12.0);
        float a = fade * pulse * pow(vFacing, 1.5) * 0.55 * uOpacity;
        gl_FragColor = vec4(uColor * 1.4, a);
      }
    `,
  })
  const m = new THREE.Mesh(geo, mat)
  m.renderOrder = 10
  m.frustumCulled = false
  return m
}

// ---------- placas de orientação (azuis, como as de Tóquio) ----------
export interface SignArm {
  label: string
  detail?: string
  yaw: number // direção no mundo pra onde a seta aponta (0 = +z)
  color: number
}

const guideBoard = new THREE.MeshStandardMaterial({ color: 0x1f4fa0, roughness: 0.5, metalness: 0.2 })
const guidePole = new THREE.MeshStandardMaterial({ color: 0x8b9096, roughness: 0.4, metalness: 0.7 })

// textos de todas as setas de uma placa num canvas só (uma faixa por seta)
function armsTexture(arms: SignArm[]): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 96 * arms.length
  const ctx = canvas.getContext('2d')!
  arms.forEach((arm, i) => {
    const y0 = i * 96
    ctx.fillStyle = hex(arm.color)
    ctx.fillRect(22, y0 + 30, 36, 36)
    ctx.fillStyle = '#ffffff'
    ctx.font = `800 42px ${JP_FONT}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(arm.label, 74, y0 + 50, arm.detail ? 320 : 420)
    if (arm.detail) {
      ctx.font = `600 32px ${JP_FONT}`
      ctx.textAlign = 'right'
      ctx.fillText(arm.detail, 496, y0 + 52)
    }
  })
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

// Placa de orientação: poste, setas e textos viram 3 malhas (em vez de 3 por seta)
export function createGuidePost(arms: SignArm[]): THREE.Group {
  const g = new THREE.Group()
  const height = 3.2 + arms.length * 0.12
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, height, 8).translate(0, height / 2, 0), guidePole)
  post.castShadow = true
  g.add(post)

  const shape = new THREE.Shape()
  shape.moveTo(0, -0.2)
  shape.lineTo(1.8, -0.2)
  shape.lineTo(2.08, 0)
  shape.lineTo(1.8, 0.2)
  shape.lineTo(0, 0.2)
  shape.closePath()
  const plank = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false })
  plank.translate(0.06, 0, -0.025)

  const boards: THREE.BufferGeometry[] = []
  const texts: THREE.BufferGeometry[] = []
  const n = arms.length
  arms.forEach((arm, i) => {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(0, height - 0.3 - i * 0.47, 0),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), arm.yaw - Math.PI / 2),
      new THREE.Vector3(1, 1, 1),
    )
    boards.push(plank.clone().applyMatrix4(m))
    // frente e verso, cada um apontando pra sua faixa do canvas
    for (const side of [1, -1]) {
      const q = new THREE.PlaneGeometry(1.74, 0.33)
      if (side < 0) q.rotateY(Math.PI)
      q.translate(0.97, 0, 0.027 * side)
      const uv = q.attributes.uv as THREE.BufferAttribute
      for (let k = 0; k < uv.count; k++) uv.setY(k, (n - 1 - i + uv.getY(k)) / n)
      texts.push(q.applyMatrix4(m))
    }
  })
  const boardMesh = new THREE.Mesh(mergeGeometries(boards), guideBoard)
  boardMesh.castShadow = true
  g.add(boardMesh)
  g.add(new THREE.Mesh(mergeGeometries(texts), new THREE.MeshStandardMaterial({ map: armsTexture(arms), transparent: true, roughness: 0.6 })))
  return g
}

// quadro de informações (o "Como jogar")
export function createInfoBoard(title: string, sub: string): THREE.Group {
  const g = new THREE.Group()
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 320
  const c = canvas.getContext('2d')!
  c.fillStyle = '#1f4fa0'
  c.fillRect(0, 0, 512, 320)
  c.fillStyle = '#fff'
  c.beginPath()
  c.arc(256, 96, 52, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#1f4fa0'
  c.font = `900 72px ${JP_FONT}`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText('i', 256, 100)
  c.fillStyle = '#fff'
  c.font = `800 52px ${JP_FONT}`
  c.fillText(title, 256, 212)
  c.font = `500 30px ${JP_FONT}`
  c.fillText(sub, 256, 270)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1, 0.08),
    [guidePole, guidePole, guidePole, guidePole, new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.25 }), guidePole],
  )
  panel.position.y = 1.6
  panel.castShadow = true
  g.add(panel)
  for (const sx of [-0.7, 0.7]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), guidePole)
    leg.position.set(sx, 0.6, 0)
    g.add(leg)
  }
  return g
}

// ---------- tubos de neon (contornos) ----------
// cada cor vira uma malha só; brilham mais à noite e "respiram" de leve
export function createNeonTubes(tubes: NeonTube[]) {
  const group = new THREE.Group()
  const byColor = new Map<number, THREE.BufferGeometry[]>()
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  for (const t of tubes) {
    a.set(...t.a)
    b.set(...t.b)
    const len = a.distanceTo(b)
    const g = new THREE.CylinderGeometry(0.045, 0.045, len, 6)
    // cilindro em y → alinha com o segmento a–b
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()))
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
    byColor.set(t.color, [...(byColor.get(t.color) ?? []), g])
  }
  const mats: { mat: THREE.MeshBasicMaterial; base: THREE.Color; phase: number }[] = []
  let k = 0
  for (const [color, geos] of byColor) {
    const mat = new THREE.MeshBasicMaterial({ color })
    group.add(new THREE.Mesh(mergeGeometries(geos), mat))
    mats.push({ mat, base: new THREE.Color(color), phase: k++ * 1.7 })
  }
  return {
    group,
    update(t: number, night: number) {
      for (const m of mats) {
        // HDR: acima de 1 pra estourar no bloom à noite
        const pulse = 1 + Math.sin(t * 2.2 + m.phase) * 0.06
        m.mat.color.copy(m.base).multiplyScalar((0.9 + night * 1.2) * pulse)
      }
    },
  }
}
