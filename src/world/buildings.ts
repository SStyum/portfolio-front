import * as THREE from 'three'

// Materiais compartilhados entre todas as construções
const mats = {
  wall: new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.9 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.85 }),
  woodDark: new THREE.MeshStandardMaterial({ color: 0x3f2a1b, roughness: 0.9 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x3c4a5c, roughness: 0.7, flatShading: true }),
  roofTrim: new THREE.MeshStandardMaterial({ color: 0x2a3340, roughness: 0.7 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 1, flatShading: true }),
  paper: new THREE.MeshStandardMaterial({ color: 0xfff1cf, emissive: 0xffc96b, emissiveIntensity: 0.45, roughness: 1 }),
  door: new THREE.MeshStandardMaterial({ color: 0x24170e, roughness: 1 }),
}

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

// Telhado de duas águas com cumeeira ao longo de X (largura w, profundidade d)
function gableRoof(w: number, d: number, rise: number, overhang: number, mat = mats.roof): THREE.Group {
  const g = new THREE.Group()

  // empena (triângulo de parede embaixo do telhado)
  const shape = new THREE.Shape()
  shape.moveTo(-d / 2, 0)
  shape.lineTo(d / 2, 0)
  shape.lineTo(0, rise)
  shape.closePath()
  const gableGeo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false })
  gableGeo.translate(0, 0, -w / 2)
  gableGeo.rotateY(Math.PI / 2)
  g.add(mesh(gableGeo, mats.wall))

  // duas águas
  const half = d / 2 + overhang
  const angle = Math.atan2(rise, d / 2)
  const len = half / Math.cos(angle)
  const thick = 0.3
  for (const side of [1, -1]) {
    const plank = mesh(box(w + overhang * 2, thick, len), mat)
    plank.rotation.x = side * angle
    const midZ = (half / 2) * side
    const midY = rise - (half / 2) * Math.tan(angle) + thick / 2
    plank.position.set(0, midY, midZ)
    g.add(plank)
  }

  // cumeeira
  g.add(mesh(box(w + overhang * 2 + 0.2, 0.35, 0.5), mats.roofTrim, 0, rise + 0.3, 0))
  return g
}

function windowPanel(w: number, h: number): THREE.Group {
  const g = new THREE.Group()
  g.add(mesh(box(w, h, 0.08), mats.paper))
  // treliça
  const bars = Math.max(2, Math.round(w / 0.45))
  for (let i = 1; i < bars; i++) {
    g.add(mesh(box(0.05, h, 0.12), mats.woodDark, -w / 2 + (w / bars) * i, 0, 0))
  }
  g.add(mesh(box(w, 0.05, 0.12), mats.woodDark, 0, 0, 0))
  g.add(mesh(box(w + 0.15, 0.12, 0.14), mats.woodDark, 0, h / 2, 0))
  g.add(mesh(box(w + 0.15, 0.12, 0.14), mats.woodDark, 0, -h / 2, 0))
  return g
}

// Placa de madeira com texto desenhado num canvas
export function signBoard(text: string, accent: number, width = 3.2): THREE.Mesh {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#4a3220'
  ctx.fillRect(0, 0, 512, 128)
  ctx.strokeStyle = '#' + accent.toString(16).padStart(6, '0')
  ctx.lineWidth = 10
  ctx.strokeRect(8, 8, 496, 112)
  ctx.fillStyle = '#f7ecd6'
  ctx.font = '700 58px Cinzel, Georgia, serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 256, 68, 470)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 })
  const m = new THREE.Mesh(new THREE.BoxGeometry(width, width / 4, 0.12), [mats.woodDark, mats.woodDark, mats.woodDark, mats.woodDark, mat, mats.woodDark])
  m.castShadow = true
  return m
}

function noren(color: number): THREE.Group {
  // cortina curta de tecido sobre a porta, em 3 tiras
  const g = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide })
  for (let i = -1; i <= 1; i++) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.8), mat)
    strip.position.set(i * 0.58, 0, 0)
    g.add(strip)
  }
  return g
}

interface HouseOpts {
  w: number
  d: number
  h?: number
  accent?: number
  label?: string
  stories?: 1 | 2
}

