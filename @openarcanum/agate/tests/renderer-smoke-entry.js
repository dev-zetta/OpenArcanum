import PIXI from '../src/client/libs/PIXI'
import Scene from '../src/client/Scene'
import Sprite from '../src/client/Sprite'
import Spritesheet from '../src/client/isometric/Spritesheet'
import IsoSprite from '../src/client/isometric/Sprite'
import EventEmitter from '../src/shared/misc/EventEmitter'
import { Filter } from '../src/client/render/Filter'
import RoofLayer from '../src/client/RoofLayer'
import { createAlphaHitArea } from '../src/client/AlphaHitArea'
import { lightingFixture } from './lighting-smoke-fixture'

function check(condition, message) {
  if (!condition) throw new Error(message)
}

async function roofFixture(scene, bitmap) {
  const renderer = scene.pixi.renderer
  const sheet = Spritesheet.newSpritesheet('roof-smoke', bitmap, { frames: {
    'roof-smoke/0': { frame: { x: 0, y: 0, w: 4, h: 8 }, center: { x: -2, y: 1 } },
    'roof-smoke/1': { frame: { x: 4, y: 0, w: 4, h: 8 }, center: { x: -2, y: 1 } }
  } })
  const originalLoad = Sprite.prototype.load
  const layers = []
  try {
    // Stub only decoded atlas acquisition. Placement, anchors, mirroring,
    // connected visibility and display objects use the production roof path.
    Sprite.prototype.load = async function(source) {
      this.meta = source
      this.frame = source.frame
      this.iso.texture = sheet.textures[`roof-smoke/${source.flipped ? 1 : 0}`]
    }
    for (const flipped of [false, true]) {
      const map = { height: 1, rootGroup: scene.newGroup(scene.renderer.layers.base) }
      map.rootGroup.position.set(flipped ? 200 : 180, 150)
      const objects = scene.newGroup(map.rootGroup)
      const backdrop = new PIXI.Sprite(PIXI.Texture.WHITE)
      backdrop.tint = 0x0000ff
      backdrop.position.set(-160, -141)
      backdrop.width = 8
      backdrop.height = 8
      backdrop.eventMode = 'static'
      objects.addChild(backdrop)
      const layer = new RoofLayer(scene, map)
      layers.push({ layer, map, backdrop, flipped })
      await layer.addSector({ id: '0x0', x: 0, y: 0, roofs: [[{
        piece: flipped ? 9 : 0,
        resource: { type: 'Roof', name: 'synthetic', frame: 0, flipped }
      }]] })
    }
  } finally {
    Sprite.prototype.load = originalLoad
  }
  const [normal, mirrored] = layers
  const normalSprite = normal.layer.cells.get('0,0').sprite.iso
  const mirroredSprite = mirrored.layer.cells.get('0,0').sprite.iso
  // CE: normalized center(2,2), entity origin(0,80), roof origin(-160,-140).
  // The fixture camera shifts that origin to(20,10)/(40,10). ART hot(-2,1)
  // then puts ordinary raster at(22,9); mirrored roof hotX=0 gives(40,9).
  check(normalSprite.x === -160 && normalSprite.y === -140,
    `Roof reference point is incorrect: ${normalSprite.x},${normalSprite.y}`)
  check(normalSprite.anchor.x === -0.5 && normalSprite.anchor.y === 0.125,
    'Normal roof lost its original ART hotspot')
  check(mirroredSprite.scale.x === -1 && mirroredSprite.anchor.x === 1 && mirroredSprite.anchor.y === 0.125,
    'Mirrored roof did not apply original hotX=0 placement')
  // Require production to install the alpha-aware hit area; calling the helper
  // separately also checks that anchor/flip transforms do not move its holes.
  check(normalSprite.hitArea && mirroredSprite.hitArea, 'Roof sprites have no alpha-aware hit area')
  const localHit = (sprite, x, y) => {
    const point = sprite.toLocal(new PIXI.Point(x, y))
    return createAlphaHitArea(sprite).contains(point.x, point.y)
  }
  const snapshot = () => {
    scene.renderer.draw(1032, 16)
    const result = renderer.extract.pixels({
      target: scene.pixi.stage, frame: new PIXI.Rectangle(0, 0, 64, 64), resolution: 1
    })
    const at = (x, y) => Array.from(result.pixels.slice((y * result.width + x) * 4,
      (y * result.width + x) * 4 + 4))
    return { normal: at(22, 9), normalHole: at(23, 10), mirrored: at(40, 9), mirroredHole: at(42, 10) }
  }
  const initial = snapshot()
  const equal = (actual, expected) => actual.every((value, i) => Math.abs(value - expected[i]) <= 1)
  check(equal(initial.normal, [255, 0, 0, 255]) && equal(initial.mirrored, [0, 255, 0, 255]),
    `Visible roofs did not draw after objects: ${JSON.stringify(initial)}`)
  check(equal(initial.normalHole, [0, 0, 255, 255]) && equal(initial.mirroredHole, [0, 0, 255, 255]),
    `Roof transparent pixels did not reveal objects: ${JSON.stringify(initial)}`)
  check(localHit(normalSprite, 22.5, 9.5) && !localHit(normalSprite, 23.5, 10.5) &&
    localHit(mirroredSprite, 40.5, 9.5) && !localHit(mirroredSprite, 42.5, 10.5),
    'Roof alpha hit area does not agree with normal/mirrored rendered pixels')
  // EventSystem assigns its root lazily on the first native event. This
  // headless fixture exercises the same boundary against the rendered stage.
  const boundary = new PIXI.EventBoundary(scene.pixi.stage)
  check(boundary.hitTest(22.5, 9.5) === normalSprite && boundary.hitTest(23.5, 10.5) === normal.backdrop &&
    boundary.hitTest(40.5, 9.5) === mirroredSprite && boundary.hitTest(42.5, 10.5) === mirrored.backdrop,
    'Pixi roof hit testing swallowed a transparent pixel or missed an opaque pixel')
  normal.layer.updateVisibility({ x: 2, y: 1 }) // Original x1/y2 is covered by NW outside.
  mirrored.layer.updateVisibility({ x: 1, y: 2 }) // Original x2/y1 is covered by SE outside.
  const hidden = snapshot()
  check(equal(hidden.normal, [0, 0, 255, 255]) && equal(hidden.mirrored, [0, 0, 255, 255]),
    `Indoor player did not uncover objects below roofs: ${JSON.stringify(hidden)}`)
  check(boundary.hitTest(22.5, 9.5) === normal.backdrop && boundary.hitTest(40.5, 9.5) === mirrored.backdrop,
    'Hidden roof still intercepted gameplay input')
  normal.layer.updateVisibility({ x: 1, y: 2 }) // Outside the NW coverage edge, same cell.
  mirrored.layer.updateVisibility({ x: 3, y: 2 }) // Outside the SE coverage edge, same cell.
  const restored = snapshot()
  check(equal(restored.normal, initial.normal) && equal(restored.mirrored, initial.mirrored),
    `Leaving the building did not restore roof artwork: ${JSON.stringify(restored)}`)
  for (const { map } of layers) map.rootGroup.destroy({ children: true })
  for (const key of [...Object.keys(sheet.textures), 'agate:source:roof-smoke']) PIXI.Cache.remove(key)
  for (const texture of Object.values(sheet.textures)) texture.destroy()
  sheet.baseTexture.destroy()
  return { initial, hidden, restored, opaqueAndTransparentClicks: true }
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
  image.width = 12
  image.height = 8
  const context = image.getContext('2d')
  context.fillStyle = '#ff0000'
  context.fillRect(0, 0, 4, 8)
  context.fillStyle = '#00ff00'
  context.fillRect(4, 0, 4, 8)
  context.fillStyle = '#0000ff'
  context.fillRect(8, 0, 4, 8)
  context.clearRect(1, 1, 1, 1)
  context.clearRect(5, 1, 1, 1)
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
    },
    'renderer-smoke/2': {
      frame: { x: 0, y: 0, w: 4, h: 8 },
      trimmed: false
    },
    'renderer-smoke/3': {
      frame: { x: 8, y: 0, w: 4, h: 8 },
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

  // Exercise the real wall/portal placement path. Solid texels must cover
  // earlier artwork; transparent texels must still reveal the layer below.
  const backdrop = new PIXI.Sprite(sheet.textures['renderer-smoke/3'])
  backdrop.position.set(10, 42)
  backdrop.scale.x = 2
  scene.renderer.layers.base.addChild(backdrop)
  for (const [type, texture, x] of [
    ['Wall', 'renderer-smoke/2', 10],
    ['Portal', 'renderer-smoke/1', 12]
  ]) {
    const sprite = new Sprite(scene)
    sprite.meta = { type, stage: 'North' }
    sprite.iso.texture = sheet.textures[texture]
    sprite.addToScene(scene.renderer.layers.base, 0, 0, 0, { x, y: 42 })
  }

  // Insert foreground decoration first, then a horizontally offset wall.
  // Their overlapping pixels must follow ground Y, not load order or X.
  const depthGroup = scene.newGroup(scene.renderer.layers.base)
  const decoration = new Sprite(scene)
  decoration.meta = { type: 'Scenery', stage: 'North' }
  decoration.iso.texture = sheet.textures['renderer-smoke/1']
  decoration.iso.scale.x = 3
  decoration.addToScene(depthGroup, 0, 0, 0, { x: 28, y: 44 })
  const depthWall = new Sprite(scene)
  depthWall.meta = { type: 'Wall', stage: 'North' }
  depthWall.iso.texture = sheet.textures['renderer-smoke/2']
  depthWall.iso.scale.x = 3
  depthWall.addToScene(depthGroup, 0, 0, 0, { x: 35, y: 42 })
  depthGroup.sortChildren()
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
  const samples = { blue: pixel(22, 20), green: pixel(42, 16), transparent: pixel(1, 1),
    wall: pixel(10, 42), portalOverWall: pixel(12, 42),
    wallHole: pixel(11, 43), portalHole: pixel(13, 43),
    foregroundDecoration: pixel(36, 46) }
  check(width === 64 && height === 64, `Unexpected extraction size: ${width}x${height}`)
  check(samples.blue.every((value, i) => Math.abs(value - [0, 0, 255, 255][i]) <= 1), `Custom filter pixel is wrong: ${JSON.stringify({ samples, blue: blue.getBounds(), green: green.getBounds(), source: [sheet.baseTexture.width, sheet.baseTexture.height], viewport: [scene.renderer.viewport.x, scene.renderer.viewport.y, scene.renderer.viewport.scale.x] })}`)
  check(samples.green.every((value, i) => Math.abs(value - [0, 255, 0, 255][i]) <= 1), `Atlas pixel is wrong: ${samples.green}`)
  check(samples.transparent[3] === 0, `Background is not transparent: ${samples.transparent}`)
  for (const [name, expected] of Object.entries({
    wall: [255, 0, 0, 255], portalOverWall: [0, 255, 0, 255],
    wallHole: [0, 0, 255, 255], portalHole: [255, 0, 0, 255],
    foregroundDecoration: [0, 255, 0, 255]
  })) {
    check(samples[name].every((value, i) => Math.abs(value - expected[i]) <= 1),
      `${name} did not preserve solid/transparent artwork: ${samples[name]}`)
  }

  const groundDepth = decoration.iso.zIndex
  decoration.iso.offset.x += 120
  decoration.iso.updateDepth()
  check(decoration.iso.zIndex === groundDepth, 'Horizontal art offset changed ground depth')
  decoration.iso.offset.x -= 120
  decoration.iso.updateDepth()
  const contactPoint = [decoration.iso.x, decoration.iso.y]
  decoration.iso.texture = sheet.textures['renderer-smoke/0']
  decoration.iso.postUpdate()
  check(decoration.iso.anchor.x === 0.25 && decoration.iso.anchor.y === 0.5,
    'Changed frame did not apply its atlas anchor')
  check(decoration.iso.zIndex === groundDepth &&
    contactPoint.every((value, i) => value === [decoration.iso.x, decoration.iso.y][i]),
    'Changing frame dimensions/anchor changed the ground contact point or depth')
  decoration.iso.texture = sheet.textures['renderer-smoke/1']

  // Move the same decoration behind the wall and explicitly exercise Pixi's
  // dirty-depth sorting instead of reconstructing either display object.
  const movement = scene.isometric.projector.unprojectAbsolute({ x: 0, y: -4 })
  decoration.setPosition(movement.x, movement.y)
  depthGroup.sortChildren()
  check(depthGroup.children[0] === decoration.iso && depthGroup.children[1] === depthWall.iso,
    'Moving decoration did not reorder the existing container children')
  scene.renderer.draw(1016, 16)
  const moved = renderer.extract.pixels({
    target: scene.pixi.stage, frame: new PIXI.Rectangle(0, 0, 64, 64), resolution: 1
  })
  samples.movedBehindWall = Array.from(moved.pixels.slice((46 * moved.width + 36) * 4,
    (46 * moved.width + 36) * 4 + 4))
  check(samples.movedBehindWall.every((value, i) => Math.abs(value - [255, 0, 0, 255][i]) <= 1),
    `Moving decoration remained above the wall: ${samples.movedBehindWall}`)
  const roofs = await roofFixture(scene, bitmap)
  const lighting = lightingFixture(renderer)
  const glError = gl.getError()
  check(glError === gl.NO_ERROR, `WebGL draw/extraction error: ${glError}`)
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
  const report = {
    pixi: PIXI.VERSION,
    webgl: gl.getParameter(gl.VERSION),
    gpu: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    size: { width, height },
    samples,
    roofs,
    lighting,
    glError,
    viewport: scene.renderer.viewport.constructor.name
  }
  scene.pixi.destroy(true, { children: true })
  for (const key of [...Object.keys(sheet.textures), 'agate:source:renderer-smoke']) PIXI.Cache.remove(key)
  for (const texture of Object.values(sheet.textures)) texture.destroy()
  sheet.baseTexture.destroy()
  bitmap.close()
  return report
}
