import type { Colliders } from '../world/colliders'
import { POND, WORLD_RADIUS, distToPath, PATH_WIDTH } from '../world/layout'
import { heightAt } from '../world/terrain'
import { PANELS, esc, type PanelId } from './panels'

export interface Place {
  id: PanelId
  name: string
  place: string
  icon: string
  color: number
  x: number
  z: number
  door: { x: number; z: number }
  facing: number
  visited: boolean
}

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0')

// Extensão do mundo desenhada no mapa grande; o minimapa mostra só a região em volta do jogador
const EXTENT = WORLD_RADIUS + 15
const MINI_EXTENT = 55

export class Hud {
  private root = document.createElement('div')
  private prompt: HTMLElement
  private banner: HTMLElement
  private minimap: HTMLCanvasElement
  private mapBg: HTMLCanvasElement
  private panel: HTMLElement
  private panelBody: HTMLElement
  private mapOverlay: HTMLElement
  private bigMap: HTMLCanvasElement
  private cleanup: (() => void) | null = null
  private bannerTimer = 0
  private openId: PanelId | null = null

  onTravel: (place: Place) => void = () => {}
  onPanelChange: (open: boolean) => void = () => {}
  onInteractTap: () => void = () => {}
  onJumpTap: () => void = () => {}
  onAttackTap: () => void = () => {}

  constructor(private places: Place[], colliders: Colliders) {
    this.root.className = 'hud'
    this.root.innerHTML = `
      <div class="prompt hidden"></div>
      <div class="banner hidden"><span class="banner-sub"></span><span class="banner-title"></span><span class="banner-line"></span></div>
      <div class="minimap-wrap"><canvas class="minimap" width="200" height="200"></canvas><span class="minimap-n">N</span></div>
      <a class="to-site" href="/home">Ver como site</a>
      <div class="hint"><kbd>WASD</kbd> andar · <kbd>Shift</kbd> correr · <kbd>Espaço</kbd> pular · <kbd>F</kbd> combo · <kbd>Espaço+F</kbd> aéreo · <kbd>E</kbd> entrar · <kbd>M</kbd> mapa</div>
      <div class="touch-buttons">
        <button class="tbtn tbtn-e">E</button>
        <button class="tbtn tbtn-jump">⤒</button>
        <button class="tbtn tbtn-attack">⚔</button>
        <button class="tbtn tbtn-map">M</button>
      </div>
      <div class="panel-backdrop hidden">
        <section class="panel" role="dialog" aria-modal="true">
          <header class="panel-head">
            <span class="panel-icon"></span>
            <div><span class="panel-place"></span><h2 class="panel-title"></h2></div>
            <button class="panel-close" aria-label="Fechar">✕</button>
          </header>
          <div class="panel-body"></div>
        </section>
      </div>
      <div class="map-overlay hidden">
        <div class="map-box">
          <header><h2>Mapa da Vila</h2><button class="panel-close map-close" aria-label="Fechar">✕</button></header>
          <div class="map-content">
            <div class="map-canvas-wrap"><canvas class="bigmap" width="560" height="560"></canvas></div>
            <div class="map-list"></div>
          </div>
        </div>
      </div>`
    document.body.appendChild(this.root)

    const q = <T extends HTMLElement>(s: string) => this.root.querySelector<T>(s)!
    this.prompt = q('.prompt')
    this.banner = q('.banner')
    this.minimap = q<HTMLCanvasElement>('.minimap')
    this.panel = q('.panel-backdrop')
    this.panelBody = q('.panel-body')
    this.mapOverlay = q('.map-overlay')
    this.bigMap = q<HTMLCanvasElement>('.bigmap')

    q('.panel .panel-close').addEventListener('click', () => this.closePanel())
    this.panel.addEventListener('mousedown', (e) => {
      if (e.target === this.panel) this.closePanel()
    })
    q('.map-close').addEventListener('click', () => this.closeMap())
    this.mapOverlay.addEventListener('mousedown', (e) => {
      if (e.target === this.mapOverlay) this.closeMap()
    })
    q('.tbtn-e').addEventListener('touchstart', (e) => (e.preventDefault(), this.onInteractTap()))
    q('.tbtn-jump').addEventListener('touchstart', (e) => (e.preventDefault(), this.onJumpTap()))
    q('.tbtn-attack').addEventListener('touchstart', (e) => (e.preventDefault(), this.onAttackTap()))
    q('.tbtn-map').addEventListener('touchstart', (e) => (e.preventDefault(), this.toggleMap()))
    this.bigMap.addEventListener('click', (e) => this.onMapClick(e))

    this.mapBg = this.renderMapBackground(colliders)
  }