// Casa: base de pedra, paredes claras com pilares de madeira, janelas de papel, telhado escuro.
// Origem no chão, porta virada pra +z.
export function createHouse({ w, d, h = 3.2, accent = 0xb5524a, label, stories = 1 }: HouseOpts): { group: THREE.Group; height: number } {
  const g = new THREE.Group()
  const base = 0.5

  g.add(mesh(box(w + 1, 1.6, d + 1), mats.stone, 0, base - 0.8, 0))
  // degrau na frente da porta
  g.add(mesh(box(2.4, 0.3, 0.9), mats.stone, 0, 0.15, d / 2 + 0.9))

  const body = new THREE.Group()
  body.position.y = base
  g.add(body)

  body.add(mesh(box(w, h, d), mats.wall, 0, h / 2, 0))

  // pilares nos cantos e viga no topo
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      body.add(mesh(box(0.35, h + 0.1, 0.35), mats.wood, (sx * w) / 2, h / 2, (sz * d) / 2))
    }
  }
  body.add(mesh(box(w + 0.3, 0.3, d + 0.3), mats.wood, 0, h, 0))
  body.add(mesh(box(w + 0.2, 0.25, d + 0.2), mats.wood, 0, 0.12, 0))

  // porta + cortina
  body.add(mesh(box(1.7, 2.3, 0.1), mats.door, 0, 1.15, d / 2 + 0.03))
  const n = noren(accent)
  n.position.set(0, 2.0, d / 2 + 0.12)
  body.add(n)

  // janelas: frente (dos lados da porta), laterais e fundos
  const winW = Math.min(1.8, w * 0.18)
  for (const sx of [-1, 1]) {
    const wf = windowPanel(winW, 1.1)
    wf.position.set(sx * (w * 0.3), 1.8, d / 2 + 0.04)
    body.add(wf)
    const ws = windowPanel(Math.min(2, d * 0.35), 1.1)
    ws.rotation.y = Math.PI / 2
    ws.position.set(sx * (w / 2 + 0.04), 1.8, 0)
    body.add(ws)
  }
  const wb = windowPanel(w * 0.4, 1.1)
  wb.position.set(0, 1.8, -d / 2 - 0.04)
  body.add(wb)

  let top = h
  if (stories === 2) {
    // beiral do primeiro andar
    const eave = mesh(box(w + 2, 0.25, d + 2), mats.roof, 0, h + 0.15, 0)
    body.add(eave)
    const h2 = h * 0.8
    const w2 = w * 0.72
    const d2 = d * 0.7
    body.add(mesh(box(w2, h2, d2), mats.wall, 0, h + h2 / 2, 0))
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) body.add(mesh(box(0.3, h2, 0.3), mats.wood, (sx * w2) / 2, h + h2 / 2, (sz * d2) / 2))
      const wu = windowPanel(1.4, 0.9)
      wu.position.set(sx * w2 * 0.25, h + h2 * 0.55, d2 / 2 + 0.04)
      body.add(wu)
    }
    body.add(mesh(box(w2 + 0.3, 0.3, d2 + 0.3), mats.wood, 0, h + h2, 0))
    const roof2 = gableRoof(w2, d2, d2 * 0.42, 1.1)
    roof2.position.y = h + h2 + 0.15
    body.add(roof2)
    top = h + h2 + d2 * 0.42
  } else {
    const roof = gableRoof(w, d, d * 0.42, 1.0)
    roof.position.y = h + 0.15
    body.add(roof)
    top = h + d * 0.42
  }

  if (label) {
    const sign = signBoard(label, accent)
    sign.position.set(0, h - 0.35 + base, d / 2 + 0.25)
    if (stories === 2) sign.position.y = h + base + 0.75
    g.add(sign)
  }

  return { group: g, height: top + base }
}

