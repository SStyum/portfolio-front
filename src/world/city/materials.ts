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

export function facadeMaterial(texture: string, tile = 4, tint = 0xffffff): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ ...pbr(texture, tile), color: tint, roughness: 1, metalness: 1, vertexColors: true })
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = cityUniforms.uNight
    shader.uniforms.uTime = cityUniforms.uTime
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
      .replace('#include <uv_vertex>', `#include <uv_vertex>\n vUvM = uv; vSeed = fract(aSeed) * 97.0; vStyle = aStyle; // semente pequena: hash com número grande perde precisão`)
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uNight;
        uniform float uTime;
        varying vec2 vUvM;
        flat varying float vSeed;
        flat varying vec3 vStyle;
        ${NOISE_GLSL}`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float winMask = 0.0;
        float shopMask = 0.0;
        float winY = 0.5; // altura dentro da janela (0 = parapeito, 1 = teto)
        float kind = vStyle.z;
        bool house = kind > 2.5;
        bool hasWindows = kind < 1.5 || house;
        float groundH = house ? 0.9 : 4.2;
        // grade de janelas (calculada fora de qualquer if: derivadas precisam disso)
        vec2 g = vec2(vUvM.x / vStyle.x, (vUvM.y - groundH) / vStyle.y);
        vec2 fw = fwidth(g);
        // longe: a janela ocupa poucos pixels; desenhar uma a uma vira "estática". Usa a média.
        float winFar = smoothstep(0.12, 0.4, max(fw.x, fw.y));
        vec2 winCell = floor(g);
        vec2 l = fract(g);
        vec2 lo = kind < 0.5 ? vec2(0.14, 0.22) : house ? vec2(0.25, 0.3) : vec2(0.03, 0.05);
        vec2 hi = kind < 0.5 ? vec2(0.86, 0.86) : house ? vec2(0.75, 0.82) : vec2(0.97, 0.95);
        // bordas suavizadas pelo tamanho do pixel (sem serrilhado)
        vec2 aa = clamp(fw * 1.2, 0.002, 0.5);
        vec2 edge = smoothstep(lo - aa, lo + aa, l) * (1.0 - smoothstep(hi - aa, hi + aa, l));
        float coverage = (hi.x - lo.x) * (hi.y - lo.y);
        float upper = smoothstep(groundH - 0.05, groundH + 0.05, vUvM.y);
        // vitrine do térreo, com montantes (também suavizados)
        float sx = vUvM.x / 2.6;
        float sfw = fwidth(sx) * 1.2 + 0.002;
        float sm = fract(sx);
        float mull = smoothstep(0.05 - sfw, 0.05 + sfw, sm) * (1.0 - smoothstep(0.95 - sfw, 0.95 + sfw, sm));
        float band = smoothstep(0.3, 0.4, vUvM.y) * (1.0 - smoothstep(3.45, 3.55, vUvM.y));
        if (hasWindows) {
          winMask = mix(edge.x * edge.y, coverage, winFar) * upper;
          winY = clamp((l.y - lo.y) / (hi.y - lo.y), 0.0, 1.0);
          if (!house) shopMask = mix(mull, 0.9, smoothstep(0.1, 0.35, sfw)) * band * (1.0 - upper);
        }
        float glassVar = mix(cityHash(winCell + vSeed * 7.13), 0.5, winFar);
        vec3 glass = mix(vec3(0.035, 0.05, 0.07), vec3(0.09, 0.12, 0.15), glassVar);
        // algumas janelas com persiana clara (só de perto)
        if (kind < 0.5 && glassVar > 0.82) glass = vec3(0.32, 0.30, 0.27);
        diffuseColor.rgb = mix(diffuseColor.rgb, glass, max(winMask, shopMask));`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.14, max(winMask, shopMask));`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, 0.3, max(winMask, shopMask));`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        // vidro é liso: sem o relevo da textura da fachada (que dava reflexo granulado)
        normal = normalize(mix(normal, normalize(vNormal), max(winMask, shopMask)));`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        // janelas acesas: mais à noite, trocando devagar
        float litP = mix(0.05, 0.42, uNight);
        float lit = step(cityHash(winCell * 1.31 + vSeed * 3.7 + floor(uTime * 0.01 + vSeed)), litP);
        vec3 warm = vec3(1.0, 0.78, 0.5);
        vec3 cool = vec3(0.7, 0.85, 1.0);
        vec3 wcol = mix(warm, cool, step(0.7, cityHash(winCell + vSeed)));
        // interior: luz do teto (mais clara em cima), algumas com cortina (mais fraca e mais quente)
        float curtain = step(0.62, cityHash(winCell * 2.7 + vSeed));
        float interior = mix(0.5, 1.0, smoothstep(0.0, 1.0, winY)) * mix(1.0, 0.55, curtain);
        wcol = mix(wcol, warm * vec3(1.0, 0.85, 0.7), curtain);
        // de longe: brilho médio estável da fachada (sem piscar)
        vec3 winLight = mix(wcol * lit * interior, mix(warm, cool, 0.3) * litP * 0.75, winFar);
        totalEmissiveRadiance += winLight * winMask * (0.03 + 0.32 * uNight);
        totalEmissiveRadiance += vec3(1.0, 0.92, 0.8) * shopMask * (0.06 + 0.45 * uNight);`,
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