  get panelOpen(): boolean {
    return this.openId !== null
  }

  get mapOpen(): boolean {
    return !this.mapOverlay.classList.contains('hidden')
  }

  // ---------- prompt "E - Entrar" ----------
  setPrompt(place: Place | null) {
    if (!place) {
      this.prompt.classList.add('hidden')
      return
    }
    const verb = place.id === 'ajuda' ? 'Ler' : 'Entrar'
    this.prompt.innerHTML = `<kbd>E</kbd><span>${verb}</span><strong style="color:${hex(place.color)}">${esc(place.name)}</strong>`
    this.prompt.classList.remove('hidden')
  }

  // ---------- banner de local descoberto ----------
  showBanner(title: string, sub: string, color = 0xffffff) {
    this.banner.querySelector('.banner-title')!.textContent = title
    this.banner.querySelector('.banner-sub')!.textContent = sub
    ;(this.banner.querySelector('.banner-line') as HTMLElement).style.background = hex(color)
    this.banner.classList.remove('hidden', 'show')
    void this.banner.offsetWidth
    this.banner.classList.add('show')
    window.clearTimeout(this.bannerTimer)
    this.bannerTimer = window.setTimeout(() => this.banner.classList.add('hidden'), 4200)
  }

  // ---------- painéis ----------
  openPanel(place: Place) {
    this.closeMap()
    this.cleanup?.()
    this.openId = place.id
    this.root.querySelector('.panel-icon')!.textContent = place.icon
    ;(this.root.querySelector('.panel-icon') as HTMLElement).style.background = hex(place.color)
    this.root.querySelector('.panel-place')!.textContent = place.place
    this.root.querySelector('.panel-title')!.textContent = place.name
    ;(this.root.querySelector('.panel') as HTMLElement).style.setProperty('--accent', hex(place.color))
    this.panelBody.scrollTop = 0
    this.cleanup = PANELS[place.id](this.panelBody) || null
    this.panel.classList.remove('hidden')
    this.onPanelChange(true)
  }

  closePanel() {
    if (!this.openId) return
    this.cleanup?.()
    this.cleanup = null
    this.openId = null
    this.panel.classList.add('hidden')
    this.onPanelChange(this.mapOpen)
  }

  // ---------- mapa ----------
  toggleMap() {
    if (this.mapOpen) this.closeMap()
    else this.openMap()
  }

  openMap() {
    this.closePanel()
    const list = this.root.querySelector('.map-list')!
    list.innerHTML =
      '<p class="muted small">Clique num local para viajar até a porta.</p>' +
      this.places
        .map(
          (p, i) => `
        <button class="map-item" data-i="${i}">
          <span class="map-dot" style="background:${hex(p.color)}">${p.icon}</span>
          <span><strong>${esc(p.name)}</strong><span class="muted">${esc(p.place)}${p.visited ? ' · visitado' : ''}</span></span>
        </button>`,
        )
        .join('')
    list.querySelectorAll<HTMLButtonElement>('.map-item').forEach((b) =>
      b.addEventListener('click', () => {
        this.closeMap()
        this.onTravel(this.places[Number(b.dataset.i)])
      }),
    )
    this.mapOverlay.classList.remove('hidden')
    this.onPanelChange(true)
  }

  closeMap() {
    if (!this.mapOpen) return
    this.mapOverlay.classList.add('hidden')
    this.onPanelChange(this.panelOpen)
  }

  private onMapClick(e: MouseEvent) {
    const rect = this.bigMap.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * EXTENT * 2 - EXTENT
    const z = ((e.clientY - rect.top) / rect.height) * EXTENT * 2 - EXTENT
    let best: Place | null = null
    let bestD = 8
    for (const p of this.places) {
      const d = Math.hypot(p.x - x, p.z - z)
      if (d < bestD) {
        bestD = d
        best = p
      }
    }
    if (best) {
      this.closeMap()
      this.onTravel(best)
    }
  }

