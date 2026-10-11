const assert = require('node:assert/strict')
const { before, test } = require('node:test')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')

const root = path.resolve(__dirname, '../../..')
const source = path.join(root, '@openarcanum/agate/src')
let engine

before(async () => {
  const { build } = await import('esbuild')
  const { transformAsync } = await import('@babel/core')
  const result = await build({
    absWorkingDir: root,
    stdin: {
      contents: `
        import 'pixi.js/events';
        export { default as AGate } from './AGate.js';
        export { default as ClientEngine } from './client/ClientEngine.js';
        export { default as Sprite } from './client/Sprite.js';
        export { default as BaseRenderer } from './client/render/BaseRenderer.js';
        export { default as Scene } from './client/Scene.js';
        export { default as Location } from './shared/Location.js';
        export { default as PathFind } from './shared/map/PathFind.js';
        export { default as GameMap } from './shared/map/GameMap.js';
        export { SectorGrid } from './shared/map/SectorGrid.js';
        export { default as Sector } from './shared/map/Sector.js';
        export { default as Manager } from './shared/entity/Manager.js';
        export { default as WaypointList } from './shared/entity/WaypointList.js';
        export { default as Flags } from './shared/Flags.js';
        export { default as UID } from './shared/entity/UID.js';
        export { default as ClientNetwork } from './client/network/ClientNetwork.js';
        export { default as AssetLoader } from './shared/assets/AssetLoader.js';
        export { default as SectorCache } from './shared/map/SectorCache.js';
        export { default as Spritesheet } from './client/isometric/Spritesheet.js';
        export { default as IsoSprite } from './client/isometric/Sprite.js';
        export { default as PIXI } from './client/libs/PIXI.js';
        export { Filter } from './client/render/Filter.js';
      `,
      resolveDir: source,
      sourcefile: 'engine-test-entry.js',
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node24',
    write: false,
    external: ['electron', 'workerpool'],
    loader: { '.glsl': 'text' },
    plugins: [{
      name: 'test-flow-source',
      setup(builder) {
        builder.onLoad({ filter: /\.js$/ }, async ({ path: filename }) => {
          if (!filename.startsWith(source + path.sep)) return
          const transformed = await transformAsync(await fs.readFile(filename, 'utf8'), {
            filename,
            configFile: false,
            babelrc: false,
            plugins: [['@babel/plugin-transform-flow-strip-types', { allowDeclareFields: false }]],
          })
          return { contents: transformed.code, loader: 'js', resolveDir: path.dirname(filename) }
        })
      },
    }],
  })
  const compiled = new Module(path.join(__dirname, 'engine-test-bundle.cjs'), module)
  compiled.filename = path.join(__dirname, 'engine-test-bundle.cjs')
  compiled.paths = Module._nodeModulePaths(root)
  compiled._compile(result.outputFiles[0].text, compiled.filename)
  engine = compiled.exports
})

test('the complete active engine graph loads without a DOM or game assets', () => {
  assert.equal(typeof globalThis.window, 'undefined')
  assert.equal(typeof engine.AGate, 'function')
  assert.equal(typeof engine.AGate.prototype.createEngine, 'function')
})

test('entity UUIDs remain unique across repeated generation', () => {
  const generator = new engine.UID.UUIDGenerator()
  const ids = Array.from({ length: 1000 }, () => generator.next())
  assert.equal(new Set(ids).size, ids.length)
  assert.match(ids[0], /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})

test('Socket.IO CONNECT_ERROR rejects the connection promise with its original message', async () => {
  const client = { options: { serverURL: 'http://127.0.0.1:1' }, stopped: false }
  const previousLog = globalThis.lll
  const previousErrorLog = globalThis.lle
  globalThis.lll = globalThis.lle = () => {}
  try {
    // Disable transport startup: inject the decoded protocol packet directly.
    const connected = engine.ClientNetwork.prototype.connect.call(client, { autoConnect: false })
    const rejected = assert.rejects(connected, error => {
      assert.equal(error.message, 'Connection denied by the server')
      assert.deepEqual(error.data, { code: 'ACCESS_DENIED' })
      return true
    })
    await Promise.resolve()
    client.socket.socket.onpacket({
      type: 4, // Socket.IO protocol CONNECT_ERROR
      nsp: '/',
      data: { message: 'Connection denied by the server', data: { code: 'ACCESS_DENIED' } }
    })
    await rejected
  } finally {
    globalThis.lll = previousLog
    globalThis.lle = previousErrorLog
  }
})

test('asset JSON round trips Unicode, creates directories, and accepts a UTF-8 BOM', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agate-json-'))
  const previousEngine = globalThis.AGate
  globalThis.AGate = { getAppPath: filename => filename }
  try {
    const loader = new engine.AssetLoader()
    const filename = path.join(dir, 'nested', 'sample.json')
    const expected = { name: 'Magick — Příliš žluťoučký', value: 123 }
    await loader.saveJsonFile(filename, expected)
    assert.deepEqual(await loader.loadJsonFile(filename), expected)
    await fs.writeFile(filename, '\uFEFF' + JSON.stringify(expected), 'utf8')
    assert.deepEqual(await loader.loadJsonFile(filename), expected)
  } finally {
    if (previousEngine === undefined) delete globalThis.AGate
    else globalThis.AGate = previousEngine
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('sector cache looks up coordinates and evicts the least recently used entry', () => {
  const cache = new engine.SectorCache({})
  const first = { id: '0x0' }
  cache.add(first)
  for (let x = 1; x < 500; x++) cache.add({ id: `${x}x0` })
  assert.equal(cache.get(0, 0), first)
  cache.add({ id: '500x0' })
  assert.equal(cache.get('0x0'), first)
  assert.equal(cache.has(1, 0), false)
  assert.equal(cache.size, 500)
})

test('Pixi 8 atlas frames retain trim, rotation, anchors and cache lookup', () => {
  const { PIXI, Spritesheet, IsoSprite } = engine
  const source = new PIXI.TextureSource({ width: 64, height: 64 })
  const sheet = new Spritesheet(source, { frames: {
    'test/0': {
      frame: { x: 3, y: 4, w: 8, h: 6 },
      sourceSize: { w: 12, h: 10 },
      spriteSourceSize: { x: 2, y: 1 },
      anchor: { x: 0.25, y: 0.75 },
    },
    'test/1': { frame: { x: 20, y: 4, w: 8, h: 6 }, rotated: true, trimmed: false },
  } })
  try {
    const frame = sheet.getTextureByIndex(0)
    assert.deepEqual([frame.frame.x, frame.frame.y, frame.frame.width, frame.frame.height], [3, 4, 8, 6])
    assert.deepEqual([frame.orig.width, frame.orig.height, frame.trim.x, frame.trim.y], [12, 10, 2, 1])
    assert.equal(sheet.getTextureByIndex(1).rotate, 2)
    assert.deepEqual([sheet.getTextureByIndex(1).frame.width, sheet.getTextureByIndex(1).frame.height], [6, 8])
    assert.equal(PIXI.Texture.from('test/0'), frame)
    const sprite = new IsoSprite({})
    sprite.setTexture('test/0')
    assert.equal(sprite.texture, frame)
    assert.deepEqual([sprite.anchor.x, sprite.anchor.y], [0.25, 0.75])
    sprite.destroy()
  } finally {
    for (const key of ['test/0', 'test/1']) {
      PIXI.Cache.remove(key)
      sheet.textures[key].destroy()
    }
    source.destroy()
  }
})

test('Pixi pointer hit testing crosses the viewport into an isometric sprite', () => {
  const { PIXI, IsoSprite } = engine
  const stage = new PIXI.Container()
  stage.eventMode = 'passive'
  const viewport = new PIXI.Viewport({ screenWidth: 64, screenHeight: 64,
    worldWidth: 64, worldHeight: 64, noTicker: true,
    events: { domElement: { addEventListener() {}, removeEventListener() {} } } })
  const sprite = new IsoSprite({})
  sprite.eventMode = 'static'
  sprite.hitArea = new PIXI.Rectangle(0, 0, 16, 16)
  sprite.position.set(8, 8)
  stage.addChild(viewport)
  viewport.addChild(sprite)
  const boundary = new PIXI.EventBoundary(stage)
  try {
    assert.equal(boundary.hitTest(12, 12), sprite)
    const targets = []
    sprite.on('pointermove', event => targets.push(event.target))
    sprite.on('pointerdown', event => targets.push(event.target))
    const pointer = new PIXI.FederatedPointerEvent(boundary)
    pointer.type = 'pointermove'
    pointer.pointerType = 'mouse'
    pointer.pointerId = 1
    pointer.button = 0
    pointer.global.set(12, 12)
    boundary.mapPointerMove(pointer)
    pointer.type = 'pointerdown'
    boundary.mapPointerDown(pointer)
    assert.deepEqual(targets, [sprite, sprite])
    assert.equal(boundary.hitTest(60, 60), viewport)
  } finally {
    stage.destroy({ children: true })
  }
})


test('sector grid includes coordinate zero and excludes map dimensions at the edge', async () => {
  const loaded = []
  const map = { width: 2, height: 1, async loadSector(x, y) {
    loaded.push([x, y])
    return { id: `${x}x${y}`, x, y }
  } }
  const grid = new engine.SectorGrid(map)
  await grid.load(0, 0)
  assert.deepEqual(loaded, [[0, 0], [1, 0]])
  assert.equal(grid.get(0, 0).id, '0x0')
  assert.equal(grid.get(1, 0).id, '1x0')
  assert.equal(grid.get(2, 0), undefined)
  grid.clear()
  assert.deepEqual(grid.getAll(), [])
  assert.equal(grid.get(0, 0), undefined)
})

test('sector loading reads converter y/x paths but retains world x/y and singular roof metadata', async () => {
  const paths = []
  const { EventEmitter } = require('node:events')
  const gameEngine = { events: new EventEmitter(), assetLoader: { async loadJsonFile(filename) {
    paths.push(filename)
    return { tiles: [[{}]], roof: [null, null] }
  } } }
  const map = new engine.GameMap({ gameEngine }, 'sample-map')
  map.path = 'sample-map'
  map.loadEntities = async () => {}
  const sector = await map.loadSector(1, 2)
  assert.deepEqual(paths, ['sample-map/Sector/2/1/Sector.json'])
  assert.deepEqual([sector.x, sector.y], [1, 2])
  assert.deepEqual(engine.Location.transformToRaw(sector.getTile(0, 0).location), [64, 128])
  assert.deepEqual(sector.roofs, [null, null])
})

test('pathfinding rejects blocked destinations, handles reverse routes, and does not cut corners', () => {
  const blocked = new Set(['5,5', '1,0', '0,1'])
  const map = { width: 1, height: 1, isTileBlocked: (x, y) => blocked.has(`${x},${y}`) }
  const pathFind = new engine.PathFind(map)
  const location = (x, y) => new engine.Location(x, y)
  assert.deepEqual(pathFind.findPath(location(6, 5), location(5, 5)), [])
  assert.deepEqual(pathFind.findPath(location(0, 0), location(1, 1)), [])
  const reverse = pathFind.findPath(location(7, 7), location(3, 3))
  assert.deepEqual(engine.Location.transformToRaw(reverse[0]), [7, 7])
  assert.deepEqual(engine.Location.transformToRaw(reverse.at(-1)), [3, 3])
  assert.ok(reverse.every(point => !blocked.has(`${point.x},${point.y}`)))
  assert.deepEqual(pathFind.findPath(location(1, 1), location(-1, 1)), [])
  assert.deepEqual(pathFind.findPath(location(1, 1), location(64, 1)), [])
})

test('terrain blocking wins over NoBlock objects; inventory objects do not obstruct walking', () => {
  const flags = values => { const result = new engine.Flags(); result.set(values); return result }
  let tile = { type: 'Tile', blocked: true }
  let entities = { wall: { base: { type: 'Wall', flags: flags(['NoBlock']) } } }
  const sector = { getTileFromLocation: () => tile, getTileEntities: () => entities }
  const map = Object.create(engine.GameMap.prototype)
  map.getSectorFromLocation = () => sector
  assert.equal(map.isTileBlocked(1, 1), true)
  tile = { type: 'Tile' }
  assert.equal(map.isTileBlocked(1, 1), false)
  entities.wall.base.flags.set(['ProvidesCover'])
  assert.equal(map.isTileBlocked(1, 1), true)
  entities.wall.base.flags.set(['Inventory'])
  assert.equal(map.isTileBlocked(1, 1), false)
  tile = {}
  assert.equal(map.isTileBlocked(1, 1), true)
})

test('waypoint lists replace array contents and preserve parsed locations', () => {
  const waypoints = new engine.WaypointList()
  waypoints.set([[3, 4], [5, 6]])
  assert.equal(waypoints.count, 2)
  assert.deepEqual(engine.Location.transformToRaw(waypoints.getAt(0)), [3, 4])
  assert.deepEqual(engine.Location.transformToRaw(waypoints.getAt(1)), [5, 6])
  waypoints.set([])
  assert.equal(waypoints.count, 0)
})

test('concurrent asset callers share one load and binary image data survives file conversion', async () => {
  const loader = new engine.AssetLoader()
  let loads = 0
  loader.loadAssetDirect = async descriptor => {
    loads++
    await Promise.resolve()
    return { ...descriptor, image: { marker: true }, meta: { frames: {} } }
  }
  const [first, second] = await Promise.all([
    loader.loadAsset({ key: 'same', type: 'atlas' }),
    loader.loadAsset({ key: 'same', type: 'atlas' })
  ])
  assert.equal(loads, 1)
  assert.equal(first.image, second.image)
  const binary = Buffer.from([0, 127, 128, 254, 255])
  loader.loadFile = async () => binary
  assert.deepEqual(Buffer.from(await (await loader.loadFileToBlob('sample.png')).arrayBuffer()), binary)
  assert.equal((await loader.loadFileToDataUrl('sample.png')).split(',')[1], binary.toString('base64'))
})

test('offline movement consumes multiple waypoints after a delayed frame and updates tile occupancy', async () => {
  const client = Object.create(engine.ClientEngine.prototype)
  const visited = []
  const sprite = { async change() {}, setPosition(x, y) { this.position = [x, y] }, setFrame() {} }
  client.options = { standaloneMode: true }
  client.ready = true
  client.player = { base: { location: new engine.Location(2, 2) }, visual: { classes: { current: { sprite } } } }
  client.map = { pathFind: new engine.PathFind({ width: 1, height: 1, isTileBlocked: () => false }),
    moveEntity(entity, origin, target) { visited.push([origin.x, origin.y, target.x, target.y]) } }
  const moved = client.movePlayerTo([4, 2])
  await Promise.resolve()
  client.advancePlayerMovement(2500)
  const result = await moved
  assert.deepEqual(visited, [[2, 2, 3, 2], [3, 2, 4, 2]])
  assert.deepEqual(engine.Location.transformToRaw(client.player.base.location), [4, 2])
  assert.deepEqual(sprite.position, [160, 80])
  assert.equal(client.player.visual.classes.current.animation, 'Stand')
  assert.equal(client.movement, null)
  assert.deepEqual(result.path, [[2, 2], [3, 2], [4, 2]])
})


test('converted prototype supplies an omitted entity type and retains Wall/Spell components', async () => {
  const { EventEmitter } = require('node:events')
  const manager = new engine.Manager({ options: { standaloneMode: true }, events: new EventEmitter(),
    assetLoader: { async loadJsonFile() { return { Base: { type: 'Npc', prototype: 123, location: [0, 0] },
      Wall: { flags: ['NoBlock'] }, Spell: { flags: ['BodyOfAir'] } } } } })
  await manager.loadPrototype('123', 'synthetic/123.json')
  const entity = await manager.newEntity('fixture', { Base: { prototype: 123, location: [3, 4] } })
  assert.equal(entity.base.type, 'Npc')
  assert.deepEqual(engine.Location.transformToRaw(entity.base.location), [3, 4])
  assert.equal(entity.wall.flags.has('NoBlock'), true)
  assert.equal(entity.spell.flags.has('BodyOfAir'), true)
  assert.deepEqual([...manager.systems.keys()], ['Render'])
})


test('changing a ten-frame Walk atlas to one-frame Stand keeps the actor texture visible', async () => {
  const { PIXI, Spritesheet, Sprite } = engine
  const source = new PIXI.TextureSource({ width: 10, height: 1 })
  const sheets = {}
  for (const animation of ['Walk', 'Stand']) {
    const key = `Critter/Human/Male/Underwear/None/Unarmed/${animation}/0/North`
    const frames = {}
    for (let i = 0; i < (animation === 'Walk' ? 10 : 1); i++) {
      frames[`${key}/${i}`] = { frame: { x: i, y: 0, w: 1, h: 1 }, trimmed: false }
    }
    sheets[key] = new Spritesheet(source, { frames })
  }
  let finishStandMeta
  const standMeta = new Promise(resolve => { finishStandMeta = resolve })
  const scene = { isometric: {}, assetLoader: {
    getCachedAsset: key => sheets[key] ? { spritesheet: sheets[key] } : undefined,
    loadJsonFile: async filename => filename.includes('/Stand/') ? standMeta : { frameRate: 10, animated: true },
    findDirs: async () => new Map([['North', {}]])
  } }
  const previousEngine = globalThis.AGate
  globalThis.AGate = { getDataPath: value => value }
  const sprite = new Sprite(scene)
  const visual = { type: 'Critter', race: 'Human', gender: 'Male', armor: 'Underwear',
    shield: 'None', weapon: 'Unarmed', animation: 'Walk', stage: 'North' }
  try {
    await sprite.load(visual)
    sprite.setFrame(9)
    assert.notEqual(sprite.iso.texture, PIXI.Texture.EMPTY)
    const lastWalkTexture = sprite.iso.texture
    const standing = sprite.change({ ...visual, animation: 'Stand' })
    // The scene keeps ticking while the replacement metadata/atlases load.
    sprite.update(450)
    assert.equal(sprite.frame, 0)
    assert.equal(sprite.iso.texture, lastWalkTexture)
    finishStandMeta({ frameRate: 10, animated: true })
    await standing
    assert.equal(sprite.frame, 0)
    assert.notEqual(sprite.iso.texture, PIXI.Texture.EMPTY)
    assert.equal(sprite.iso.texture, sheets['Critter/Human/Male/Underwear/None/Unarmed/Stand/0/North'].getTextureByIndex(0))
    sprite.update(450)
    assert.equal(sprite.frame, 0)
  } finally {
    sprite.iso.destroy()
    for (const sheet of Object.values(sheets)) {
      for (const [key, texture] of Object.entries(sheet.textures)) { PIXI.Cache.remove(key); texture.destroy() }
    }
    source.destroy()
    if (previousEngine === undefined) delete globalThis.AGate
    else globalThis.AGate = previousEngine
  }
})


test('offline renderer advances two tiles in two elapsed seconds despite delayed frames', async () => {
  const { EventEmitter } = require('node:events')
  const client = Object.create(engine.ClientEngine.prototype)
  const sprite = { async change() {}, setPosition() {}, setFrame() {} }
  client.gameEngine = { events: new EventEmitter() }
  client.options = { standaloneMode: true, scheduler: 'render-schedule', stepPeriod: 1000 / 60 }
  client.ready = true
  client.stopped = false
  client.player = { base: { location: new engine.Location(2, 2) }, visual: { classes: { current: { sprite } } } }
  client.map = { pathFind: new engine.PathFind({ width: 1, height: 1, isTileBlocked: () => false }), moveEntity() {} }
  client.world = { stepCount: 0, entityManager: { update() {} } }
  client.updateEntities = () => {}
  const renderer = new engine.BaseRenderer(client)
  const moved = client.movePlayerTo([4, 2])
  await Promise.resolve()
  renderer.draw(500, 500)
  renderer.draw(1000, 500)
  assert.deepEqual(engine.Location.transformToRaw(client.player.base.location), [3, 2])
  renderer.draw(1500, 500)
  renderer.draw(2000, 500)
  await moved
  assert.deepEqual(engine.Location.transformToRaw(client.player.base.location), [4, 2])
  assert.equal(client.world.stepCount, 4)
})

test('network renderer still delegates to its drift-correcting scheduler', () => {
  const { EventEmitter } = require('node:events')
  const renderer = new engine.BaseRenderer({ gameEngine: { events: new EventEmitter() },
    options: { scheduler: 'render-schedule', standaloneMode: false },
    step() { assert.fail('Network draws must use runClientStep') } })
  const calls = []
  renderer.runClientStep = time => calls.push(time)
  renderer.draw(500, 500)
  assert.deepEqual(calls, [500])
})

test('the first Scene frame excludes startup time from offline elapsed time', async () => {
  const request = globalThis.requestAnimationFrame
  const cancel = globalThis.cancelAnimationFrame
  const callbacks = []
  const deltas = []
  globalThis.requestAnimationFrame = callback => { callbacks.push(callback); return callbacks.length }
  globalThis.cancelAnimationFrame = () => {}
  const scene = Object.create(engine.Scene.prototype)
  scene.stopped = true
  scene.frameCount = 0
  scene.renderer = { async start() {}, stop() {} }
  scene.update = (time, delta) => deltas.push(delta)
  scene.client = { onRuntimeError(error) { throw error } }
  try {
    await scene.start()
    callbacks[0](5000)
    assert.deepEqual(deltas, [])
    callbacks[1](5034)
    assert.deepEqual(deltas, [34])
    callbacks[2](5068)
    // The 30fps scheduling remainder must not be counted a second time.
    assert.deepEqual(deltas, [34, 34])
    assert.equal(scene.frameCount, 2)
    scene.stop()
  } finally {
    if (request === undefined) delete globalThis.requestAnimationFrame
    else globalThis.requestAnimationFrame = request
    if (cancel === undefined) delete globalThis.cancelAnimationFrame
    else globalThis.cancelAnimationFrame = cancel
  }
})

test('stopping during Walk atlas preparation rejects without installing movement', async () => {
  const client = Object.create(engine.ClientEngine.prototype)
  let finishAtlas
  const atlas = new Promise(resolve => { finishAtlas = resolve })
  client.options = { standaloneMode: true }
  client.ready = true
  client.stopped = false
  client.scene = { stop() {} }
  client.player = { base: { location: new engine.Location(2, 2) }, visual: { classes: { current: {
    sprite: { change: () => atlas }
  } } } }
  client.map = { pathFind: new engine.PathFind({ width: 1, height: 1, isTileBlocked: () => false }) }
  const moved = client.movePlayerTo([3, 2])
  const rejected = assert.rejects(moved, /stopped during movement preparation/)
  client.stop()
  finishAtlas()
  await rejected
  assert.equal(client.ready, false)
  assert.equal(client.movement, undefined)
  assert.equal(client.preparingMovement, false)
})

test('a delayed frame finishing a corner faces the final segment before standing', async () => {
  const client = Object.create(engine.ClientEngine.prototype)
  const sprite = { async change() {}, setPosition() {}, setFrame() {} }
  client.options = { standaloneMode: true }
  client.ready = true
  client.player = { base: { location: new engine.Location(2, 2) }, visual: { classes: { current: { sprite } } } }
  client.map = { pathFind: { findPath: () => [[2, 2], [3, 2], [3, 3]].map(point => new engine.Location(point)) }, moveEntity() {} }
  const moved = client.movePlayerTo([3, 3])
  await Promise.resolve()
  client.advancePlayerMovement(2500)
  await moved
  assert.equal(sprite.stage, 'SouthWest')
  assert.deepEqual(engine.Location.transformToRaw(client.player.base.location), [3, 3])
})
