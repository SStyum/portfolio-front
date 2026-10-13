import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

// Pós-processamento: render em HDR com antisserrilhado (MSAA), brilho nas luzes fortes (bloom) e saída tonemapeada
export function createPostFX(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2())
  // MSAA no alvo HDR; desligado em renderizador por software (SwiftShader), que mostra tela preta com ele
  const gl = renderer.getContext()
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  const gpu = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : ''
  const samples = /swiftshader|llvmpipe|software/i.test(gpu) ? 0 : Math.min(4, renderer.capabilities.maxSamples)
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples })
  const composer = new EffectComposer(renderer, target)
  composer.addPass(new RenderPass(scene, camera))
  // proteção antes do bloom: pixel inválido (NaN/infinito) vira preto e o brilho é limitado,
  // senão um único reflexo estourado se espalha pela tela inteira no desfoque do bloom
  composer.addPass(
    new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tDiffuse, vUv);
          // clamp primeiro: funciona em qualquer placa (isnan/isinf podem sumir na otimização do driver)
          c.rgb = clamp(c.rgb, 0.0, 40.0);
          // NaN é o único valor diferente de si mesmo
          if (c.r != c.r || c.g != c.g || c.b != c.b) c.rgb = vec3(0.0);
          gl_FragColor = vec4(c.rgb, 1.0);
        }`,
    }),
  )
  // o limiar acompanha o dia: de dia só o que é bem mais forte que uma parede ao sol estoura;
  // à noite a cena é escura e o limiar desce pra pegar neon, janelas e faróis
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.12, 0.4, 3)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  return {
    render() {
      composer.render()
    },
    setNight(night: number) {
      bloom.strength = 0.1 + night * 0.28
      bloom.threshold = THREE.MathUtils.lerp(3, 1.5, night)
    },
    setSize(w: number, h: number) {
      composer.setPixelRatio(renderer.getPixelRatio())
      composer.setSize(w, h)
    },
  }
}
