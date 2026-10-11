import PIXI from '../src/client/libs/PIXI'
import Scene from '../src/client/Scene'
import Spritesheet from '../src/client/isometric/Spritesheet'
import IsoSprite from '../src/client/isometric/Sprite'
import EventEmitter from '../src/shared/misc/EventEmitter'
import { Filter } from '../src/client/render/Filter'

function check(condition, message) {
  if (!condition) throw new Error(message)
}

export async function runSmoke() {
  globalThis.lll = console.warn
  globalThis.lle = console.error
  globalThis.AGate = { getAppPath: name => `/unused-smoke-data/${name}` }
  const client = {
    options: { scheduler: 'synthetic-smoke' },
    gameEngine: {
      events: new EventEmitter(),
      assetLoader: { isFileExists: () => false },
      world: { objects: {} }
    },
    getWindowRect: () => ({ width: 64, height: 64 })
  }
  const scene = new Scene(client)
  client.scene = scene
  // Exercise the real Scene/PixiRenderer startup with a synthetic atlas below.
  scene.loadAssets = async () => {}
  await scene.create(document.querySelector('canvas'))
  const renderer = scene.pixi.renderer
  const gl = renderer.gl
  check(gl, 'Scene did not create a WebGL renderer')
  check(gl.getError() === gl.NO_ERROR, 'WebGL startup reported an error')

  const image = document.createElement('canvas')
  image.width = image.height = 8
  const context = image.getContext('2d')
  context.fillStyle = '#ff0000'
  context.fillRect(0, 0, 4, 8)
  context.fillStyle = '#00ff00'
  context.fillRect(4, 0, 4, 8)
  const bitmap = await createImageBitmap(image)
  const sheet = Spritesheet.newSpritesheet('renderer-smoke', bitmap, { frames: {
    'renderer-smoke/0': {
      frame: { x: 0, y: 0, w: 4, h: 8 },
      sourceSize: { w: 8, h: 8 },
      spriteSourceSize: { x: 2, y: 0 },
      anchor: { x: 0.25, y: 0.5 }
    },
    'renderer-smoke/1': {
      frame: { x: 4, y: 0, w: 4, h: 8 },
      trimmed: false
    }
  } })

  const blue = new IsoSprite(scene.isometric)
  blue.setTexture('renderer-smoke/0')
  blue.position.set(20, 24)
  blue.scale.set(2)
  check(blue.anchor.x === 0.25 && blue.anchor.y === 0.5, 'Atlas anchor was lost')
  const filter = new Filter('#include default', `#include header
    void main(void) {
      vec4 sampleColor = texture(uSampler, vTextureCoord);
      outFragColor = vec4(0.0, 0.0, sampleColor.r * iTime, sampleColor.a);
    }
  `)
  const program = gl.createProgram()
  const shaders = []
  for (const [name, type] of [['vertex', gl.VERTEX_SHADER], ['fragment', gl.FRAGMENT_SHADER]]) {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, filter.glProgram[name])
    gl.compileShader(shader)
    const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS)
    const message = gl.getShaderInfoLog(shader)
    gl.attachShader(program, shader)
    shaders.push(shader)
    check(compiled, `Custom ${name} shader did not compile: ${message}`)
  }
  gl.linkProgram(program)
  const linked = gl.getProgramParameter(program, gl.LINK_STATUS)
  const linkMessage = gl.getProgramInfoLog(program)
  gl.deleteProgram(program)
  for (const shader of shaders) gl.deleteShader(shader)
  check(linked, `Custom shader program did not link: ${linkMessage}`)
  blue.filters = [filter]
  const green = new IsoSprite(scene.isometric)
  green.setTexture('renderer-smoke/1')
  green.position.set(40, 12)
  green.scale.set(2)
  scene.renderer.layers.base.addChild(blue, green)
  scene.renderer.draw(1000, 16)
  scene.renderer.updateShader(filter)
  // Built-in Pixi filters have separate uniform groups and must remain usable.
  scene.renderer.updateShader(scene.renderer.getShader('GlowFilter'))
  scene.renderer.draw(1000, 16)

  const extracted = renderer.extract.pixels({
    target: scene.pixi.stage,
    frame: new PIXI.Rectangle(0, 0, 64, 64),
    resolution: 1
  })
  const { pixels, width, height } = extracted
  const pixel = (x, y) => Array.from(pixels.slice((y * width + x) * 4, (y * width + x) * 4 + 4))
  const samples = { blue: pixel(22, 20), green: pixel(42, 16), transparent: pixel(1, 1) }
  check(width === 64 && height === 64, `Unexpected extraction size: ${width}x${height}`)
  check(samples.blue.every((value, i) => Math.abs(value - [0, 0, 255, 255][i]) <= 1), `Custom filter pixel is wrong: ${JSON.stringify({ samples, blue: blue.getBounds(), green: green.getBounds(), source: [sheet.baseTexture.width, sheet.baseTexture.height], viewport: [scene.renderer.viewport.x, scene.renderer.viewport.y, scene.renderer.viewport.scale.x] })}`)
  check(samples.green.every((value, i) => Math.abs(value - [0, 255, 0, 255][i]) <= 1), `Atlas pixel is wrong: ${samples.green}`)
  check(samples.transparent[3] === 0, `Background is not transparent: ${samples.transparent}`)
  const glError = gl.getError()
  check(glError === gl.NO_ERROR, `WebGL draw/extraction error: ${glError}`)
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
  const report = {
    pixi: PIXI.VERSION,
    webgl: gl.getParameter(gl.VERSION),
    gpu: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    size: { width, height },
    samples,
    glError,
    viewport: scene.renderer.viewport.constructor.name
  }
  scene.pixi.destroy(true, { children: true })
  for (const key of ['renderer-smoke/0', 'renderer-smoke/1', 'agate:source:renderer-smoke']) PIXI.Cache.remove(key)
  for (const texture of Object.values(sheet.textures)) texture.destroy()
  sheet.baseTexture.destroy()
  bitmap.close()
  return report
}
