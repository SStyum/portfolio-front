import * as THREE from 'three'
import './style.css'
import { profile } from './content'
import { Input } from './input'
import { PlayerController } from './player/controller'
import { Hud, type Place } from './ui/hud'
import { signBoard } from './world/buildings'
import { SPAWN } from './world/layout'
import { heightAt } from './world/terrain'
import { buildWorld } from './world/world'

const app = document.getElementById('app')!

// ---------- tela de título ----------
const title = document.createElement('div')
title.className = 'title-screen'
title.innerHTML = `
  <div class="title-inner">
    <p class="title-kicker">${profile.name} · ${profile.role}</p>
    <h1>Vila do Portfólio</h1>
    <p class="title-sub">Explore a vila. Cada feixe de luz é um setor do portfólio.</p>
    <button class="btn start" disabled>Carregando…</button>
    <div class="title-controls">
      <span><kbd>WASD</kbd> andar</span><span><kbd>Shift</kbd> correr</span><span><kbd>Espaço</kbd> pular</span>
      <span><kbd>Mouse</kbd> câmera</span><span><kbd>E</kbd> entrar</span><span><kbd>M</kbd> mapa</span>
    </div>
  </div>`
document.body.appendChild(title)

const fade = document.createElement('div')
fade.className = 'fade'
document.body.appendChild(fade)

// ---------- renderer / cena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
app.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.fog = new THREE.Fog(0xf2d9b3, 90, 280)

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.set(0, 40, 90)

scene.add(new THREE.HemisphereLight(0xd6ecff, 0x6b5a3a, 1.25))
const sun = new THREE.DirectionalLight(0xfff0d6, 2.6)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.left = -45
sun.shadow.camera.right = 45
sun.shadow.camera.top = 45
sun.shadow.camera.bottom = -45
sun.shadow.camera.near = 1
sun.shadow.camera.far = 200
sun.shadow.bias = -0.0005
sun.shadow.normalBias = 0.04
scene.add(sun)
scene.add(sun.target)
const SUN_OFFSET = new THREE.Vector3(40, 70, 25)

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// ---------- progresso salvo (setores visitados) ----------
const VISITED_KEY = 'vila-portfolio:visitados'
const loadVisited = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(VISITED_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}
const saveVisited = (ids: Iterable<string>) => {
  try {
    localStorage.setItem(VISITED_KEY, JSON.stringify([...ids]))
  } catch {
    /* sem storage: só não lembra */
  }
}

// Monta o mundo depois do primeiro paint, pra tela de título aparecer na hora
requestAnimationFrame(() => setTimeout(start, 20))

function start() {
  const world = buildWorld(scene)
  const input = new Input(renderer.domElement)
  const player = new PlayerController(camera, world.colliders)
  scene.add(player.character.root)

  // placa "Como jogar" perto da entrada
  const helpPos = { x: 4.8, z: 60 }
  const help = new THREE.Group()
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.8, 0.2), new THREE.MeshStandardMaterial({ color: 0x3f2a1b }))
  post.position.y = 0.9
  post.castShadow = true
  help.add(post)
  const board = signBoard('Como jogar', 0xffffff, 2.4)
  board.position.y = 1.8
  help.add(board)
  help.position.set(helpPos.x, heightAt(helpPos.x, helpPos.z), helpPos.z)
  help.rotation.y = -Math.PI / 2
  scene.add(help)
  world.colliders.circle(helpPos.x, helpPos.z, 0.35)

  const visited = loadVisited()
  const places: Place[] = [
    ...world.sectors.map((s) => ({
      id: s.def.id,
      name: s.def.name,
      place: s.def.place,
      icon: s.def.icon,
      color: s.def.color,
      x: s.def.x,
      z: s.def.z,
      door: s.door,
      facing: s.def.rot + Math.PI,
      visited: visited.has(s.def.id),
    })),
    { id: 'ajuda', name: 'Como jogar', place: 'Placa da entrada', icon: '?', color: 0xffffff, x: helpPos.x, z: helpPos.z, door: { x: helpPos.x - 1.4, z: helpPos.z }, facing: Math.PI / 2, visited: visited.has('ajuda') },
  ]
  for (const s of world.sectors) s.visited = visited.has(s.def.id)

  const hud = new Hud(places, world.colliders)
  hud.onPanelChange = (open) => {
    input.gameplay = !open
    if (open) input.releasePointer()
  }
  hud.onInteractTap = () => input.press('KeyE')
  hud.onJumpTap = () => input.press('Space')
  hud.onTravel = (p) => {
    fade.classList.add('on')
    setTimeout(() => {
      player.teleport(p.door.x, p.door.z, p.facing)
      fade.classList.remove('on')
    }, 350)
  }
  if (input.isTouch) document.body.classList.add('touch')

  player.teleport(SPAWN.x, SPAWN.z, Math.PI)

  let started = false
  const startBtn = title.querySelector<HTMLButtonElement>('.start')!
  startBtn.disabled = false
  startBtn.textContent = 'Começar'
  startBtn.addEventListener('click', () => {
    started = true
    title.classList.add('gone')
    setTimeout(() => title.remove(), 900)
    document.body.classList.add('playing')
    if (!input.isTouch) renderer.domElement.requestPointerLock?.()
    setTimeout(() => hud.showBanner('Vila do Portfólio', 'Bem-vindo, viajante'), 700)
  })
  if (new URLSearchParams(location.search).has('play')) startBtn.click()

  const discovered = new Set<string>()
  const clock = new THREE.Clock()

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05)
    const t = clock.elapsedTime

    if (!started) {
      // câmera de apresentação girando em volta da vila
      const a = t * 0.06
      camera.position.set(Math.sin(a) * 75, 34, Math.cos(a) * 75)
      camera.lookAt(0, 4, -5)
      world.update(dt, t, camera.position)
      sun.position.copy(SUN_OFFSET)
      sun.target.position.set(0, 0, 0)
      renderer.render(scene, camera)
      input.endFrame()
      return
    }

    // atalhos globais
    if (input.consume('KeyM')) hud.toggleMap()
    if (input.consume('Escape')) {
      hud.closePanel()
      hud.closeMap()
    }

    player.update(dt, input, t)
    const pos = player.position

    // local mais próximo da porta
    let near: Place | null = null
    let nearD = 2.8
    for (const p of places) {
      const d = Math.hypot(pos.x - p.door.x, pos.z - p.door.z)
      if (d < nearD) {
        nearD = d
        near = p
      }
    }
    hud.setPrompt(hud.panelOpen || hud.mapOpen ? null : near)
    if (near && input.gameplay && input.consume('KeyE')) {
      hud.openPanel(near)
      if (!near.visited) {
        near.visited = true
        const sector = world.sectors.find((s) => s.def.id === near!.id)
        if (sector) sector.visited = true
        saveVisited(places.filter((p) => p.visited).map((p) => p.id))
      }
    }

    // banner ao chegar perto de um setor pela primeira vez nesta visita
    for (const s of world.sectors) {
      if (discovered.has(s.def.id)) continue
      if (Math.hypot(pos.x - s.def.x, pos.z - s.def.z) < s.def.d / 2 + 9) {
        discovered.add(s.def.id)
        hud.showBanner(s.def.place, s.def.name, s.def.color)
      }
    }

    // sombra do sol acompanha o jogador
    sun.position.copy(pos).add(SUN_OFFSET)
    sun.target.position.copy(pos)

    world.update(dt, t, pos)
    hud.update({ x: pos.x, z: pos.z, facing: player.facingAngle }, t)
    renderer.render(scene, camera)
    input.endFrame()
  })
}
