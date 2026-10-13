import * as THREE from 'three'
import './style.css'
import { profile } from './content'
import { Input } from './input'
import { PlayerController } from './player/controller'
import { Hud, type Place } from './ui/hud'
import { setMaxAnisotropy } from './world/city/materials'
import { HELP_SIGN, SPAWN } from './world/layout'
import { GroundMarks } from './world/marks'
import { ImpactEffects } from './world/effects'
import { SwordTrail } from './player/trail'
import { createPostFX } from './world/postfx'
import { buildWorld } from './world/world'

const app = document.getElementById('app')!

// ---------- tela de título ----------
const title = document.createElement('div')
title.className = 'title-screen'
title.innerHTML = `
  <div class="title-inner">
    <p class="title-kicker">${profile.name} · ${profile.role}</p>
    <h1>Portfólio em Tóquio</h1>
    <p class="title-sub">Explore Shibuya. Cada feixe de luz é um setor do portfólio.</p>
    <button class="btn start" disabled>Carregando…</button>
    <a class="title-site" href="/home">Prefiro ver como site →</a>
    <div class="title-controls">
      <span><kbd>WASD</kbd> andar</span><span><kbd>Shift</kbd> correr</span><span><kbd>Espaço</kbd> pular</span>
      <span><kbd>F</kbd> espada</span><span><kbd>Espaço</kbd> na parede: escalar</span>
      <span><kbd>Mouse</kbd> câmera</span><span><kbd>E</kbd> entrar</span><span><kbd>M</kbd> mapa</span>
    </div>
  </div>`
document.body.appendChild(title)

const fade = document.createElement('div')
fade.className = 'fade'
document.body.appendChild(fade)

