import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Colliders } from '../colliders'
import { BLOCKS, CITY_EDGE, CURB, HILL, LANE, PLAZA, SIDEWALK, STAIRS, STREETS, isPlaza, streetWidth } from '../layout'
import { createForest, type ForestTree } from '../props'

export interface StreetProps {
  group: THREE.Group
  // onde ficam as luminárias (pra luz de verdade nos postes mais próximos do jogador)
  lights: THREE.Vector4[]
  update(night: number): void
}

const metal = new THREE.MeshStandardMaterial({ color: 0x5d636a, roughness: 0.45, metalness: 0.75 })
const concrete = new THREE.MeshStandardMaterial({ color: 0x9e9b94, roughness: 0.9 })

// InstancedMesh a partir de uma lista de matrizes
function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, mats: THREE.Matrix4[], shadow = true) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, mats.length))
  mats.forEach((mm, i) => m.setMatrixAt(i, mm))
  m.count = mats.length
  m.castShadow = shadow
  m.receiveShadow = true
  m.computeBoundingSphere()
  return m
}

const at = (x: number, y: number, z: number, yaw = 0, s = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(s, s, s))

function poolTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.35)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

function vendingTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#f2f4f7'
  ctx.fillRect(0, 0, 128, 256)
  // fileiras de latinhas coloridas
  const cans = ['#d62828', '#f77f00', '#2a9d8f', '#3a86ff', '#ffbe0b', '#8338ec', '#06d6a0']
  for (let r = 0; r < 4; r++) {
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = cans[(r * 3 + k) % cans.length]
      ctx.fillRect(10 + k * 18, 22 + r * 34, 12, 22)
    }
  }
  ctx.fillStyle = '#1b1b1b'
  ctx.fillRect(10, 170, 108, 50)
  ctx.fillStyle = '#9fe870'
  ctx.fillRect(88, 180, 22, 10)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function createStreetProps(colliders: Colliders, rand: () => number): StreetProps {
  const group = new THREE.Group()

  const lampPoles: THREE.Matrix4[] = []
  const lampHeads: THREE.Matrix4[] = []
  const lights: THREE.Vector4[] = []
  const pools: THREE.Matrix4[] = []
  const utility: THREE.Matrix4[] = []
  const vending: THREE.Matrix4[] = []
  const bollards: THREE.Matrix4[] = []
  const benches: THREE.Matrix4[] = []
  const trees: ForestTree[] = []
  const wires: number[] = []
  const gardenWalls: { x: number; z: number; w: number; h: number; y: number }[] = []
  const free = (x: number, z: number, m: number) => !colliders.blocked(x, z, m)

  for (const c of STREETS) {
    const w = streetWidth(c)
    const curbOff = w / 2 + 0.6 // logo depois do meio-fio
    const nearCrossing = (s: number) => STREETS.some((c2) => Math.abs(s - c2) < streetWidth(c2) / 2 + 6)

    // postes de luz: dos dois lados, a cada 18 m
    for (let s = -CITY_EDGE + 9; s < CITY_EDGE; s += 18) {
      if (nearCrossing(s)) continue
      for (const side of [-1, 1]) {
        for (const [x, z, yaw] of [
          // yaw faz o braço (−x local) apontar pra dentro da rua
          [c + side * curbOff, s, side > 0 ? 0 : Math.PI],
          [s, c + side * curbOff, side > 0 ? -Math.PI / 2 : Math.PI / 2],
        ] as const) {
          if (!free(x, z, 0.6)) continue
          lampPoles.push(at(x, CURB, z, yaw))
          // cabeça da luminária fica sobre a rua (braço aponta pra -x local)
          const hx = x - Math.cos(yaw) * 1.6
          const hz = z + Math.sin(yaw) * 1.6
          lampHeads.push(at(hx, CURB + 6.6, hz, yaw))
          lights.push(new THREE.Vector4(hx, CURB + 6.3, hz, 70)) // poste de rua: alto e forte
          pools.push(at(hx, 0.02, hz, 0, 1))
          colliders.circle(x, z, 0.18, 7, 0)
        }
      }
    }

    // postes de concreto com fiação: só nas ruas menores, de um lado
    if (c !== 0) {
      let prev: THREE.Vector3[] | null = null
      for (let s = -CITY_EDGE + 4; s < CITY_EDGE; s += 21) {
        if (nearCrossing(s)) {
          prev = null
          continue
        }
        const x = c - curbOff - 0.2
        if (!free(x, s, 0.5)) {
          prev = null
          continue
        }
        utility.push(at(x, CURB, s))
        colliders.circle(x, s, 0.22, 10, 0)
        // pontos de amarração nas travessas (três fios)
        const tips = [-0.9, 0, 0.9].map((o) => new THREE.Vector3(x + o, CURB + 8.6, s))
        if (prev) {
          tips.forEach((tip, k) => {
            const a = prev![k]
            // catenária simples: curva caída no meio
            const N = 8
            for (let i = 0; i < N; i++) {
              const t0 = i / N
              const t1 = (i + 1) / N
              const p = (t: number) => [a.x + (tip.x - a.x) * t, a.y + (tip.y - a.y) * t - Math.sin(Math.PI * t) * 0.9, a.z + (tip.z - a.z) * t]
              wires.push(...p(t0), ...p(t1))
            }
          })
        }
        prev = tips
      }
    }
  }

  // ---------- rua estreita no alto da colina: postes com fiação, muros de jardim, máquinas ----------
  {
    const H = HILL.h
    let prev: THREE.Vector3[] | null = null
    for (let x = LANE.x0 + 3; x < LANE.x1 - 2; x += 13) {
      const z = LANE.z0 + 0.5
      utility.push(at(x, H, z))
      colliders.circle(x, z, 0.22, H + 10, H - 1)
      const tips = [-0.9, 0, 0.9].map((o) => new THREE.Vector3(x, H + 8.6, z + o))
      if (prev) {
        tips.forEach((tip, k) => {
          const a = prev![k]
          for (let i = 0; i < 8; i++) {
            const p = (t: number) => [a.x + (tip.x - a.x) * t, a.y + (tip.y - a.y) * t - Math.sin(Math.PI * t) * 0.9, a.z + (tip.z - a.z) * t]
            wires.push(...p(i / 8), ...p((i + 1) / 8))
          }
        })
      }
      prev = tips
    }
    // muros baixos de bloco na frente das casas do lado norte (com portões) — bons pra treinar parkour
    for (let x = LANE.x0; x < LANE.x1 - 4; x += 7) {
      const wx = x + 2.5
      const wz = LANE.z0 - 0.8
      gardenWalls.push({ x: wx, z: wz, w: 5, h: 1.4, y: H })
      colliders.box(wx, wz, 5, 0.3, 0, H + 1.4, H - 1)
    }
    // máquinas de venda no alto de cada escada
    for (const s of STAIRS) {
      const x = s.x0 - 1.4
      const z = LANE.z1 - 0.6
      if (!free(x, z, 0.5)) continue
      vending.push(at(x, H, z, Math.PI))
      colliders.box(x, z, 1.05, 0.85, 0, H + 1.95, H - 1)
    }
  }

  // árvores nas calçadas das avenidas largas, máquinas de venda nas quinas dos quarteirões
  for (const b of BLOCKS) {
    if (isPlaza(b)) continue
    const edgesTrees: [number, number][] = []
    for (let x = b.x0 + 6; x < b.x1 - 4; x += 9) edgesTrees.push([x, b.z0 + 1.2], [x, b.z1 - 1.2])
    for (let z = b.z0 + 6; z < b.z1 - 4; z += 9) edgesTrees.push([b.x0 + 1.2, z], [b.x1 - 1.2, z])
    for (const [x, z] of edgesTrees) {
      if (rand() < 0.45 || !free(x, z, 1.2)) continue
      trees.push({ x, z, kind: 'green', scale: 0.62 + rand() * 0.2, seed: rand() })
      colliders.circle(x, z, 0.35, 6, 0)
    }
    // máquinas de venda encostadas no prédio, perto das quinas
    for (const [x, z, yaw] of [
      [b.x0 + SIDEWALK + 1.4, b.z0 + SIDEWALK - 0.5, Math.PI],
      [b.x1 - SIDEWALK - 1.4, b.z1 - SIDEWALK + 0.5, 0],
    ] as const) {
      if (rand() < 0.4 || !free(x, z, 0.8)) continue
      const n = 1 + Math.floor(rand() * 3)
      for (let k = 0; k < n; k++) {
        const vx = x + (k - (n - 1) / 2) * 1.05 * (yaw === 0 ? -1 : 1)
        vending.push(at(vx, CURB, z, yaw))
      }
      colliders.box(x, z, n * 1.05, 0.85, 0, CURB + 1.95, 0)
    }
  }

  // ---------- praça: Hachiko, bancos, frades, árvores ----------
  const cx = (PLAZA.x0 + PLAZA.x1) / 2
  const cz = (PLAZA.z0 + PLAZA.z1) / 2
  for (let i = 0; i < 6; i++) {
    const x = PLAZA.x0 + 3 + i * 4
    trees.push({ x, z: PLAZA.z0 + 2.5, kind: i % 3 === 0 ? 'cherry' : 'green', scale: 0.75, seed: rand() })
    colliders.circle(x, PLAZA.z0 + 2.5, 0.35, 6, 0)
  }
  for (const [x, z, yaw] of [
    [cx - 4, cz + 2, 0],
    [cx + 3, cz + 2, 0],
    [cx - 6, cz - 3, Math.PI / 2],
  ] as const) {
    benches.push(at(x, CURB, z, yaw))
    colliders.box(x, z, yaw ? 0.6 : 1.8, yaw ? 1.8 : 0.6, 0, CURB + 0.45, 0)
  }
  for (let x = PLAZA.x0 + 1; x <= PLAZA.x1 - 1; x += 2.2) {
    for (const z of [PLAZA.z0 + 0.4]) {
      if (Math.abs(x - cx) < 3) continue
      bollards.push(at(x, CURB, z))
    }
  }
  group.add(createHachiko(cx + 4, cz - 2))
  colliders.box(cx + 4, cz - 2, 1.4, 1.4, 0, CURB + 1.1, 0)

  // ---------- geometrias ----------
  const poleGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.09, 0.12, 6.8, 8).translate(0, 3.4, 0),
    new THREE.BoxGeometry(1.7, 0.08, 0.08).translate(-0.85, 6.65, 0),
  ])
  group.add(instanced(poleGeo, metal, lampPoles))
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xffe2b0, emissiveIntensity: 0.2, roughness: 0.3 })
  group.add(instanced(new THREE.BoxGeometry(0.7, 0.14, 0.32), headMat, lampHeads, false))

  const poolMat = new THREE.MeshBasicMaterial({
    map: poolTexture(),
    color: 0xffd9a0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const poolGeo = new THREE.PlaneGeometry(13, 13).rotateX(-Math.PI / 2)
  const poolMesh = instanced(poolGeo, poolMat, pools, false)
  poolMesh.receiveShadow = false
  poolMesh.renderOrder = 2
  group.add(poolMesh)

  // feixe de luz visível: cone suave descendo de cada luminária até o chão
  const coneH = CURB + 6.5
  const coneGeo = new THREE.CylinderGeometry(0.18, 2.6, coneH, 20, 1, true).translate(0, -coneH / 2, 0)
  const coneMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uStrength: { value: 0 }, uColor: { value: new THREE.Color(0xffd29a) } },
    vertexShader: `varying float vY; varying float vFacing;
      void main() {
        vY = uv.y;
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * mat3(instanceMatrix) * normal);
        vFacing = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform float uStrength; uniform vec3 uColor; varying float vY; varying float vFacing;
      void main() {
        // forte perto da lâmpada, some no chão; mais denso no meio do cone que nas bordas
        float a = pow(vY, 1.6) * pow(vFacing, 2.0) * uStrength;
        gl_FragColor = vec4(uColor * a, a);
      }`,
  })
  const cones = instanced(coneGeo, coneMat, lampHeads.map((m) => m.clone().multiply(new THREE.Matrix4().makeTranslation(0, -0.05, 0))), false)
  cones.receiveShadow = false
  cones.renderOrder = 3
  group.add(cones)

  const utilityGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.14, 0.2, 10, 8).translate(0, 5, 0),
    new THREE.BoxGeometry(2.2, 0.12, 0.12).translate(0, 8.6, 0),
    new THREE.BoxGeometry(1.6, 0.1, 0.1).translate(0, 7.8, 0),
    new THREE.CylinderGeometry(0.28, 0.28, 0.7, 8).translate(0.35, 7.2, 0), // transformador
  ])
  group.add(instanced(utilityGeo, concrete, utility))
  if (wires.length) {
    const wg = new THREE.BufferGeometry()
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3))
    group.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x1a1a1a })))
  }

  const vendTex = vendingTexture()
  const vendMats = [
    new THREE.MeshStandardMaterial({ color: 0xd8dde3, roughness: 0.4, metalness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: 0xd8dde3, roughness: 0.4, metalness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: 0xc9ced4, roughness: 0.4, metalness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: 0xc9ced4, roughness: 0.4, metalness: 0.3 }),
    new THREE.MeshStandardMaterial({ map: vendTex, emissiveMap: vendTex, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.2 }),
    new THREE.MeshStandardMaterial({ color: 0xd8dde3, roughness: 0.4, metalness: 0.3 }),
  ]
  const vendGeo = new THREE.BoxGeometry(1, 1.9, 0.8).translate(0, 0.95, 0)
  const vendMesh = new THREE.InstancedMesh(vendGeo, vendMats, Math.max(1, vending.length))
  vending.forEach((m, i) => vendMesh.setMatrixAt(i, m))
  vendMesh.count = vending.length
  vendMesh.castShadow = vendMesh.receiveShadow = true
  group.add(vendMesh)

  group.add(instanced(new THREE.CylinderGeometry(0.12, 0.14, 0.8, 10).translate(0, 0.4, 0), concrete, bollards))
  const benchGeo = mergeGeometries([
    new THREE.BoxGeometry(1.8, 0.08, 0.5).translate(0, 0.45, 0),
    new THREE.BoxGeometry(0.08, 0.45, 0.45).translate(-0.8, 0.22, 0),
    new THREE.BoxGeometry(0.08, 0.45, 0.45).translate(0.8, 0.22, 0),
  ])
  group.add(instanced(benchGeo, new THREE.MeshStandardMaterial({ color: 0x7a5534, roughness: 0.8 }), benches))

  group.add(createForest(trees))

  if (gardenWalls.length) {
    const wallGeo = new THREE.BoxGeometry(1, 1, 0.3)
    const wallMesh = new THREE.InstancedMesh(wallGeo, new THREE.MeshStandardMaterial({ color: 0xb8b2a6, roughness: 0.95 }), gardenWalls.length)
    gardenWalls.forEach((w, i) => wallMesh.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(w.x, w.y + w.h / 2, w.z), new THREE.Quaternion(), new THREE.Vector3(w.w, w.h, 1))))
    wallMesh.castShadow = wallMesh.receiveShadow = true
    group.add(wallMesh)
  }

  return {
    group,
    lights,
    update(night) {
      headMat.emissiveIntensity = 0.1 + night * 2.2
      poolMat.opacity = night * 0.55
      coneMat.uniforms.uStrength.value = night * 0.16
      for (const m of vendMats) if (m.emissiveMap) m.emissiveIntensity = 0.2 + night * 0.7
    },
  }
}

