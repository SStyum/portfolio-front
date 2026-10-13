import * as THREE from 'three'
import { asphaltMaterial, concreteMaterial, plazaMaterial, sidewalkMaterial } from './city/materials'
import { GeoBuilder } from './city/geo'
import { BLOCKS, CITY_EDGE, CURB, HILL, STAIR_RUN, STAIR_STEPS, STREETS, inHill, isPlaza, isRoad, stairAt, streetWidth } from './layout'

const STAIR_RISE = (HILL.h - CURB) / STAIR_STEPS

// Altura do chão: rua no nível 0, calçadas um meio-fio acima, colina lá em cima e a escadaria degrau a degrau
export function heightAt(x: number, z: number): number {
  if (inHill(x, z)) {
    if (stairAt(x, z)) {
      const step = Math.min(STAIR_STEPS, Math.floor((HILL.front - z) / STAIR_RUN) + 1)
      return CURB + step * STAIR_RISE
    }
    return HILL.h
  }
  return isRoad(x, z) ? 0 : CURB
}

const OUTER = 230 // até onde o chão vai (o horizonte fica coberto pelo skyline)

export function createGround(): THREE.Group {
  const group = new THREE.Group()

  // ---------- asfalto: um plano só, com poças no shader ----------
  const road = new GeoBuilder()
  road.top(0, 0, OUTER * 2, OUTER * 2, 0, 0)
  const roadMesh = new THREE.Mesh(road.build(), asphaltMaterial())
  roadMesh.receiveShadow = true
  group.add(roadMesh)

  // ---------- quarteirões: tampo de calçada + meio-fio ----------
  const tops = new GeoBuilder()
  const plaza = new GeoBuilder()
  const curbs = new GeoBuilder()
  const slab = (x0: number, x1: number, z0: number, z1: number, into: GeoBuilder) => {
    const w = x1 - x0
    const d = z1 - z0
    into.top((x0 + x1) / 2, (z0 + z1) / 2, w, d, 0, CURB)
    curbs.walls((x0 + x1) / 2, (z0 + z1) / 2, w, d, 0, 0, CURB)
  }
  for (const b of BLOCKS) slab(b.x0, b.x1, b.z0, b.z1, isPlaza(b) ? plaza : tops)

  // borda da cidade: chão alto até o horizonte, com vão nas avenidas principais (túneis dos carros)
  const e = CITY_EDGE
  const main = streetWidth(0) / 2
  for (const side of [-1, 1]) {
    const zA = side < 0 ? -OUTER : e
    const zB = side < 0 ? -e : OUTER
    slab(-OUTER, -main, zA, zB, tops)
    slab(main, OUTER, zA, zB, tops)
    const xA = side < 0 ? -OUTER : e
    const xB = side < 0 ? -e : OUTER
    slab(xA, xB, -e, -main, tops)
    slab(xA, xB, main, e, tops)
  }

  const sidewalk = new THREE.Mesh(tops.build(), sidewalkMaterial())
  sidewalk.receiveShadow = true
  group.add(sidewalk)
  const plazaMesh = new THREE.Mesh(plaza.build(), plazaMaterial())
  plazaMesh.receiveShadow = true
  group.add(plazaMesh)
  const curbMesh = new THREE.Mesh(curbs.build(), concreteMaterial())
  curbMesh.receiveShadow = true
  group.add(curbMesh)

  group.add(createMarkings())
  return group
}

// ---------- faixas pintadas ----------
function createMarkings(): THREE.Mesh {
  const g = new GeoBuilder()
  const Y = 0.012
  const rect = (x: number, z: number, w: number, d: number, rot = 0) => g.top(x, z, w, d, rot, Y)
  const inIntersection = (along: number) => STREETS.some((c) => Math.abs(along - c) < streetWidth(c) / 2 + 4.5)

  for (const c of STREETS) {
    const w = streetWidth(c)
    // linhas ao longo da rua (x = c corre em z; z = c corre em x)
    for (let s = -CITY_EDGE; s < CITY_EDGE; s += 6) {
      if (inIntersection(s) || inIntersection(s + 3)) continue
      if (c === 0) {
        // avenida principal: linha central contínua + divisórias de faixa tracejadas
        rect(c, s + 3, 0.18, 6.02)
        rect(s + 3, c, 6.02, 0.18)
        for (const off of [-w / 4, w / 4]) {
          rect(c + off, s + 1.5, 0.14, 3)
          rect(s + 1.5, c + off, 3, 0.14)
        }
      } else {
        rect(c, s + 1.5, 0.15, 3)
        rect(s + 1.5, c, 3, 0.15)
      }
    }

    // faixas de pedestre em cada cruzamento
    for (const c2 of STREETS) {
      const w2 = streetWidth(c2)
      for (const side of [-1, 1]) {
        const at = c2 + side * (w2 / 2 + 2)
        for (let k = -w / 2 + 0.6; k < w / 2 - 0.4; k += 1.1) {
          rect(c + k + 0.3, at, 0.6, 3)
          rect(at, c + k + 0.3, 3, 0.6)
        }
        // linha de parada antes da faixa (só na mão que chega no cruzamento)
        rect(c + (side > 0 ? -w / 4 : w / 4), c2 + side * (w2 / 2 + 4.3), w / 2 - 0.4, 0.35)
        rect(c2 + side * (w2 / 2 + 4.3), c + (side > 0 ? w / 4 : -w / 4), 0.35, w / 2 - 0.4)
      }
    }
  }

  // o "scramble": duas diagonais atravessando o cruzamento central
  const half = streetWidth(0) / 2
  for (const rot of [Math.PI / 4, -Math.PI / 4]) {
    const len = half * 2 * Math.SQRT2 - 3
    for (let k = -1.6; k <= 1.6; k += 1.1) {
      rect(Math.cos(rot) * k, -Math.sin(rot) * k, 0.6, len, rot)
    }
  }

  const mat = new THREE.MeshStandardMaterial({
    color: 0xe9e7df,
    roughness: 0.65,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })
  const mesh = new THREE.Mesh(g.build(), mat)
  mesh.receiveShadow = true
  return mesh
}
