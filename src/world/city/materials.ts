import * as THREE from 'three'

// Uniformes compartilhados pela cidade inteira (atualizados pelo ciclo dia/noite)
export const cityUniforms = {
  uNight: { value: 0 }, // 0 = dia, 1 = noite
  uTime: { value: 0 },
}

const loader = new THREE.TextureLoader()
let maxAniso = 8
export const setMaxAnisotropy = (n: number) => (maxAniso = Math.min(8, n))

// Texturas PBR da Poly Haven (public/textures). UVs da cidade são em metros: `tile` = metros por repetição.
function pbr(name: string, tile: number) {
  const load = (file: string, color = false) => {
    const t = loader.load(`/textures/${name}/${file}.jpg`)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(1 / tile, 1 / tile)
    t.anisotropy = maxAniso
    if (color) t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  const arm = load('arm')
  return { map: load('diff', true), normalMap: load('nor'), aoMap: arm, roughnessMap: arm, metalnessMap: arm }
}

const NOISE_GLSL = /* glsl */ `
  float cityHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float cityNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(cityHash(i), cityHash(i + vec2(1, 0)), u.x), mix(cityHash(i + vec2(0, 1)), cityHash(i + vec2(1, 1)), u.x), u.y);
  }
`

// ---------- fachadas com janelas procedurais ----------
// atributos por vértice: aSeed (variação por prédio) e aStyle (largura da janela, altura do andar, tipo)
// tipo 0 = janelas de escritório, 1 = pele de vidro, 2 = parede cega, 3 = casa (janelas desde baixo, sem vitrine)
export const STYLE_OFFICE = 0
export const STYLE_GLASS = 1
export const STYLE_BLANK = 2
export const STYLE_HOUSE = 3

// ---------- texturas de janela (desenhadas uma vez; o filtro de textura cuida da distância) ----------
// 8×8 janelas por textura. RGB = luz da janela acesa (preto = apagada), A = onde é vidro.
type WinKind = 'office' | 'glass' | 'house'
const WIN_RECT: Record<WinKind, [number, number, number, number]> = {
  office: [0.14, 0.22, 0.86, 0.86],
  glass: [0.04, 0.06, 0.96, 0.94],
  house: [0.25, 0.3, 0.75, 0.82],
}

function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
}

