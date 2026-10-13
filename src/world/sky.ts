import * as THREE from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { cityUniforms } from './city/materials'

const { smoothstep, lerp } = THREE.MathUtils

// Ciclo dia/noite: céu físico, sol e lua, luz ambiente, névoa, estrelas e reflexos (environment map)
export class DayNight {
  hours = 17.3 // começa no fim da tarde: dá pra ver o pôr do sol e a cidade acendendo
  dayLength = 8 * 60 // segundos por dia
  night = 0
  readonly sun = new THREE.DirectionalLight(0xffffff, 3)
  readonly hemi = new THREE.HemisphereLight(0xbcd7ff, 0x5b5048, 0.8)
  private sky = new Sky()
  private stars: THREE.Points
  private moon: THREE.Mesh
  private glow: THREE.Mesh
  private pmrem: THREE.PMREMGenerator
  private envScene = new THREE.Scene()
  private envTarget: THREE.WebGLRenderTarget | null = null
  private lastEnvHours = -99
  private sunDir = new THREE.Vector3()
  private fog = new THREE.FogExp2(0xbfd1e5, 0.0034)
  private envSkyMat: THREE.ShaderMaterial

  constructor(
    private scene: THREE.Scene,
    private renderer: THREE.WebGLRenderer,
  ) {
    this.sky.scale.setScalar(500)
    // o disco do sol sai com brilho ~10 milhões: passa do máximo da imagem HDR (65504) e vira "infinito",
    // que o bloom espalha pela tela inteira (tela preta ao olhar pro sol). Limita aqui na origem.
    this.sky.material.fragmentShader = this.sky.material.fragmentShader.replace(
      '#include <tonemapping_fragment>',
      'gl_FragColor.rgb = min(gl_FragColor.rgb, vec3(16.0));\n#include <tonemapping_fragment>',
    )
    const u = this.sky.material.uniforms
    u.turbidity.value = 7
    u.rayleigh.value = 1.6
    u.mieCoefficient.value = 0.005
    u.mieDirectionalG.value = 0.82
    scene.add(this.sky)
    scene.fog = this.fog

    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    const sc = this.sun.shadow.camera
    sc.left = sc.bottom = -60
    sc.right = sc.top = 60
    sc.near = 1
    sc.far = 260
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.05
    scene.add(this.sun, this.sun.target, this.hemi)

    // estrelas
    const starPos: number[] = []
    for (let i = 0; i < 900; i++) {
      const v = new THREE.Vector3().randomDirection()
      if (v.y < 0.05) v.y = Math.abs(v.y) + 0.05
      v.normalize().multiplyScalar(470)
      starPos.push(v.x, v.y, v.z)
    }
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3))
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }))
    scene.add(this.stars)

    this.moon = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 12), new THREE.MeshBasicMaterial({ color: 0xf3f0e6, fog: false, transparent: true }))
    scene.add(this.moon)

    // brilho alaranjado da cidade no horizonte (poluição luminosa de Tóquio à noite)
    this.glow = new THREE.Mesh(
      new THREE.SphereGeometry(460, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        fog: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uStrength: { value: 0 } },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform float uStrength; varying vec3 vDir;
          void main(){ float h = clamp(vDir.y, 0.0, 1.0);
            vec3 c = mix(vec3(0.55,0.32,0.38), vec3(0.08,0.07,0.2), smoothstep(0.0, 0.35, h));
            gl_FragColor = vec4(c * (1.0 - smoothstep(0.0, 0.6, h)) * uStrength, 1.0); }`,
      }),
    )
    scene.add(this.glow)

    // cena só com o céu, pra gerar o mapa de reflexos
    this.pmrem = new THREE.PMREMGenerator(renderer)
    this.envSkyMat = this.sky.material.clone()
    this.envSkyMat.uniforms.showSunDisc.value = 0
    const envSky = new THREE.Mesh(this.sky.geometry, this.envSkyMat)
    envSky.scale.setScalar(500)
    this.envScene.add(envSky)
  }

  get clock(): string {
    const h = Math.floor(this.hours)
    const m = Math.floor((this.hours - h) * 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  advance(hours: number) {
    this.hours = (this.hours + hours + 24) % 24
  }

  update(dt: number, focus: THREE.Vector3) {
    this.advance((dt / this.dayLength) * 24)

    // sol: nasce no leste (+x) às 6h, se põe no oeste às 18h, passando pelo sul (+z)
    const theta = ((this.hours - 6) / 12) * Math.PI
    this.sunDir.set(Math.cos(theta), Math.sin(theta) * 0.92, 0.42).normalize()
    const sunY = this.sunDir.y
    this.night = 1 - smoothstep(sunY, -0.14, 0.06)
    const twilight = 1 - smoothstep(Math.abs(sunY - 0.02), 0, 0.22) // perto do horizonte
    cityUniforms.uNight.value = this.night

    this.sky.material.uniforms.sunPosition.value.copy(this.sunDir).multiplyScalar(450)
    this.sky.material.uniforms.rayleigh.value = lerp(1.6, 0.4, this.night)

    // luz principal: sol de dia, lua de noite (sempre vinda de cima)
    const lightDir = sunY > -0.02 ? this.sunDir.clone() : this.sunDir.clone().negate().setY(Math.abs(this.sunDir.y) + 0.35).normalize()
    this.sun.position.copy(focus).addScaledVector(lightDir, 120)
    this.sun.target.position.copy(focus)
    const day = smoothstep(sunY, -0.02, 0.25)
    const sunColor = new THREE.Color(0xffa860).lerp(new THREE.Color(0xfff4e2), smoothstep(sunY, 0.05, 0.45))
    this.sun.color.copy(sunY > -0.02 ? sunColor : new THREE.Color(0x9db4ff))
    this.sun.intensity = sunY > -0.02 ? 0.35 + day * 2.1 : 0.4

    this.hemi.color.set(0xbcd7ff).lerp(new THREE.Color(0x1b2443), this.night)
    this.hemi.groundColor.set(0x5b5048).lerp(new THREE.Color(0x0b0b12), this.night)
    this.hemi.intensity = lerp(0.7, 0.45, this.night)

    // névoa da cor do horizonte: azul de dia, laranja no pôr do sol, azul-marinho à noite
    const fogDay = new THREE.Color(0xc3d3e3)
    const fogDusk = new THREE.Color(0xd99a72)
    const fogNight = new THREE.Color(0x141626)
    this.fog.color.copy(fogDay).lerp(fogDusk, twilight * (1 - this.night * 0.6)).lerp(fogNight, this.night)
    this.fog.density = lerp(0.0028, 0.0042, this.night)

    ;(this.stars.material as THREE.PointsMaterial).opacity = smoothstep(this.night, 0.6, 1) * 0.9
    this.stars.position.copy(focus).setY(0)
    const moonDir = this.sunDir.clone().negate()
    this.moon.position.copy(focus).setY(0).addScaledVector(moonDir, 440)
    ;(this.moon.material as THREE.MeshBasicMaterial).opacity = smoothstep(moonDir.y, -0.05, 0.1)
    ;(this.glow.material as THREE.ShaderMaterial).uniforms.uStrength.value = this.night * 0.85
    this.glow.position.copy(focus).setY(0)
    this.sky.position.copy(focus).setY(0)

    this.renderer.toneMappingExposure = lerp(0.68, 0.95, this.night)
    this.scene.environmentIntensity = lerp(0.7, 0.3, this.night)

    // reflexos: refaz o mapa de ambiente quando o céu muda o bastante
    if (Math.abs(this.hours - this.lastEnvHours) > 0.15) {
      this.lastEnvHours = this.hours
      for (const k of ['sunPosition', 'rayleigh', 'turbidity', 'mieCoefficient', 'mieDirectionalG'] as const) {
        const v = this.sky.material.uniforms[k].value
        this.envSkyMat.uniforms[k].value = v instanceof THREE.Vector3 ? v.clone() : v
      }
      const old = this.envTarget
      this.envTarget = this.pmrem.fromScene(this.envScene, 0, 1, 1000)
      this.scene.environment = this.envTarget.texture
      old?.dispose()
    }
  }
}
