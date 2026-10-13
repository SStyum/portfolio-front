import * as THREE from 'three'
import { heightAt } from './terrain'

// Árvores das calçadas e da praça, instanciadas (centenas de árvores em poucas chamadas de desenho)

const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3d26, roughness: 1 })
const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 3, 6)
const leafGeo = new THREE.IcosahedronGeometry(1, 0)
const pineCones = [new THREE.ConeGeometry(2.2, 3, 7), new THREE.ConeGeometry(1.7, 2.6, 7), new THREE.ConeGeometry(1.1, 2.2, 7)]

export interface ForestTree {
  x: number
  z: number
  kind: 'cherry' | 'maple' | 'green' | 'pine'
  scale: number
  seed: number
}

const leafColors: Record<'cherry' | 'maple' | 'green', number[]> = {
  cherry: [0xf6b8cf, 0xf29fbd, 0xfcd3e1],
  maple: [0xe76f51, 0xf4a261, 0xd9573b],
  green: [0x6a994e, 0x588b3f, 0x7db15a],
}
const pineColors = [0x2f5d3a, 0x3b6e45]

// Mesmas formas de createTree/createPine, mas cada parte vira uma instância
export function createForest(trees: ForestTree[]): THREE.Group {
  const group = new THREE.Group()
  const broad = trees.filter((t) => t.kind !== 'pine')
  const pines = trees.filter((t) => t.kind === 'pine')

  const white = (flat = true) => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: flat })
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length)
  const leaves = new THREE.InstancedMesh(leafGeo, white(), broad.length * 5)
  const cones = pineCones.map((geo) => new THREE.InstancedMesh(geo, white(), pines.length))

  const tree = new THREE.Matrix4()
  const part = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const v = new THREE.Vector3()
  const sc = new THREE.Vector3()
  const color = new THREE.Color()
  const place = (t: ForestTree) =>
    tree.compose(v.set(t.x, heightAt(t.x, t.z) - 0.1, t.z), q.setFromEuler(e.set(0, t.seed * Math.PI * 2, 0)), sc.setScalar(t.scale))

  let ti = 0
  let li = 0
  for (const t of broad) {
    place(t)
    trunks.setMatrixAt(ti++, part.compose(v.set(0, 1.5, 0), q.identity(), sc.setScalar(1)).premultiply(tree))
    const cols = leafColors[t.kind as 'cherry' | 'maple' | 'green']
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + t.seed * 6
      const r = i === 0 ? 0 : 1.1
      const s = i === 0 ? 1.9 : 1.3 + ((t.seed * 7 + i) % 1) * 0.4
      part.compose(
        v.set(Math.cos(a) * r, 3.6 + (i === 0 ? 0.6 : (i % 2) * 0.5), Math.sin(a) * r),
        q.setFromEuler(e.set(t.seed * 3, i, t.seed)),
        sc.setScalar(s),
      )
      leaves.setMatrixAt(li, part.premultiply(tree))
      leaves.setColorAt(li++, color.setHex(cols[i % cols.length]))
    }
  }
  pines.forEach((t, pi) => {
    place(t)
    trunks.setMatrixAt(ti++, part.compose(v.set(0, 1.2, 0), q.identity(), sc.setScalar(1)).premultiply(tree))
    cones.forEach((c, i) => {
      c.setMatrixAt(pi, part.compose(v.set(0, 3 + i * 1.5, 0), q.identity(), sc.setScalar(1)).premultiply(tree))
      c.setColorAt(pi, color.setHex(pineColors[(i + Math.floor(t.seed * 10)) % 2]))
    })
  })

  for (const m of [trunks, leaves, ...cones]) {
    m.castShadow = true
    m.receiveShadow = true
    m.computeBoundingSphere()
    group.add(m)
  }
  return group
}