function windowTexture(kind: WinKind): THREE.CanvasTexture {
  const N = 8
  const C = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = N * C
  const ctx = canvas.getContext('2d')!
  const rand = seeded(kind.length * 1013 + 7)
  const [x0, y0, x1, y1] = WIN_RECT[kind]
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      // célula: (i, j) com j = andar de cima pra baixo no canvas
      const px = i * C + x0 * C
      const py = j * C + (1 - y1) * C
      const w = (x1 - x0) * C
      const h = (y1 - y0) * C
      const lit = rand() < 0.48
      if (!lit) {
        ctx.fillStyle = 'rgba(0,0,0,1)'
        ctx.fillRect(px, py, w, h)
        continue
      }
      const cool = rand() < 0.28
      const curtain = rand() < 0.35
      const top = cool ? [205, 222, 255] : [255, 214, 160]
      const bottom = cool ? [70, 82, 110] : [150, 96, 52]
      const k = curtain ? 0.6 : 1
      // luz de teto: mais clara em cima, cai pro chão
      const g = ctx.createLinearGradient(0, py, 0, py + h)
      g.addColorStop(0, `rgb(${top.map((v) => Math.round(v * k)).join(',')})`)
      g.addColorStop(1, `rgb(${bottom.map((v) => Math.round(v * k)).join(',')})`)
      ctx.fillStyle = g
      ctx.fillRect(px, py, w, h)
      // silhueta de móvel / pessoa em algumas
      if (!curtain && rand() < 0.5) {
        ctx.fillStyle = 'rgba(20,14,10,0.75)'
        const fw = w * (0.2 + rand() * 0.35)
        const fh = h * (0.25 + rand() * 0.3)
        ctx.fillRect(px + rand() * (w - fw), py + h - fh, fw, fh)
      }
      // cortina: faixas verticais mais claras
      if (curtain) {
        ctx.fillStyle = 'rgba(255,235,200,0.18)'
        for (let s = 0; s < 4; s++) ctx.fillRect(px + (s / 4) * w, py, w / 8, h)
      }
      // persiana/divisória horizontal no escritório
      if (kind !== 'house' && rand() < 0.4) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)'
        ctx.fillRect(px, py + h * 0.48, w, Math.max(2, h * 0.04))
      }
    }
  }
  // fora do vidro: transparente (vira a parede no shader)
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      for (let y = 0; y < C; y++) {
        for (let x = 0; x < C; x++) {
          const u = x / C
          const v = 1 - y / C
          const inside = u >= x0 && u <= x1 && v >= y0 && v <= y1
          if (!inside) img.data[((j * C + y) * canvas.width + i * C + x) * 4 + 3] = 0
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = maxAniso
  return t
}

// vitrine do térreo: 4 vãos com interior de loja (prateleiras, balcão, gente)
function shopTexture(): THREE.CanvasTexture {
  const W = 1024
  const H = 256
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const rand = seeded(4242)
  const bay = W / 4
  for (let b = 0; b < 4; b++) {
    const x = b * bay
    const warm = rand() < 0.65
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, warm ? '#fff1d6' : '#e6f2ff')
    g.addColorStop(1, warm ? '#9c7a55' : '#7d8ea3')
    ctx.fillStyle = g
    ctx.fillRect(x, 0, bay, H)
    // prateleiras com produtos coloridos
    for (let r = 0; r < 3; r++) {
      const y = 40 + r * 52
      ctx.fillStyle = 'rgba(60,45,35,0.8)'
      ctx.fillRect(x + 14, y + 30, bay - 28, 5)
      for (let k = 0; k < 12; k++) {
        ctx.fillStyle = `hsl(${Math.floor(rand() * 360)}, 70%, ${45 + rand() * 20}%)`
        ctx.fillRect(x + 18 + k * ((bay - 36) / 12), y + 8 + rand() * 6, (bay - 36) / 16, 22)
      }
    }
    // balcão e uma silhueta
    ctx.fillStyle = 'rgba(40,30,25,0.85)'
    ctx.fillRect(x + bay * 0.1, H - 70, bay * 0.5, 70)
    if (rand() < 0.7) {
      ctx.fillStyle = 'rgba(25,20,18,0.8)'
      const px = x + bay * (0.6 + rand() * 0.25)
      ctx.beginPath()
      ctx.arc(px, H - 120, 14, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillRect(px - 16, H - 104, 32, 104)
    }
    // montante entre vãos (sem vidro)
    ctx.clearRect(x, 0, 10, H)
  }
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  t.anisotropy = maxAniso
  return t
}

let winTextures: { office: THREE.Texture; glass: THREE.Texture; house: THREE.Texture; shop: THREE.Texture } | null = null
const getWinTextures = () =>
  (winTextures ??= { office: windowTexture('office'), glass: windowTexture('glass'), house: windowTexture('house'), shop: shopTexture() })

export function facadeMaterial(texture: string, tile = 4, tint = 0xffffff): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ ...pbr(texture, tile), color: tint, roughness: 1, metalness: 1, vertexColors: true })
  const tex = getWinTextures()
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = cityUniforms.uNight
    shader.uniforms.uWinOffice = { value: tex.office }
    shader.uniforms.uWinGlass = { value: tex.glass }
    shader.uniforms.uWinHouse = { value: tex.house }
    shader.uniforms.uShop = { value: tex.shop }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aSeed;
        attribute vec3 aStyle;
        varying vec2 vUvM;
        flat varying float vSeed;
        flat varying vec3 vStyle;`,
      )
      .replace('#include <uv_vertex>', `#include <uv_vertex>\n vUvM = uv; vSeed = fract(aSeed); vStyle = aStyle;`)
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uNight;
        uniform sampler2D uWinOffice;
        uniform sampler2D uWinGlass;
        uniform sampler2D uWinHouse;
        uniform sampler2D uShop;
        varying vec2 vUvM;
        flat varying float vSeed;
        flat varying vec3 vStyle;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float kind = vStyle.z;
        float isOffice = 1.0 - step(0.5, kind);
        float isGlass = step(0.5, kind) * (1.0 - step(1.5, kind));
        float isHouse = step(2.5, kind);
        float groundH = isHouse > 0.5 ? 0.9 : 4.2;
        // cada prédio mostra um trecho diferente da textura (8×8 janelas)
        vec2 offs = floor(vec2(fract(vSeed * 7.31), fract(vSeed * 3.17)) * 8.0) / 8.0;
        vec2 wuv = vec2(vUvM.x / (vStyle.x * 8.0), (vUvM.y - groundH) / (vStyle.y * 8.0)) + offs;
        // as três sempre amostradas (sem textura dentro de if: o filtro precisa das derivadas)
        vec4 win = texture2D(uWinOffice, wuv) * isOffice + texture2D(uWinGlass, wuv) * isGlass + texture2D(uWinHouse, wuv) * isHouse;
        float upper = smoothstep(groundH - 0.05, groundH + 0.05, vUvM.y);
        float winMask = win.a * upper;
        vec3 winLight = win.rgb;
        vec2 suv = vec2(vUvM.x / 10.4 + fract(vSeed * 5.7), clamp((vUvM.y - 0.3) / 3.2, 0.0, 1.0));
        vec4 shop = texture2D(uShop, suv);
        float band = smoothstep(0.25, 0.35, vUvM.y) * (1.0 - smoothstep(3.45, 3.55, vUvM.y));
        float shopMask = shop.a * band * (isOffice + isGlass) * (1.0 - upper);
        vec3 shopLight = shop.rgb;
        vec3 glass = vec3(0.045, 0.06, 0.08);
        diffuseColor.rgb = mix(diffuseColor.rgb, glass, max(winMask, shopMask));`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.12, max(winMask, shopMask));`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, 0.25, max(winMask, shopMask));`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        // vidro é liso: sem o relevo da textura da fachada
        normal = normalize(mix(normal, normalize(vNormal), max(winMask, shopMask)));`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += winLight * winMask * (0.02 + 0.85 * uNight);
        totalEmissiveRadiance += shopLight * shopMask * (0.04 + 0.42 * uNight);`,
      )
  }
  mat.customProgramCacheKey = () => `facade-${texture}`
  return mat
}

// ---------- asfalto com poças ----------
export function asphaltMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ ...pbr('asphalt_02', 5), roughness: 1, metalness: 1, color: 0x9a9a9a })
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n varying vec2 vWorldXZ;`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n vWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n varying vec2 vWorldXZ;\n ${NOISE_GLSL}`)
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float puddle = smoothstep(0.58, 0.66, cityNoise(vWorldXZ * 0.13) * 0.7 + cityNoise(vWorldXZ * 0.9) * 0.3);
        diffuseColor.rgb *= mix(1.0, 0.45, puddle);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.1, puddle);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        normal = normalize(mix(normal, normalize(vNormal), puddle));`,
      )
  }
  mat.customProgramCacheKey = () => 'asphalt-puddles'
  return mat
}

export const sidewalkMaterial = () => new THREE.MeshStandardMaterial({ ...pbr('concrete_pavement_02', 3), roughness: 1, metalness: 1 })
export const plazaMaterial = () =>
  new THREE.MeshStandardMaterial({ ...pbr('concrete_pavement_02', 2), roughness: 1, metalness: 1, color: 0xe6e2dc })
// concreto cinza (o mesmo das fachadas) pra telhados, meio-fio e paredões
export const roofMaterial = () => new THREE.MeshStandardMaterial({ ...pbr('concrete_tile_facade', 4), roughness: 1, metalness: 1, color: 0x9c9a96 })
export const concreteMaterial = () => new THREE.MeshStandardMaterial({ ...pbr('concrete_tile_facade', 2.5), roughness: 1, metalness: 1, color: 0xc4c1bb })
