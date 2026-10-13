// Teclado, mouse (pointer lock ou arrastar) e controles de toque, num formato só pro jogo consumir.

export class Input {
  private keys = new Set<string>()
  private pressed = new Set<string>()
  private lookX = 0
  private lookY = 0
  private zoom = 0
  private dragging = false

  // toque
  private joyId: number | null = null
  private joyStart = { x: 0, y: 0 }
  private joy = { x: 0, y: 0 }
  private lookTouchId: number | null = null
  private lookTouchLast = { x: 0, y: 0 }
  private joyEl: HTMLElement
  private joyKnob: HTMLElement

  // desligado quando algum painel está aberto
  gameplay = true

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (!e.repeat) this.pressed.add(e.code)
      this.keys.add(e.code)
      if (this.gameplay && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.code))
    window.addEventListener('blur', () => this.keys.clear())

    canvas.addEventListener('mousedown', (e) => {
      if (!this.gameplay || e.button !== 0) return
      // com o cursor já travado, o clique vira golpe de espada
      if (document.pointerLockElement === canvas) this.pressed.add('Attack')
      this.dragging = true
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.()?.catch?.(() => {})
    })
    window.addEventListener('mouseup', () => (this.dragging = false))
    window.addEventListener('mousemove', (e) => {
      if (!this.gameplay) return
      if (document.pointerLockElement === canvas || this.dragging) {
        this.lookX += e.movementX
        this.lookY += e.movementY
      }
    })
    canvas.addEventListener(
      'wheel',
      (e) => {
        this.zoom += Math.sign(e.deltaY)
        e.preventDefault()
      },
      { passive: false },
    )

    // joystick virtual
    this.joyEl = document.createElement('div')
    this.joyEl.className = 'joystick'
    this.joyKnob = document.createElement('div')
    this.joyKnob.className = 'joystick-knob'
    this.joyEl.appendChild(this.joyKnob)
    document.body.appendChild(this.joyEl)

    canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false })
    canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false })
    canvas.addEventListener('touchend', (e) => this.onTouchEnd(e))
    canvas.addEventListener('touchcancel', (e) => this.onTouchEnd(e))
  }

  get isTouch(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0
  }

  releasePointer() {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock()
    this.dragging = false
  }

  private onTouchStart(e: TouchEvent) {
    e.preventDefault()
    for (const t of Array.from(e.changedTouches)) {
      if (t.clientX < window.innerWidth / 2 && this.joyId === null) {
        this.joyId = t.identifier
        this.joyStart = { x: t.clientX, y: t.clientY }
        this.joyEl.style.left = `${t.clientX}px`
        this.joyEl.style.top = `${t.clientY}px`
        this.joyEl.classList.add('active')
      } else if (this.lookTouchId === null) {
        this.lookTouchId = t.identifier
        this.lookTouchLast = { x: t.clientX, y: t.clientY }
      }
    }
  }

  private onTouchMove(e: TouchEvent) {
    e.preventDefault()
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.joyId) {
        const max = 50
        let dx = t.clientX - this.joyStart.x
        let dy = t.clientY - this.joyStart.y
        const len = Math.hypot(dx, dy)
        if (len > max) {
          dx = (dx / len) * max
          dy = (dy / len) * max
        }
        this.joy = { x: dx / max, y: dy / max }
        this.joyKnob.style.transform = `translate(${dx}px, ${dy}px)`
      } else if (t.identifier === this.lookTouchId) {
        this.lookX += (t.clientX - this.lookTouchLast.x) * 1.6
        this.lookY += (t.clientY - this.lookTouchLast.y) * 1.6
        this.lookTouchLast = { x: t.clientX, y: t.clientY }
      }
    }
  }

  private onTouchEnd(e: TouchEvent) {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.joyId) {
        this.joyId = null
        this.joy = { x: 0, y: 0 }
        this.joyKnob.style.transform = ''
        this.joyEl.classList.remove('active')
      } else if (t.identifier === this.lookTouchId) {
        this.lookTouchId = null
      }
    }
  }

  // botões virtuais (pulo / interagir / golpe) chamam isso
  press(code: string) {
    this.pressed.add(code)
  }

  held(code: string): boolean {
    return this.keys.has(code)
  }

  // eixo de movimento: x = direita, y = frente
  axis(): { x: number; y: number } {
    if (!this.gameplay) return { x: 0, y: 0 }
    let x = 0
    let y = 0
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1
    x += this.joy.x
    y -= this.joy.y
    const len = Math.hypot(x, y)
    if (len > 1) {
      x /= len
      y /= len
    }
    return { x, y }
  }

  get sprint(): boolean {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || Math.hypot(this.joy.x, this.joy.y) > 0.95
  }

  consumeLook(): { x: number; y: number; zoom: number } {
    const r = { x: this.lookX, y: this.lookY, zoom: this.zoom }
    this.lookX = 0
    this.lookY = 0
    this.zoom = 0
    return r
  }

  // true só no frame em que a tecla foi apertada
  consume(code: string): boolean {
    const had = this.pressed.has(code)
    this.pressed.delete(code)
    return had
  }

  endFrame() {
    this.pressed.clear()
  }
}