// Hachiko: o cachorro de bronze da praça, feito de formas simples
function createHachiko(x: number, z: number): THREE.Group {
  const g = new THREE.Group()
  const bronze = new THREE.MeshStandardMaterial({ color: 0x6b5236, roughness: 0.35, metalness: 0.85 })
  const stone = new THREE.MeshStandardMaterial({ color: 0x8c8780, roughness: 0.9 })
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, px: number, py: number, pz: number, rx = 0) => {
    const mesh = new THREE.Mesh(geo, m)
    mesh.position.set(px, py, pz)
    mesh.rotation.x = rx
    mesh.castShadow = true
    g.add(mesh)
    return mesh
  }
  add(new THREE.BoxGeometry(1.3, 0.8, 1.3), stone, 0, 0.4, 0)
  add(new THREE.CapsuleGeometry(0.2, 0.4, 4, 8), bronze, 0, 1.05, 0, Math.PI / 2 - 0.5) // corpo sentado
  add(new THREE.SphereGeometry(0.17, 10, 8), bronze, 0, 1.42, 0.22) // cabeça
  add(new THREE.BoxGeometry(0.12, 0.1, 0.16), bronze, 0, 1.38, 0.38) // focinho
  for (const sx of [-0.08, 0.08]) {
    add(new THREE.ConeGeometry(0.06, 0.13, 4), bronze, sx, 1.6, 0.2) // orelhas
    add(new THREE.CylinderGeometry(0.045, 0.05, 0.4, 6), bronze, sx, 0.98, 0.18) // patas da frente
  }
  g.position.set(x, CURB, z)
  g.rotation.y = Math.PI * 0.75
  return g
}
