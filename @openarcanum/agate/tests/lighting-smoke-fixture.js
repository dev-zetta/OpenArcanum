import PIXI from '../src/client/libs/PIXI'
import LightLayer from '../src/client/LightLayer'

function check(condition, message) {
  if (!condition) throw new Error(message)
}

function close(actual, expected, label) {
  check(actual.every((value, index) => Math.abs(value - expected[index]) <= 2),
    `${label}: expected ${expected}, received ${actual}`)
}

export function lightingFixture(renderer) {
  const originalSize = { width: renderer.screen.width, height: renderer.screen.height }
  const root = new PIXI.Container()
  const viewport = new PIXI.Container()
  const target = new PIXI.Container()
  root.addChild(viewport)
  viewport.addChild(target)
  // Keep the target small and away from(0,0), so sampling a cropped filter
  // texture as if it filled the screen cannot accidentally pass.
  const art = document.createElement('canvas')
  art.width = 16
  art.height = 12
  const artContext = art.getContext('2d')
  artContext.fillStyle = '#ffffff'
  artContext.fillRect(0, 0, 16, 12)
  artContext.clearRect(8, 5, 1, 1)
  artContext.clearRect(10, 5, 1, 1)
  artContext.fillStyle = 'rgba(255,255,255,0.5)'
  artContext.fillRect(10, 5, 1, 1)
  artContext.fillStyle = 'rgb(200,120,80)'
  artContext.fillRect(4, 4, 1, 1)
  const artworkTexture = PIXI.Texture.from(art)
  const artwork = new PIXI.Sprite(artworkTexture)
  artwork.position.set(13, 9)
  target.addChild(artwork)
  const existingFilter = new PIXI.AlphaFilter({ alpha: 1 })
  target.filters = [existingFilter]
  const lights = new LightLayer({ renderer, viewport, target, ambient: [32, 48, 64] })

  // The world retains one depth-sorted object group. Self-lit additive art
  // stays between ordinary lit objects without becoming part of their filter.
  const objects = new PIXI.Container()
  objects.sortableChildren = true
  viewport.addChild(objects)
  const backObject = new PIXI.Sprite(PIXI.Texture.WHITE)
  backObject.position.set(31, 9)
  backObject.width = 12
  backObject.height = 8
  backObject.zIndex = 0
  const emitter = new PIXI.Sprite(PIXI.Texture.WHITE)
  emitter.position.set(35, 9)
  emitter.width = 8
  emitter.height = 8
  emitter.tint = 0x78280a // Original source color120,40,10, unaffected by ambient.
  emitter.blendMode = 'add'
  emitter.zIndex = 1
  const foreground = new PIXI.Sprite(PIXI.Texture.WHITE)
  foreground.position.set(39, 9)
  foreground.width = 4
  foreground.height = 8
  foreground.zIndex = 2
  const objectFilter = new PIXI.AlphaFilter({ alpha: 1 })
  foreground.filters = [objectFilter]
  objects.addChild(foreground, emitter, backObject)
  objects.sortChildren()
  const sourceOrder = objects.children.slice()
  check(lights.addTarget(backObject) === backObject && lights.addTarget(foreground) === foreground,
    'Per-object light registration did not return the existing sprite')
  lights.addTarget(backObject) // Duplicate registration must not darken twice.
  check(backObject.filters.length === 1 && foreground.filters.length === 2 &&
    lights.diagnostics.targets === 3 && !emitter.filters?.length,
    'Per-object light registration duplicated a filter or included self-lit art')
  check(sourceOrder.every((sprite, index) => objects.children[index] === sprite) &&
    objects.children[0] === backObject && objects.children[1] === emitter && objects.children[2] === foreground,
    'Lighting registration changed the original object depth/source order')

  const mask = document.createElement('canvas')
  mask.width = 8
  mask.height = 8
  const maskContext = mask.getContext('2d')
  maskContext.fillStyle = 'rgb(128,128,128)'
  maskContext.fillRect(0, 0, 8, 8)
  maskContext.fillStyle = 'rgb(64,64,64)'
  maskContext.fillRect(0, 0, 1, 1)
  maskContext.fillStyle = '#ffffff'
  maskContext.fillRect(3, 3, 1, 1)
  maskContext.clearRect(1, 1, 1, 1)
  const maskTexture = PIXI.Texture.from(mask)
  const sample = (coordinates) => {
    lights.update()
    renderer.render({ container: root, clear: true })
    const result = renderer.extract.pixels({ target: root,
      frame: new PIXI.Rectangle(0, 0, renderer.screen.width, renderer.screen.height), resolution: 1 })
    return Object.fromEntries(Object.entries(coordinates).map(([name, [x, y]]) =>
      [name, Array.from(result.pixels.slice((y * result.width + x) * 4,
        (y * result.width + x) * 4 + 4))]))
  }
  const coordinates = { gray: [15, 11], full: [16, 12], edge: [13, 9], maskHole: [14, 10],
    artworkHole: [21, 14], translucent: [23, 14], coloredArt: [17, 13],
    normalObject: [32, 11], unlitEmitter: [36, 11], litForeground: [40, 11] }
  const checkObjects = (pixels, label) => {
    close(pixels.normalObject, [32, 48, 64, 255], `${label} normal object ambient`)
    close(pixels.unlitEmitter, [152, 88, 74, 255], `${label} additive emitter bypass`)
    close(pixels.litForeground, [32, 48, 64, 255], `${label} foreground occludes emitter`)
  }
  const sampledTextures = []
  let sampledFilter
  try {
    const ambient = sample(coordinates)
    close(ambient.gray, [32, 48, 64, 255], 'Ambient-only white artwork')
    close(ambient.coloredArt, [25, 23, 20, 255], 'Ambient multiplication of colored artwork')
    checkObjects(ambient, 'Initial object depth')
    check(ambient.artworkHole[3] === 0 && Math.abs(ambient.translucent[3] - 128) <= 1,
      `Ambient pass changed artwork alpha: ${JSON.stringify(ambient)}`)

    // Independent world-point witness: tile(1,0) projects to(40,20), pixel
    // offset(-24,-9) gives(16,11), and hotspot(3,2) makes raster top-left(13,9).
    const first = lights.addLight({ location: [1, 0], offset: [-24, -9], flags: 0,
      rgb: [100, 120, 140], resource: { name: 'synthetic-gray' } }, maskTexture, { x: 3, y: 2 })
    check(first.position.x === 16 && first.position.y === 11 && first.anchor.x === 3 / 8 && first.anchor.y === 2 / 8,
      'Original light location, pixel offset or ART hotspot was lost')
    const one = sample(coordinates)
    close(one.gray, [82, 108, 134, 255], '128/255 grayscale light falloff')
    close(one.full, [132, 168, 204, 255], 'White mask source RGB')
    close(one.edge, [57, 78, 99, 255], '64/255 grayscale light falloff')
    close(one.maskHole, [32, 48, 64, 255], 'Transparent light mask texel')
    checkObjects(one, 'Point-light object depth')
    check(one.artworkHole[3] === 0 && one.translucent[3] === ambient.translucent[3],
      'A point light painted transparent artwork or changed its alpha')

    lights.addLight({ location: [1, 0], offset: [-24, -9], flags: 0,
      rgb: [160, 120, 100], resource: { name: 'synthetic-overlap' } }, maskTexture, [3, 2])
    const overlap = sample(coordinates)
    close(overlap.gray, [163, 168, 185, 255], 'Additive light overlap')
    close(overlap.full, [255, 255, 255, 255], 'Light overlap saturation')
    checkObjects(overlap, 'Overlapping-light object depth')
    const skipped = lights.addLight({ location: [1, 0], flags: 8, rgb: [255, 0, 0],
      resource: { name: 'unsupported-flags' } }, maskTexture, [3, 2])
    check(skipped === null && lights.diagnostics.rendered === 2 && lights.diagnostics.skipped === 1 &&
      lights.diagnostics.skippedReasons[0].flags === 8,
      `Unsupported flags were silently rendered: ${JSON.stringify(lights.diagnostics)}`)

    // Change the entire viewport affine transform. Lights must track the art
    // without being baked into the previous screen-space texture coordinates.
    viewport.position.set(5, 7)
    viewport.scale.set(2)
    const camera = sample({ gray: [36, 30], full: [38, 32], maskHole: [34, 28], artworkHole: [48, 36],
      normalObject: [70, 30], unlitEmitter: [78, 30], litForeground: [86, 30] })
    close(camera.gray, overlap.gray, 'Camera zoom/translation light alignment')
    close(camera.full, overlap.full, 'Camera zoom full mask texel')
    close(camera.maskHole, overlap.maskHole, 'Camera zoom transparent mask texel')
    check(camera.artworkHole[3] === 0, 'Camera transform changed transparent artwork')
    checkObjects(camera, 'Camera zoom object depth')
    viewport.position.set(8, 3)
    const moved = sample({ gray: [39, 26], full: [41, 28],
      normalObject: [73, 26], unlitEmitter: [81, 26], litForeground: [89, 26] })
    close(moved.gray, overlap.gray, 'Moved camera light alignment')
    close(moved.full, overlap.full, 'Moved camera full mask texel')
    checkObjects(moved, 'Moved camera object depth')
    renderer.resize(96, 80)
    const resized = sample({ gray: [39, 26], full: [41, 28],
      normalObject: [73, 26], unlitEmitter: [81, 26], litForeground: [89, 26] })
    close(resized.gray, overlap.gray, 'Resized lightmap alignment')
    close(resized.full, overlap.full, 'Resized full mask texel')
    checkObjects(resized, 'Resized object depth')
    check(lights.texture.width === 96 && lights.texture.height === 80,
      `Lightmap was not resized: ${lights.texture.width}x${lights.texture.height}`)
    const diagnostics = lights.diagnostics
    lights.clear()
    const cleared = sample({ gray: [39, 26] })
    close(cleared.gray, ambient.gray, 'Clearing point lights did not restore ambient')

    // Ordinary objects sample illumination at their ground point. Their head
    // must not inherit a different point on a floor-projected light texture.
    viewport.position.set(0, 0)
    viewport.scale.set(1)
    renderer.resize(originalSize.width, originalSize.height)
    const makeTexture = (width, height) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, width, height)
      context.clearRect(0, 6, 1, 1)
      context.clearRect(1, 7, 1, 1)
      context.fillStyle = 'rgba(255,255,255,0.5)'
      context.fillRect(1, 7, 1, 1)
      const texture = PIXI.Texture.from(canvas)
      sampledTextures.push(texture)
      return texture
    }
    const tall = new PIXI.Sprite(makeTexture(4, 24))
    const originalTint = 0xc0e0ff
    tall.tint = originalTint
    tall.anchor.set(0.5, 1)
    tall.position.set(7, 58)
    tall.zIndex = 3
    sampledFilter = new PIXI.AlphaFilter({ alpha: 1 })
    tall.filters = [sampledFilter]
    objects.addChild(tall)
    const worldPoint = { x: 7, y: 58 }
    check(lights.addSampledTarget(tall, () => worldPoint) === tall,
      'Ground-sampled target registration did not preserve the sprite')
    check(tall.filters.length === 1 && tall.filters[0] === sampledFilter,
      'Ground-sampled object received a floor-projected filter')
    const ambientObject = sample({ head: [6, 36], body: [6, 54] })
    close(ambientObject.head, [24, 42, 64, 255], 'Ground-sampled original tint at ambient')
    close(ambientObject.body, ambientObject.head, 'Ambient head/body illumination')
    // The mask raster starts at(4,55). Only the bottom of this24px sprite is
    // near the mask; its callback samples white texel(3,3) at world(7,58).
    lights.addLight({ location: [0, 0], offset: [7, 58], flags: 0,
      rgb: [100, 120, 140], resource: { name: 'synthetic-ground-sample' } }, maskTexture, [3, 3])
    const sampled = sample({ head: [6, 36], body: [6, 54], hole: [5, 40], translucent: [6, 41] })
    close(sampled.head, [99, 148, 204, 255], 'Tall object ground-sampled head tint')
    close(sampled.body, sampled.head, 'Tall object head/body use one ground factor')
    check(sampled.hole[3] === 0, 'Ground sampling filled a transparent object pixel')
    close(sampled.translucent, [50, 74, 102, 128], 'Ground sampling preserved partial artwork alpha')
    const fullTint = tall.tint
    worldPoint.x = 8
    tall.position.x = 8
    const sampledMoved = sample({ head: [7, 36], body: [7, 54] })
    close(sampledMoved.head, [62, 95, 134, 255], 'Moving object samples grayscale falloff at new ground point')
    close(sampledMoved.body, sampledMoved.head, 'Moved object head/body ground factor')
    check(tall.tint !== fullTint, 'Moving the ground point did not refresh object tint')
    const movedTint = tall.tint
    tall.texture = makeTexture(6, 16)
    tall.anchor.set(1 / 3, 1)
    const animated = sample({ head: [7, 44], body: [7, 56] })
    close(animated.head, sampledMoved.head, 'Animation texture/anchor changed ground-sampled factor')
    close(animated.body, sampledMoved.body, 'Animation body illumination changed')
    check(tall.tint === movedTint, 'Animation metadata changed the sampled tint')
    viewport.position.set(5, 3)
    viewport.scale.set(1.5)
    const sampledCamera = sample({ head: [16, 69], body: [16, 87],
      normalObject: [53, 20], unlitEmitter: [59, 20], litForeground: [65, 20] })
    close(sampledCamera.head, animated.head, 'Camera zoom changed ground-sampled head tint')
    close(sampledCamera.body, animated.body, 'Camera zoom changed ground-sampled body tint')
    checkObjects(sampledCamera, 'Ground-sampled scene self-lit depth')
    viewport.position.set(7, 5)
    const sampledPan = sample({ head: [18, 71], body: [18, 89] })
    close(sampledPan.head, animated.head, 'Camera pan changed ground-sampled tint')
    close(sampledPan.body, animated.body, 'Camera pan changed ground-sampled body tint')
    renderer.resize(96, 112)
    const sampledResize = sample({ head: [18, 71], body: [18, 89] })
    close(sampledResize.head, animated.head, 'Resize changed ground-sampled tint')
    close(sampledResize.body, animated.body, 'Resize changed ground-sampled body tint')
    lights.setAmbient([64, 80, 96])
    const changedAmbient = sample({ head: [18, 71], body: [18, 89] })
    close(changedAmbient.head, [86, 123, 166, 255], 'Ambient changes did not refresh sampled object tint')
    close(changedAmbient.body, changedAmbient.head, 'Changed ambient head/body illumination')
    lights.clear()
    const sampledCleared = sample({ head: [18, 71], body: [18, 89] })
    close(sampledCleared.head, [48, 70, 96, 255], 'Cleared lights did not refresh sampled object tint')
    close(sampledCleared.body, sampledCleared.head, 'Cleared light head/body illumination')
    lights.destroy()
    check(target.filters.length === 1 && target.filters[0] === existingFilter,
      'Destroying lighting removed an unrelated target filter')
    check(backObject.filters.length === 0 && foreground.filters.length === 1 && foreground.filters[0] === objectFilter &&
      !emitter.filters?.length && lights.diagnostics.targets === 0,
      'Destroying lighting failed to remove its filter from every registered object')
    check(sourceOrder.every((sprite, index) => objects.children[index] === sprite),
      'Lighting lifecycle changed object order')
    check(tall.tint === originalTint && tall.filters.length === 1 && tall.filters[0] === sampledFilter,
      'Lighting destruction did not restore sampled object tint and unrelated filter')
    return { ambient, one, overlap, camera, moved, resized, diagnostics, alphaPreserved: true,
      selfLitEmitterPreservesDepth: true, allTargetsDetachedOnDestroy: true,
      groundSampled: { ambientObject, sampled, sampledMoved, animated, sampledCamera,
        sampledPan, sampledResize, changedAmbient, sampledCleared, tintRestored: true } }
  } finally {
    lights.destroy()
    renderer.resize(originalSize.width, originalSize.height)
    root.destroy({ children: true })
    existingFilter.destroy()
    objectFilter.destroy()
    sampledFilter?.destroy()
    for (const texture of sampledTextures) texture.destroy(true)
    artworkTexture.destroy(true)
    maskTexture.destroy(true)
  }
}