// Torre de vigia: palafitas, plataforma, cabine com janela e um olho luminoso no topo
export function createTower({ w, accent, label }: { w: number; accent: number; label: string }): { group: THREE.Group; height: number; orb: THREE.Mesh } {
  const g = new THREE.Group()
  const legH = 7
  g.add(mesh(box(w + 1.4, 1.2, w + 1.4), mats.stone, 0, -0.3, 0))
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = mesh(new THREE.CylinderGeometry(0.22, 0.3, legH, 6), mats.wood, (sx * w) / 2, legH / 2, (sz * w) / 2)
      g.add(leg)
    }
  }
  // travessas em X
  for (const y of [2.2, 4.8]) {
    for (const sz of [-1, 1]) g.add(mesh(box(w, 0.18, 0.18), mats.woodDark, 0, y, (sz * w) / 2))
    for (const sx of [-1, 1]) g.add(mesh(box(0.18, 0.18, w), mats.woodDark, (sx * w) / 2, y, 0))
  }
  // escada encostada na frente
  const ladder = new THREE.Group()
  for (const sx of [-0.45, 0.45]) ladder.add(mesh(box(0.12, legH + 0.6, 0.12), mats.woodDark, sx, (legH + 0.6) / 2, 0))
  for (let i = 0; i < 11; i++) ladder.add(mesh(box(0.9, 0.08, 0.1), mats.woodDark, 0, 0.5 + i * 0.68, 0))
  ladder.position.set(0, 0, w / 2 + 0.35)
  ladder.rotation.x = -0.08
  g.add(ladder)

  // plataforma e cabine
  g.add(mesh(box(w + 1.4, 0.3, w + 1.4), mats.wood, 0, legH, 0))
  const cabinH = 2.4
  const cw = w - 0.4
  g.add(mesh(box(cw, cabinH, cw), mats.wall, 0, legH + cabinH / 2 + 0.15, 0))
  for (const side of [0, 1, 2, 3]) {
    const wp = windowPanel(cw * 0.6, 1.1)
    const a = (side * Math.PI) / 2
    wp.rotation.y = a
    wp.position.set(Math.sin(a) * (cw / 2 + 0.04), legH + 1.5, Math.cos(a) * (cw / 2 + 0.04))
    g.add(wp)
  }
  // grade da plataforma
  for (const sx of [-1, 1]) {
    g.add(mesh(box(w + 1.4, 0.1, 0.1), mats.wood, 0, legH + 0.8, (sx * (w + 1.3)) / 2))
    g.add(mesh(box(0.1, 0.1, w + 1.4), mats.wood, (sx * (w + 1.3)) / 2, legH + 0.8, 0))
  }

  const roofBase = legH + cabinH + 0.15
  const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.95, 2.6, 4), mats.roof)
  roof.rotation.y = Math.PI / 4
  roof.position.y = roofBase + 1.3
  roof.castShadow = true
  g.add(roof)

  // olho luminoso (a "lente" do observatório)
  const orbMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 2.2, roughness: 0.2 })
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), orbMat)
  orb.position.y = roofBase + 3.2
  g.add(orb)
  const light = new THREE.PointLight(accent, 6, 14, 1.6)
  light.position.y = roofBase + 3.2
  g.add(light)

  // placa num poste ao lado da escada
  const sx = w / 2 + 1.2
  const sz = w / 2 + 1.4
  g.add(mesh(box(0.18, 2.2, 0.18), mats.woodDark, sx, 1.1, sz))
  const sign = signBoard(label, accent, 3)
  sign.position.set(sx, 2.2, sz + 0.1)
  g.add(sign)

  return { group: g, height: roofBase + 3.6, orb }
}

// Quiosque pequeno (correio): balcão coberto + caixa de correio
export function createKiosk({ w, d, accent, label }: { w: number; d: number; accent: number; label: string }): { group: THREE.Group; height: number } {
  const g = new THREE.Group()
  g.add(mesh(box(w + 0.6, 0.6, d + 0.6), mats.stone, 0, -0.1, 0))
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) g.add(mesh(box(0.25, 2.8, 0.25), mats.wood, (sx * w) / 2, 1.6, (sz * d) / 2))
  }
  g.add(mesh(box(w, 1.1, d * 0.6), mats.wood, 0, 0.75, -d * 0.15))
  g.add(mesh(box(w + 0.2, 0.12, d * 0.6 + 0.2), mats.woodDark, 0, 1.35, -d * 0.15))
  g.add(mesh(box(w, 1.8, 0.15), mats.wall, 0, 2, -d / 2))
  const roof = gableRoof(w, d, d * 0.5, 0.6)
  roof.position.y = 3
  g.add(roof)

  // caixa de correio
  const boxMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.6 })
  const post = mesh(box(0.7, 1.1, 0.6), boxMat, w / 2 + 0.9, 0.95, d / 2 - 0.2)
  g.add(post)
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5), mats.woodDark, w / 2 + 0.9, 0.25, d / 2 - 0.2))
  g.add(mesh(box(0.5, 0.06, 0.05), mats.door, w / 2 + 0.9, 1.25, d / 2 + 0.11))

  const sign = signBoard(label, accent, 2.6)
  sign.position.set(0, 2.85, d / 2 + 0.1)
  g.add(sign)

  return { group: g, height: 3 + d * 0.5 }
}

// Feixe de luz vertical que marca cada setor de longe
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