  // Desenha o mapa base (uma vez) amostrando o terreno
  private renderMapBackground(colliders: Colliders): HTMLCanvasElement {
    const size = 480
    const c = document.createElement('canvas')
    c.width = size
    c.height = size
    const ctx = c.getContext('2d')!
    const img = ctx.createImageData(size, size)
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const x = (px / size) * EXTENT * 2 - EXTENT
        const z = (py / size) * EXTENT * 2 - EXTENT
        const h = heightAt(x, z)
        let col: [number, number, number]
        if (Math.hypot(x - POND.x, z - POND.z) < POND.r - 0.5) col = [86, 156, 196]
        else if (h > 5) {
          const k = Math.min(1, (h - 5) / 25)
          col = [150 - k * 40, 140 - k * 40, 125 - k * 35]
        } else if (distToPath(x, z) < PATH_WIDTH) col = [222, 196, 146]
        else {
          const k = h / 4
          col = [120 + k * 18, 168 + k * 14, 92 + k * 10]
        }
        const i = (py * size + px) * 4
        img.data[i] = col[0]
        img.data[i + 1] = col[1]
        img.data[i + 2] = col[2]
        img.data[i + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)

    const s = size / (EXTENT * 2)
    for (const col of colliders.list) {
      if (col.type === 'box') {
        if (col.hw > 20) continue // muro do terraço
        ctx.save()
        ctx.translate((col.x + EXTENT) * s, (col.z + EXTENT) * s)
        ctx.rotate(-col.rot)
        ctx.fillStyle = '#5b4636'
        ctx.fillRect(-col.hw * s, -col.hd * s, col.hw * 2 * s, col.hd * 2 * s)
        ctx.restore()
      } else if (col.r > 0.5) {
        ctx.fillStyle = 'rgba(52, 90, 48, 0.75)'
        ctx.beginPath()
        ctx.arc((col.x + EXTENT) * s, (col.z + EXTENT) * s, Math.max(1.2, Math.min(3, col.r * s * 2.2)), 0, Math.PI * 2)
        ctx.fill()
      }
    }
    // muro do terraço
    ctx.fillStyle = '#7d7468'
    for (const col of colliders.list) {
      if (col.type === 'box' && col.hw > 20) ctx.fillRect((col.x - col.hw + EXTENT) * s, (col.z - col.hd + EXTENT) * s, col.hw * 2 * s, col.hd * 2 * s)
    }
    return c
  }

  private drawMap(canvas: HTMLCanvasElement, player: { x: number; z: number; facing: number }, big: boolean, t: number) {
    const ctx = canvas.getContext('2d')!
    const W = canvas.width
    // mapa grande: mundo inteiro; minimapa: janela centrada no jogador
    const ext = big ? EXTENT : MINI_EXTENT
    const cx = big ? 0 : player.x
    const cz = big ? 0 : player.z
    const s = W / (ext * 2)
    const toX = (x: number) => (x - cx + ext) * s
    const toZ = (z: number) => (z - cz + ext) * s
    ctx.clearRect(0, 0, W, W)
    ctx.save()
    if (!big) {
      ctx.beginPath()
      ctx.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2)
      ctx.clip()
      ctx.fillStyle = '#8a7f74'
      ctx.fillRect(0, 0, W, W)
    }
    const bgScale = this.mapBg.width / (EXTENT * 2)
    ctx.drawImage(this.mapBg, (cx - ext + EXTENT) * bgScale, (cz - ext + EXTENT) * bgScale, ext * 2 * bgScale, ext * 2 * bgScale, 0, 0, W, W)

    for (const p of this.places) {
      const px = toX(p.x)
      const pz = toZ(p.z)
      const r = big ? 15 : 8
      if (!p.visited) {
        ctx.strokeStyle = hex(p.color)
        ctx.globalAlpha = 0.5 + Math.sin(t * 3) * 0.3
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(px, pz, r + 4, 0, Math.PI * 2)
        ctx.stroke()
        ctx.globalAlpha = 1
      }
      ctx.fillStyle = hex(p.color)
      ctx.strokeStyle = '#1b1b1b'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(px, pz, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#1b1b1b'
      ctx.font = `${big ? 16 : 9}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(p.icon, px, pz + 1)
      if (big) {
        ctx.font = '700 13px Nunito, sans-serif'
        ctx.lineWidth = 4
        ctx.strokeStyle = 'rgba(20,20,20,0.85)'
        ctx.strokeText(p.name, px, pz + r + 12)
        ctx.fillStyle = '#fff'
        ctx.fillText(p.name, px, pz + r + 12)
      }
    }

    // jogador: seta apontando pra onde ele olha
    const px = toX(player.x)
    const pz = toZ(player.z)
    ctx.translate(px, pz)
    ctx.rotate(-player.facing + Math.PI)
    const a = big ? 11 : 7
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#d62828'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, -a)
    ctx.lineTo(a * 0.7, a * 0.8)
    ctx.lineTo(0, a * 0.35)
    ctx.lineTo(-a * 0.7, a * 0.8)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  update(player: { x: number; z: number; facing: number }, t: number) {
    this.drawMap(this.minimap, player, false, t)
    if (this.mapOpen) this.drawMap(this.bigMap, player, true, t)
  }
}