// ---------- renderer / cena ----------
// o antisserrilhado é feito no pós-processamento (MSAA no alvo HDR)
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.localClippingEnabled = true // corte dos objetos pela espada
setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy())
app.appendChild(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1200)
camera.position.set(0, 40, 90)
// ?leve: sem pós-processamento (mais rápido em computadores fracos)
const LIGHT_MODE = new URLSearchParams(location.search).has('leve')
const postFX = LIGHT_MODE ? null : createPostFX(renderer, scene, camera)
const post = {
  render: () => (postFX ? postFX.render() : renderer.render(scene, camera)),
  setNight: (n: number) => postFX?.setNight(n),
  setSize: (w: number, h: number) => postFX?.setSize(w, h),
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  post.setSize(window.innerWidth, window.innerHeight)
})
post.setSize(window.innerWidth, window.innerHeight)

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
  const world = buildWorld(scene, renderer)
  const input = new Input(renderer.domElement)
  const player = new PlayerController(camera, world.colliders)
  scene.add(player.character.root)
  const marks = new GroundMarks(scene)
  const effects = new ImpactEffects()
  scene.add(effects.group)
  const trail = new SwordTrail()
  scene.add(trail.mesh)
  const bladeBase = new THREE.Vector3()
  const bladeTip = new THREE.Vector3()
  player.character.onGroundMark = (m) => marks.add(m)
  player.character.onImpact = (hit) => {
    effects.burst(hit.x, hit.y, hit.z, hit.strength)
    player.shake(hit.strength * (hit.crater ? 0.9 : 0.45))
    if (hit.crater) marks.crater(hit.x, hit.z, 1.6)
  }

  // quadro "Como jogar" fica na praça (montado em world.ts)
  const helpPos = HELP_SIGN

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
    { id: 'ajuda', name: 'Como jogar', place: 'Placa da entrada', icon: '?', color: 0xffffff, x: helpPos.x, z: helpPos.z, door: { x: helpPos.x - 1.2, z: helpPos.z }, facing: Math.PI / 2, visited: visited.has('ajuda') },
  ]
  for (const s of world.sectors) s.visited = visited.has(s.def.id)

  const hud = new Hud(places, world.colliders, world.mapColor)
  hud.onPanelChange = (open) => {
    input.gameplay = !open
    if (open) input.releasePointer()
  }
  hud.onInteractTap = () => input.press('KeyE')
  hud.onJumpTap = () => input.press('Space')
  hud.onAttackTap = () => input.press('Attack')
  hud.onTravel = (p) => {
    fade.classList.add('on')
    setTimeout(() => {
      player.teleport(p.door.x, p.door.z, p.facing)
      fade.classList.remove('on')
    }, 350)
  }
  if (input.isTouch) document.body.classList.add('touch')

  player.teleport(SPAWN.x, SPAWN.z, SPAWN.yaw)

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
    setTimeout(() => hud.showBanner('Shibuya', 'Bem-vindo a Tóquio'), 700)
  })
  const params = new URLSearchParams(location.search)
  if (params.has('play')) startBtn.click()
  // vindo do site (?setor=projetos): começa em frente àquele lugar
  const target = places.find((p) => p.id === params.get('setor'))
  if (target) player.teleport(target.door.x, target.door.z, target.facing)
  // ?debug&pos=x,z,yaw: começa num ponto qualquer (pra testar)
  const pos = params.get('pos')?.split(',').map(Number)
  if (params.has('debug') && pos && pos.length >= 2 && pos.every(Number.isFinite)) player.teleport(pos[0], pos[1], pos[2] ?? 0)
  // ?debug&hora=21: começa nesse horário
  const hour = Number(params.get('hora'))
  if (params.has('debug') && params.has('hora') && Number.isFinite(hour)) world.dayNight.hours = hour % 24

  const discovered = new Set<string>()
  const prevTip = new THREE.Vector3()
  const focus = new THREE.Vector3()
  const timer = new THREE.Timer()
  timer.connect(document) // pausa o tempo quando a aba fica escondida
  // ?debug: chamadas de desenho, triângulos e FPS no console a cada 3 s
  const debug = params.has('debug')
  let frames = 0
  let lastLog = 0

  renderer.setAnimationLoop(() => {
    timer.update()
    const dt = Math.min(timer.getDelta(), 0.05)
    const t = timer.getElapsed()
    if (debug) {
      renderer.info.autoReset = false
      frames++
      if (t - lastLog > 3) {
        const r = renderer.info.render
        console.log(`[debug] ${(frames / (t - lastLog)).toFixed(0)} fps · ${r.calls} draw calls · ${(r.triangles / 1000).toFixed(0)}k triângulos · hora ${world.dayNight.clock}`)
        frames = 0
        lastLog = t
      }
      renderer.info.reset() // soma todas as passadas (cena + bloom) do quadro
    }

    if (!started) {
      // câmera de apresentação girando em volta do cruzamento
      const a = t * 0.05
      camera.position.set(Math.sin(a) * 70, 38, Math.cos(a) * 70)
      camera.lookAt(0, 8, 0)
      world.update(dt, t, focus.set(0, 0, 0))
      post.setNight(world.dayNight.night)
      post.render()
      input.endFrame()
      return
    }

    // atalhos globais
    if (input.consume('KeyM')) hud.toggleMap()
    if (input.consume('KeyT')) world.dayNight.advance(1) // adianta uma hora
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

    world.update(dt, t, pos)
    marks.update(dt)
    effects.update(dt)
    player.character.bladeSegment(bladeBase, bladeTip)
    const slicing = player.character.trailActive
    trail.update(dt, bladeBase, bladeTip, slicing)
    // espada passando por um objeto cortável: corta no plano do golpe
    if (slicing) {
      const cut = world.cuttables.check(bladeBase, bladeTip, prevTip, pos)
      if (cut) {
        effects.burst(cut.x, cut.y, cut.z, 0.15)
        player.character.hitPause(0.05)
        player.shake(0.12)
      }
    }
    prevTip.copy(bladeTip)
    hud.update({ x: pos.x, z: pos.z, facing: player.facingAngle }, t)
    hud.setClock(world.dayNight.clock)
    post.setNight(world.dayNight.night)
    post.render()
    input.endFrame()
  })
}
