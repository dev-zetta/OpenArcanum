const { mutableFixture } = require('./fixture-types.cts') as { mutableFixture: import('./fixture-types.cjs').MutableFixtureFactory }
const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const { before, test } = require('node:test') as typeof import('node:test')
const fs = require('node:fs/promises') as typeof import('node:fs/promises')
const os = require('node:os') as typeof import('node:os')
const path = require('node:path') as typeof import('node:path')
const Module = require('node:module') as typeof import('node:module')
const EventEmitter = require('node:events') as typeof import('node:events')

const root = path.resolve(__dirname, '../../..')
const source = path.join(root, '@openarcanum/agate/src')
let engine

before(async () => {
  const { build } = await import('esbuild')
  const result = await build({
    absWorkingDir: root,
    stdin: {
      contents: `
        import 'pixi.js/events';
        export { default as AGate } from './AGate.ts';
        export { default as ClientEngine } from './client/ClientEngine.ts';
        export { default as Sprite } from './client/Sprite.ts';
        export { default as BaseRenderer } from './client/render/BaseRenderer.ts';
        export { default as Scene } from './client/Scene.ts';
        export { default as RoofLayer } from './client/RoofLayer.ts';
        export { default as Location } from './shared/Location.ts';
        export { default as PathFind } from './shared/map/PathFind.ts';
        export { default as GameMap } from './shared/map/GameMap.ts';
        export { default as GameWorld } from './shared/GameWorld.ts';
        export { SectorGrid } from './shared/map/SectorGrid.ts';
        export { default as Sector } from './shared/map/Sector.ts';
        export { default as Manager } from './shared/entity/Manager.ts';
        export { default as WaypointList } from './shared/entity/WaypointList.ts';
        export { default as Flags } from './shared/Flags.ts';
        export { default as UID } from './shared/entity/UID.ts';
        export { default as ClientNetwork } from './client/network/ClientNetwork.ts';
        export { default as AssetLoader } from './shared/assets/AssetLoader.ts';
        export { default as SectorCache } from './shared/map/SectorCache.ts';
        export { default as Spritesheet } from './client/isometric/Spritesheet.ts';
        export { default as IsoSprite } from './client/isometric/Sprite.ts';
        export { default as PIXI } from './client/libs/PIXI.ts';
        export { Filter } from './client/render/Filter.ts';
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

test('roof piece coverage follows original 4x4 footprints with reversed runtime axes', () => {
  const rows = [
    ['0000', '0000', '1110', '1110'],
    ['1110', '1110', '1110', '1110'],
    ['0000', '0000', '1111', '1111'],
    ['1110', '1110', '1111', '1111'],
    ['1110', '1110', '1110', '0000'],
    ['1111', '1111', '1111', '1110'],
    ['0011', '0011', '1111', '1111'],
    ['0000', '0000', '0011', '0011'],
    ['1111', '1111', '1111', '1111'],
    ['0011', '0011', '0011', '0000'],
    ['1111', '1111', '1111', '0000'],
    ['0011', '0011', '0011', '0011'],
    ['1111', '1111', '1111', '0011']
  ]
  for (let piece = 0; piece < rows.length; piece++) {
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        assert.equal(engine.RoofLayer.covers(piece, 64 + y, 128 + x), rows[piece][y][x] === '1',
          `piece ${piece}, original ${x},${y}`)
      }
    }
  }
})

test('roof hiding crosses sector boundaries, stops at piece edges, and restores on exit', () => {
  const layer = new engine.RoofLayer({ newGroup: () => ({}) }, {})
  const add = (x, y, piece) => {
    const cell = { x, y, roof: { piece }, sprite: { iso: { visible: true } } }
    layer.cells.set(`${x},${y}`, cell)
    return cell
  }
  const first = add(15, 8, 8)
  const nextSector = add(16, 8, 8)
  const edge = add(17, 8, 2) // Entering from original +y is blocked by North.
  const separate = add(20, 20, 8)
  layer.updateVisibility({ x: 62, y: 34 })
  assert.equal(first.sprite.iso.visible, false)
  assert.equal(nextSector.sprite.iso.visible, false)
  assert.equal(edge.sprite.iso.visible, true)
  assert.equal(separate.sprite.iso.visible, true)
  layer.updateVisibility({ x: 82, y: 82 })
  assert.equal(first.sprite.iso.visible, true)
  assert.equal(nextSector.sprite.iso.visible, true)
  assert.equal(separate.sprite.iso.visible, false)
  layer.updateVisibility({ x: 0, y: 0 })
  assert.equal(separate.sprite.iso.visible, true)
  assert.equal(layer.hidden.size, 0)
  // At the uncovered edge of a North piece the roof must stay visible.
  layer.updateVisibility({ x: 68, y: 34 })
  assert.equal(edge.sprite.iso.visible, true)
})

test('visible roofs occlude indoor floor and objects using the shifted coverage lookup', () => {
  const location = { x: 14, y: 18 }
  const indoor = { location, outdoor: false, sprite: { iso: { visible: true } } }
  const outdoor = { location: { x: 14, y: 19 }, outdoor: true, sprite: { iso: { visible: true } } }
  const outsideFootprint = { location: { x: 17, y: 18 }, outdoor: false, sprite: { iso: { visible: true } } }
  const map = { getTile: (x, y) => y === 19 ? outdoor : indoor }
  const layer = new engine.RoofLayer({ newGroup: () => ({}) }, map)
  const roof = { x: 4, y: 5, roof: { piece: 8, fade: false }, sprite: { iso: { visible: true } } }
  layer.cells.set('4,5', roof)
  layer.ground.push(indoor, outdoor, outsideFootprint)
  const actorSprite = { iso: { visible: true } }
  layer.trackEntity({ id: 'actor', base: { location } }, actorSprite)
  layer.updateVisibility({ x: 0, y: 0 })
  assert.equal(indoor.sprite.iso.visible, false)
  assert.equal(actorSprite.iso.visible, false)
  assert.equal(outdoor.sprite.iso.visible, true)
  assert.equal(outsideFootprint.sprite.iso.visible, true)
  layer.updateVisibility({ x: 18, y: 22 })
  assert.equal(roof.sprite.iso.visible, false)
  assert.equal(indoor.sprite.iso.visible, true)
  assert.equal(actorSprite.iso.visible, true)
})

test('entity UUIDs remain unique across repeated generation', () => {
  const generator = new engine.UID.UUIDGenerator()
  const ids = Array.from({ length: 1000 }, () => generator.next())
  assert.equal(new Set(ids).size, ids.length)
  assert.match(ids[0], /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})

test('Socket.IO CONNECT_ERROR rejects the connection promise with its original message', async () => {
  const client = mutableFixture({ options: { serverURL: 'http://127.0.0.1:1' }, stopped: false })
  const previousLog = globalThis.lll
  const previousErrorLog = globalThis.lle
  globalThis.lll = globalThis.lle = () => {}
  try {
    // Disable transport startup: inject the decoded protocol packet directly.
    const connected = engine.ClientNetwork.prototype.connect.call(client, { autoConnect: false })
    const rejected = assert.rejects(connected, (error: import("./fixture-types.cjs").FixtureError) => {
      assert.equal(error.message, 'Connection denied by the server')
      assert.deepEqual(error.data, { code: 'ACCESS_DENIED' })
      return true
    })
    await Promise.resolve()
    ;(client.socket as {socket: {onpacket(packet: unknown): void}}).socket.onpacket({
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
  const pathAdapter: Pick<NonNullable<typeof globalThis.AGate>, 'getAppPath'> = { getAppPath: filename => filename }
  globalThis.AGate = pathAdapter as NonNullable<typeof globalThis.AGate>
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
    for (const key of ['test/0', 'test/1'] as const) {
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

test('sector loading aligns original SEC grids with converted entity coordinates without mutating cached assets', async () => {
  const paths = []
  const { EventEmitter } = require('node:events') as typeof import('node:events')
  const sourceTiles = Array.from({ length: 64 }, () => Array.from({ length: 64 }, () => ({})))
  sourceTiles[3][7] = { type: 'Tile', resource: 'asymmetric-floor', start: { category: 'Wood' } }
  sourceTiles[3][8] = { type: 'Tile', resource: 'blocked-floor', blocked: true }
  const converted = { tiles: sourceTiles, lights: [{ location: [67, 135], offset: [3, -2] }],
    roof: [[{ resource: 'roof-a' }, { resource: 'roof-b' }], [null, { resource: 'roof-c' }]] }
  const gameEngine = { events: new EventEmitter(), assetLoader: { async loadJsonFile(filename) {
    paths.push(filename)
    return converted
  } } }
  const map = new engine.GameMap({ gameEngine }, 'sample-map')
  map.path = 'sample-map'
  const occupant = { id: 'fixture-npc', base: { type: 'Npc', location: new engine.Location(67, 135) } }
  map.loadEntities = async (_, sector) => sector.addEntity(occupant)
  const sector = await map.loadSector(1, 2)
  assert.deepEqual(paths, ['sample-map/Sector/1/2/Sector.json'])
  assert.deepEqual([sector.x, sector.y], [1, 2])
  const floor = sector.getTile(3, 7)
  assert.equal(floor.resource, 'asymmetric-floor')
  assert.equal(floor.Npc['fixture-npc'], occupant)
  assert.deepEqual(engine.Location.transformToRaw(floor.location), [67, 135])
  assert.equal(sector.isTileBlocked(3, 8), true)
  assert.equal(sector.getTile(8, 3).resource, undefined)
  assert.deepEqual(sector.lights, converted.lights)
  assert.notEqual(sector.lights[0], converted.lights[0])
  assert.deepEqual(sector.roofs, [[{ resource: 'roof-a' }, null],
    [{ resource: 'roof-b' }, { resource: 'roof-c' }]])
  floor.start.category = 'Changed by runtime'
  floor.sprite = { runtime: true }
  assert.deepEqual(sourceTiles[3][7], { type: 'Tile', resource: 'asymmetric-floor', start: { category: 'Wood' } })
  assert.deepEqual(converted.roof[0][1], { resource: 'roof-b' })

  map.loadEntities = async () => {}
  const reloaded = await map.loadSector(1, 2)
  assert.equal(reloaded.getTile(3, 7).start.category, 'Wood')
  assert.equal(reloaded.getTile(3, 7).Npc, undefined)
  assert.equal(reloaded.getTile(3, 7).sprite, undefined)
  assert.equal(floor.Npc['fixture-npc'], occupant)

  converted.roof = [null, null]
  assert.deepEqual((await map.loadSector(1, 2)).roofs, [null, null])
})

test('non-square maps transpose sector bounds and preserve a path across original x sector boundaries', async () => {
  const { EventEmitter } = require('node:events') as typeof import('node:events')
  const paths = []
  const fixtures = new Map()
  for (let originalY = 0; originalY < 2; originalY++) {
    for (let originalX = 0; originalX < 3; originalX++) {
      fixtures.set(`${originalY}/${originalX}`, {
        tiles: Array.from({ length: 64 }, () => Array.from({ length: 64 }, () => ({})))
      })
    }
  }
  // Original (63,5) -> (64,5) crosses an x sector edge. Converted entities use
  // runtime (5,63) -> (5,64), so floor identity and collision must cross it too.
  fixtures.get('0/0').tiles[5][63] = { type: 'Tile', resource: 'edge-left' }
  fixtures.get('0/1').tiles[5][0] = { type: 'Tile', resource: 'edge-right' }
  fixtures.get('0/1').tiles[5][1] = { type: 'Tile', resource: 'edge-blocked', blocked: true }
  const gameEngine = { events: new EventEmitter(), assetLoader: { async loadJsonFile(filename) {
    paths.push(filename)
    if (filename === 'rectangular/Map.json') return { width: 3, height: 2 }
    const coordinates = filename.match(/Sector\/(\d+\/\d+)\/Sector\.json$/)?.[1]
    return fixtures.get(coordinates)
  } } }
  const map = new engine.GameMap({ gameEngine }, 'rectangular')
  map.loadEntities = async () => {}
  await map.load('rectangular')
  assert.deepEqual([map.width, map.height], [2, 3])
  assert.deepEqual(engine.Location.transformToRaw(map.center), [64, 96])
  assert.equal(map.getActiveSectors().length, 6)
  assert.ok(paths.includes('rectangular/Sector/1/2/Sector.json'))
  assert.equal(paths.includes('rectangular/Sector/2/1/Sector.json'), false)
  assert.equal(map.getTile(5, 63).resource, 'edge-left')
  assert.equal(map.getTile(5, 64).resource, 'edge-right')
  assert.deepEqual(map.pathFind.findPath(new engine.Location(5, 63), new engine.Location(5, 64))
    .map(point => engine.Location.transformToRaw(point)), [[5, 63], [5, 64]])
  assert.equal(map.isTileBlocked(5, 65), true)
  assert.equal(map.isTileBlocked(63, 5), true)
  assert.equal(map.isTileBlocked(128, 5), true)
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

test('scene retains typed black ground artwork and aligns its hotspot with the entity origin', async () => {
  const previousLoad = engine.Sprite.prototype.load
  const previousLog = globalThis.lll
  const tile = { type: 'Tile', end: { category: 'BlackYall' }, location: new engine.Location(7, 2) }
  const placed = []
  engine.Sprite.prototype.load = async function (data) { this.meta = data }
  globalThis.lll = () => {}
  const scene = {
    isometric: {}, newGroup: () => ({}),
    addSprite(sprite, target, x, y, z, offset) { placed.push({ data: sprite.meta, x, y, offset }) },
    sortGroup() {}, setSectorResource() {}
  }
  const sector = { x: 0, y: 0, tiles: [[]], entities: new Map(),
    getTile: (x, y) => x === 7 && y === 2 ? tile : {} }
  try {
    await engine.Scene.prototype.addSector.call(scene, sector, {}, {})
    assert.equal(placed.length, 1)
    assert.equal(placed[0].data, tile)
    assert.deepEqual([placed[0].x, placed[0].y, placed[0].offset.y], [280, 80, 19])
  } finally {
    engine.Sprite.prototype.load = previousLoad
    globalThis.lll = previousLog
  }
})

test('scene insertion is deterministic and draws same-tile walls before portals', async () => {
  const previousLog = globalThis.lll
  globalThis.lll = () => {}
  const pending = new Map()
  const placed = []
  const entities = [
    ['portal', 'Portal', [5, 6]], ['unrelated', 'Scenery', [7, 8]],
    ['wall', 'Wall', [5, 6]], ['decoration', 'Scenery', [5, 6]]
  ].map(([id, type, location]) => ({ id, base: { type, location: new engine.Location(location),
    flags: { hasAny: () => false } } }))
  const scene = {
    newGroup: () => ({}),
    onNewEntity(entity) { return new Promise(resolve => pending.set(entity.id, resolve)) },
    async addEntity(entity) { placed.push(entity.id) },
    sortGroup() {}, setSectorResource() {}
  }
  const sector = { x: 0, y: 0, tiles: [[]], entities: new Map(entities.map(e => [e.id, e])), getTile: () => null }
  try {
    const loading = engine.Scene.prototype.addSector.call(scene, sector, {}, {})
    assert.deepEqual(Array.from(pending.keys()), ['portal', 'unrelated', 'wall', 'decoration'])
    pending.get('decoration')()
    pending.get('wall')()
    pending.get('unrelated')()
    await Promise.resolve()
    assert.deepEqual(placed, [])
    pending.get('portal')()
    await loading
    assert.deepEqual(placed, ['wall', 'unrelated', 'portal', 'decoration'])
  } finally { globalThis.lll = previousLog }
})

test('scene applies converted byte opacity to artwork including fully transparent objects', async () => {
  const sprite = { iso: { alpha: 1 }, setData() {} }
  const entity = { base: { flags: { hasAny: () => false }, location: { x: 1, y: 2 }, offset: { x: 0, y: 0 } },
    visual: { classes: { current: { sprite } }, render: { alpha: 128 } } }
  const scene = { client: { options: { standaloneMode: true } }, async onNewEntity() {}, addSprite() {} }
  await engine.Scene.prototype.addEntity.call(scene, entity, {})
  assert.equal(sprite.iso.alpha, 128 / 255)
  entity.visual.render.alpha = 0
  await engine.Scene.prototype.addEntity.call(scene, entity, {})
  assert.equal(sprite.iso.alpha, 0)
  entity.visual.render.alpha = 255
  await engine.Scene.prototype.addEntity.call(scene, entity, {})
  assert.equal(sprite.iso.alpha, 1)
})

test('original unlit and blend effects bypass lighting without leaving the object depth group', () => {
  const filtered = [], sampled = []
  const scene = { lightLayer: { addTarget: sprite => filtered.push(sprite),
    addSampledTarget: (sprite, point) => sampled.push({ sprite, point }) } }
  const group = {}
  const ordinary = { iso: { parent: group } }
  const wall = { iso: { parent: group } }
  const unlit = { iso: { parent: group } }
  const effect = { iso: { parent: group } }
  const entity = (dontLight, flags = [], type = 'Scenery') => {
    const baseFlags = new engine.Flags()
    baseFlags.set(dontLight ? ['DontLight'] : [])
    return { base: { flags: baseFlags, type }, visual: { render: { flags } } }
  }
  engine.Scene.prototype.applyEntityLighting.call(scene, entity(false), ordinary)
  engine.Scene.prototype.applyEntityLighting.call(scene, entity(false, [], 'Wall'), wall)
  engine.Scene.prototype.applyEntityLighting.call(scene, entity(true), unlit)
  for (const flag of ['BlendAdd', 'BlendMul', 'BlendSub'] as const) {
    engine.Scene.prototype.applyEntityLighting.call(scene, entity(false, [flag]), effect)
    const flags = new engine.Flags()
    flags.set([flag])
    engine.Scene.prototype.applyEntityLighting.call(scene, entity(false, flags), effect)
  }
  assert.deepEqual(filtered, [wall.iso])
  assert.deepEqual(sampled.map(entry => entry.sprite), [ordinary.iso])
  assert.equal(typeof sampled[0].point, 'function')
  assert.equal(ordinary.iso.parent, group)
  assert.equal(unlit.iso.parent, group)
  assert.equal(effect.iso.parent, group)
})

test('offline floor clicks accept both plain tiles and rug Facades without selecting entities as ground', () => {
  const selected = []
  const client = { options: { standaloneMode: true },
    movePlayerTo(location) { selected.push(location); return Promise.resolve() } }
  const location = new engine.Location(93, 99)
  for (const type of ['Tile', 'Facade', 'Wall', 'Portal'] as const) {
    engine.ClientEngine.prototype.onObjectClick.call(client, { data: { type, location } })
  }
  engine.ClientEngine.prototype.onObjectClick.call(client, { data: { base: { type: 'Npc', location } } })
  assert.deepEqual(selected, [location, location])
})

test('terrain blocking wins over NoBlock objects; inventory objects do not obstruct walking', () => {
  const flags = values => { const result = new engine.Flags(); result.set(values); return result }
  let tile: {type?: string; blocked?: boolean} = { type: 'Tile', blocked: true }
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

test('open portal state clears only that portal, retaining solid walls, occupants and terrain blocking', () => {
  const flags = values => { const result = new engine.Flags(); result.set(values); return result }
  const door = mutableFixture({ base: { type: 'Portal', flags: flags([]) } })
  const wall = { base: { type: 'Wall', flags: flags(['NoBlock']) } }
  let tile = mutableFixture({ type: 'Tile' })
  const entities = mutableFixture({ door, wall })
  const map = Object.create(engine.GameMap.prototype)
  map.getSectorFromLocation = () => ({ getTileFromLocation: () => tile, getTileEntities: () => entities })
  assert.equal(map.isTileBlocked(1, 1), true, 'an unknown portal remains closed')
  door.portalOpen = true
  assert.equal(map.isTileBlocked(1, 1), false, 'the open door and nonblocking doorway allow passage')
  wall.base.flags.clear()
  assert.equal(map.isTileBlocked(1, 1), true, 'opening a door does not remove a solid wall')
  wall.base.flags.add('NoBlock')
  entities.actor = { base: { type: 'Pc', flags: flags([]) } }
  assert.equal(map.isTileBlocked(1, 1), true, 'an occupied open doorway still blocks another actor')
  delete entities.actor
  tile.blocked = true
  assert.equal(map.isTileBlocked(1, 1), true, 'terrain rules are not overridden')
  tile.blocked = false
  door.portalOpen = false
  assert.equal(map.isTileBlocked(1, 1), true, 'closing the door restores blocking')
  door.base.flags.add('NoBlock')
  assert.equal(map.isTileBlocked(1, 1), true, 'committed closed state overrides a converted open-door NoBlock flag')
  door.portalOpen = true
  assert.equal(map.isTileBlocked(1, 1), false)
  assert.equal(door.base.flags.has('NoBlock'), true, 'collision changes never mutate inherited flags')
  delete door.portalOpen
  assert.equal(map.isTileBlocked(1, 1), false, 'unmanaged portals retain the converted NoBlock behavior')
  door.portalOpen = false
  door.base.flags.add('Off')
  assert.equal(map.isTileBlocked(1, 1), false, 'inactive object filtering still takes precedence')
})

test('converted source paths distinguish duplicate basenames independently of runtime GUID allocation', async () => {
  const { EventEmitter } = require('node:events') as typeof import('node:events')
  let allocations = 0
  const map = new engine.GameMap({
    gameEngine: { events: new EventEmitter(), assetLoader: { async loadJsonFile() { return {} } } },
    entityManager: { async newEntity(id) { return { id: allocations++ ? `!${id}` : id } } }
  }, 'owned')
  const first = await map.loadEntity('owned/Sector/0/0/Portal/duplicate.json')
  const second = await map.loadEntity('owned/Sector/0/1/Portal/duplicate.json')
  assert.notEqual(first.id, second.id)
  assert.equal(first.sourcePath, 'owned/Sector/0/0/Portal/duplicate.json')
  assert.equal(second.sourcePath, 'owned/Sector/0/1/Portal/duplicate.json')
  assert.notEqual(first.sourcePath, second.sourcePath)
})

test('authoritative portal poses keep the selected real atlas frame through renderer ticks', () => {
  const { PIXI, Sprite, Spritesheet } = engine
  const source = new PIXI.TextureSource({ width: 7, height: 1 })
  const frames = {}
  for (let index = 0; index < 7; index++) frames[`door-pose-fixture/${index}`] = {
    frame: { x: index, y: 0, w: 1, h: 1 }, trimmed: false
  }
  const sheet = new Spritesheet(source, { frames })
  const sprite = new Sprite({ isometric: {} })
  sprite.meta = { type: 'Portal', stage: 'North' }
  sprite.path = 'Portal/Door/Owned/Test'
  sprite.variant = 0
  sprite.stages.North = { spritesheet: sheet }
  sprite.frameRate = 8
  sprite.animated = true
  try {
    for (const frame of [0, 6, 3, 0] as const) {
      sprite.setPortalState(frame)
      const texture = sheet.getTextureByIndex(frame)
      sprite.update(100000)
      assert.equal(sprite.frame, frame)
      assert.equal(sprite.iso.texture, texture)
      assert.equal(sprite.frameKey, `${sprite.path}/0/North/${frame}`)
      assert.equal(sprite.generateKeys().frameKey, `${sprite.path}/0/North/${frame}`)
    }
    assert.throws(() => sprite.setPortalState(7), /Unsupported portal pose/)
    assert.throws(() => sprite.setPortalState(-1), /Unsupported portal pose/)
    assert.throws(() => sprite.setPortalState(1.5), /Unsupported portal pose/)
    assert.equal(sprite.frame, 0)
    assert.notEqual(sprite.iso.texture, PIXI.Texture.EMPTY)
  } finally {
    sprite.iso.destroy()
    for (const [key, texture] of (Object.entries(sheet.textures) as [string, {destroy(): void}][])) { PIXI.Cache.remove(key); texture.destroy() }
    source.destroy()
  }
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
  const sprite = mutableFixture({ async change() {}, setPosition(x, y) { this.position = [x, y] }, setFrame() {} })
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
  const { EventEmitter } = require('node:events') as typeof import('node:events')
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

test('sparse converted instances retain fields omitted by their prototype without changing siblings', async () => {
  const manager = new engine.Manager({ options: { headless: true, standaloneMode: true }, events: new EventEmitter(),
    assetLoader: { async loadJsonFile() { return {
      Base: { type: 'Portal', prototype: 123, location: [0, 0], flags: [] },
      Portal: { flags: ['NeverLocked'] },
      Visual: { classes: { current: { type: 'Portal', category: 'Door', side: 3 } }, render: { flags: [] } }
    } } } })
  await manager.loadPrototype('123', 'synthetic/123.json')
  const opened = await manager.newEntity('open', { Base: { prototype: 123, location: [3, 4] },
    Visual: { classes: { current: { stage: 'SouthEast', saved: { value: 0 } } }, render: { alpha: 0 } } })
  const closed = await manager.newEntity('closed', { Base: { prototype: 123, location: [4, 4] } })
  assert.equal(opened.visual.getCurrent().stage, 'SouthEast')
  assert.equal(opened.visual.getCurrent().category, 'Door')
  assert.equal(opened.visual.getCurrent().saved.value, 0)
  assert.equal(opened.visual.render.alpha, 0, 'an explicit zero override survives')
  assert.equal(closed.visual.getCurrent().stage, undefined)
  assert.equal(closed.visual.getCurrent().saved, undefined)
  assert.equal(closed.visual.render.alpha, undefined)
  assert.equal(opened.visual.getCurrent()._prototype.stage, undefined)
  assert.equal(closed.portal.flags.has('NeverLocked'), true)
})

test('recovered instance inventory distinguishes empty from unknown and preserves source links and slots', async () => {
  const manager = new engine.Manager({ options: { headless: true, standaloneMode: true }, events: new EventEmitter(),
    assetLoader: { async loadJsonFile(filename) { return filename.endsWith('container.json') ? {
      Base: { type: 'Container', prototype: 123, location: [0, 0], flags: [] },
      Container: { inventoryIndex: 0, flags: ['NeverLocked'] }
    } : { Base: { type: 'Gold', prototype: 456, location: [0, 0], flags: ['Inventory'] },
      Item: { invLocation: 0 }, Gold: { quantity: 1 } } } } })
  await manager.loadPrototype('123', 'synthetic/container.json')
  await manager.loadPrototype('456', 'synthetic/item.json')
  const owner = 'map/Sector/0/0/Container/chest.json'
  const itemId = 'map/Sector/0/0/Gold/coins.json'
  const filled = await manager.newEntity('filled', { Base: { prototype: 123, location: [3, 4] },
    Container: { inventoryIndex: 1, inventory: [{ id: itemId, slot: 7 }] } })
  const empty = await manager.newEntity('empty', { Base: { prototype: 123, location: [4, 4] }, Container: { inventory: [] } })
  const unknown = await manager.newEntity('unknown', { Base: { prototype: 123, location: [5, 4] } })
  const item = await manager.newEntity('coins', { Base: { prototype: 456, location: [8, 9] },
    Item: { parent: owner, invLocation: 2 }, Gold: { quantity: 62 } })
  assert.deepEqual(filled.container.inventory, [{ id: itemId, slot: 7 }])
  assert.equal(Object.hasOwn(filled.container, 'inventory'), true)
  assert.deepEqual(empty.container.inventory, [])
  assert.equal(unknown.container.inventory, undefined)
  assert.equal(Object.hasOwn(unknown.container, 'inventory'), false)
  assert.equal(manager.prototypes.get('123').container.inventory, undefined)
  assert.equal(item.item.parent, owner)
  assert.equal(item.item.invLocation, 2, 'ownership list slots and UI/equipment locations are independent')
  assert.equal(item.gold.quantity, 62)
})


test('changing a ten-frame Walk atlas to one-frame Stand keeps the actor texture visible', async () => {
  const { PIXI, Spritesheet, Sprite } = engine
  const source = new PIXI.TextureSource({ width: 10, height: 1 })
  const sheets = {}
  for (const animation of ['Walk', 'Stand'] as const) {
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
  const pathAdapter: Pick<NonNullable<typeof globalThis.AGate>, 'getDataPath'> = { getDataPath: value => value }
  globalThis.AGate = pathAdapter as NonNullable<typeof globalThis.AGate>
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
    for (const sheet of (Object.values(sheets) as {textures: {[key: string]: {destroy(): void}}}[])) {
      for (const [key, texture] of (Object.entries(sheet.textures) as [string, {destroy(): void}][])) { PIXI.Cache.remove(key); texture.destroy() }
    }
    source.destroy()
    if (previousEngine === undefined) delete globalThis.AGate
    else globalThis.AGate = previousEngine
  }
})


test('offline renderer advances two tiles in two elapsed seconds despite delayed frames', async () => {
  const { EventEmitter } = require('node:events') as typeof import('node:events')
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
  const { EventEmitter } = require('node:events') as typeof import('node:events')
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
  const sprite = mutableFixture({ async change() {}, setPosition() {}, setFrame() {} })
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

test('authority snapshots alone change occupancy; renderer time only moves the sprite', async () => {
  const client = Object.create(engine.ClientEngine.prototype)
  const positions = [], crossings = []
  const sprite = { async change() {}, setPosition: (x, y) => positions.push([x, y]), setFrame() {} }
  client.ready = true
  client.stopped = false
  client.gameEngine = { events: new EventEmitter() }
  client.world = { entityManager: { entities: new Map() } }
  client.player = { id: '0', base: { location: new engine.Location(2, 2) },
    visual: { classes: { current: { animation: 'Stand', sprite } } } }
  client.map = { id: 'fixture', moveEntity: (_actor, from, to) => crossings.push([[from.x, from.y], [to.x, to.y]]),
    pathFind: { findPath() { assert.fail('The replica must never decide a server path') } } }
  const path = [[2, 2], [3, 2]]
  client.authority = { async move(actorId, target) {
    assert.equal(actorId, '0')
    assert.deepEqual(target, [3, 2])
    client.authority.snapshot = walking
    client.applyAuthoritySnapshot(walking)
    return { id: 1, status: 'accepted', path }
  } }
  const snapshot = (revision, location, movement, status) => ({ version: 1, revision, mapId: 'fixture', actors: [{
    id: '0', location, movement, lastCommand: { id: 1, status }
  }] })
  const walking = snapshot(1, [2, 2], { commandId: 1, path, index: 0, elapsedMs: 500, durationMs: 1000 }, 'accepted')
  const idle = snapshot(0, [2, 2], null, null)
  client.authority.snapshot = idle
  client.applyAuthoritySnapshot(idle)
  const moved = client.movePlayerTo([3, 2])
  await Promise.resolve()
  client.advancePlayerMovement(500000)
  assert.deepEqual(engine.Location.transformToRaw(client.player.base.location), [2, 2])
  assert.deepEqual(crossings, [])
  assert.ok(positions.at(-1)[0] >= 100 && positions.at(-1)[0] <= 106)
  client.applyAuthoritySnapshot(snapshot(2, [3, 2], null, 'completed'))
  assert.deepEqual(await moved, { path, commandId: 1 })
  assert.deepEqual(crossings, [[[2, 2], [3, 2]]])
  assert.deepEqual(positions.at(-1), [120, 80])
  assert.equal(client.movement, null)
})

function doorReplica() {
  const client = Object.create(engine.ClientEngine.prototype)
  const frames = [], crossings = []
  const door = { sourcePath: 'fixture/Sector/0/0/Portal/door.json', portalOpen: false,
    visual: { classes: { current: { sprite: { setPortalState: frame => frames.push(frame) } } } } }
  client.options = { standaloneMode: true }
  client.gameEngine = { events: new EventEmitter() }
  client.ready = true
  client.stopped = false
  client.world = { entityManager: { entities: new Map([['door', door]]) } }
  client.player = { id: '0', base: { location: new engine.Location(2, 2) },
    visual: { classes: { current: { animation: 'Stand', sprite: {
      async change() {}, setPosition() {}, setFrame() {}, loading: false
    } } } } }
  client.map = { id: 'fixture',
    moveEntity: (_actor, from, to) => crossings.push([[from.x, from.y], [to.x, to.y]]) }
  client.authority = {}
  const snapshot = ({ revision = 1, location = [2, 2], open = false, movement = null, lastCommand = null } = {}) => ({
    version: 1, mapId: 'fixture', revision,
    doors: [{ id: door.sourcePath, kind: 'door', label: 'Door', location: [4, 2],
      open, locked: false, usable: true, closedFrame: 0, openFrame: 6 }],
    actors: [{ id: '0', location, movement, lastCommand }]
  })
  const apply = state => { client.authority.snapshot = state; client.applyAuthoritySnapshot(state) }
  apply(snapshot())
  return { client, door, frames, crossings, snapshot, apply }
}

test('native door clicks submit a stable object id while Tile and Facade clicks remain movement', async () => {
  const { client, door } = doorReplica()
  const uses = [], moves = []
  client.useTarget = async id => uses.push(id)
  client.movePlayerTo = async location => moves.push(location)
  client.onObjectClick({ data: door })
  client.onObjectClick({ data: { sourcePath: 'unadvertised-object.json' } })
  client.onObjectClick({ data: { type: 'Tile', location: [3, 2] } })
  client.onObjectClick({ data: { type: 'Facade', location: [3, 3] } })
  await Promise.resolve()
  assert.deepEqual(uses, [door.sourcePath])
  assert.deepEqual(moves, [[3, 2], [3, 3]])
})

test('only a valid authority snapshot applies the door collision and committed art pose', () => {
  const { client, door, frames, snapshot, apply } = doorReplica()
  assert.equal(door.portalOpen, false)
  assert.equal(frames.at(-1), 0)
  apply(snapshot({ revision: 2, open: true }))
  assert.equal(door.portalOpen, true)
  assert.equal(frames.at(-1), 6)
  assert.throws(() => client.applyAuthoritySnapshot({ ...snapshot({ open: false }), mapId: 'other' }), /invalid actor state/)
  assert.equal(door.portalOpen, true, 'a different map cannot mutate the replica door')
  const unsupported = snapshot({ revision: 3, open: true })
  delete unsupported.doors[0].openFrame
  unsupported.doors[0].usable = false
  ;(unsupported.doors[0] as {reason?: string}).reason = 'Unsupported artwork'
  const count = frames.length
  delete door.portalOpen // The host leaves an unsupported initial pose unmanaged.
  apply(unsupported)
  assert.equal(frames.length, count, 'unsupported pose metadata does not guess a sprite frame')
  assert.equal(Object.hasOwn(door, 'portalOpen'), false, 'unsupported artwork retains the host converted-collision fallback')
})

test('door use resolves when the completion snapshot arrives before its acceptance acknowledgement', async () => {
  const { client, door, snapshot, apply, crossings } = doorReplica()
  const statuses = [], errors = []
  client.events.on('Player:InteractionUpdated', state => statuses.push(state))
  client.events.on('Game:Error', error => errors.push(error))
  let acknowledge
  const path = [[2, 2], [3, 2]]
  client.authority.use = (actorId, targetId) => {
    assert.equal(actorId, '0')
    assert.equal(targetId, door.sourcePath)
    return new Promise(resolve => { acknowledge = resolve })
  }
  const used = client.useTarget(door.sourcePath)
  const result = { targetId: door.sourcePath, open: true }
  apply(snapshot({ revision: 2, location: [3, 2], open: true,
    lastCommand: { id: 7, type: 'use', targetId: door.sourcePath, status: 'completed', result } }))
  acknowledge({ id: 7, status: 'accepted', targetId: door.sourcePath, path })
  assert.deepEqual(await used, { commandId: 7, path, result })
  assert.deepEqual(crossings, [[[2, 2], [3, 2]]])
  assert.equal(door.portalOpen, true)
  assert.equal(statuses.at(-1).status, 'completed')
  assert.equal(statuses.at(-1).open, true)
  assert.deepEqual(errors, [])
  assert.equal(client.movement, null)
  assert.equal(client.preparingMovement, false)
})

test('a door changing during approach rejects the pending interaction without stopping the game', async () => {
  const { client, door, snapshot, apply } = doorReplica()
  const errors = [], statuses = []
  client.events.on('Game:Error', error => errors.push(error))
  client.events.on('Player:InteractionUpdated', state => statuses.push(state))
  const path = [[2, 2], [3, 2]]
  client.authority.use = async () => ({ id: 8, status: 'accepted', path })
  const used = client.useTarget(door.sourcePath)
  const rejection = assert.rejects(used, /Door changed during approach/)
  await Promise.resolve()
  apply(snapshot({ revision: 2, location: [3, 2], lastCommand: {
    id: 8, type: 'use', targetId: door.sourcePath, status: 'interrupted',
    code: 'TARGET_CHANGED', message: 'Door changed during approach'
  } }))
  await rejection
  assert.equal(statuses.at(-1).status, 'rejected')
  assert.deepEqual(errors, [])
  assert.equal(client.ready, true)
  assert.equal(client.movement, null)
  assert.equal(client.preparingMovement, false)
  assert.equal(door.portalOpen, false)
})

test('a locked door rejection is an interaction status and leaves the player ready', async () => {
  const { client, door } = doorReplica()
  const errors = [], statuses = []
  client.events.on('Game:Error', error => errors.push(error))
  client.events.on('Player:InteractionUpdated', state => statuses.push(state))
  client.authority.use = async () => { throw Object.assign(new Error('Door is locked'), { code: 'LOCKED' }) }
  await assert.rejects(client.useTarget(door.sourcePath), /Door is locked/)
  assert.equal(statuses.at(-1).message, 'Door is locked')
  assert.equal(statuses.at(-1).status, 'rejected')
  assert.deepEqual(errors, [])
  assert.equal(client.ready, true)
  assert.equal(client.preparingMovement, false)
})

function containerReplica() {
  const replica = doorReplica()
  const targetId = 'fixture/Sector/0/0/Container/dresser.json'
  const descriptor = { id: targetId, kind: 'container', label: 'Container', location: [4, 2], locked: false, usable: true }
  const snapshot = (changes = {}) => ({ ...replica.snapshot(changes), containers: [descriptor] })
  replica.apply(snapshot())
  return { ...replica, targetId, snapshot }
}

test('native container clicks route only advertised instance source paths to use', async () => {
  const { client, targetId } = containerReplica()
  const used = []
  client.useTarget = async id => used.push(id)
  client.onObjectClick({ data: { sourcePath: targetId } })
  client.onObjectClick({ data: { sourcePath: 'unadvertised-container.json' } })
  await Promise.resolve()
  assert.deepEqual(used, [targetId])
})

test('container use finishes the server approach before fetching and displaying private owner rows', async () => {
  const { client, targetId, snapshot, apply } = containerReplica()
  const path = [[2, 2], [3, 2]]
  let acknowledge, requested
  const privateRequested = new Promise(resolve => { requested = resolve })
  client.authority.use = async () => ({ id: 20, status: 'accepted', path })
  client.authority.inspect = (actorId, id) => {
    assert.equal(actorId, '0')
    assert.equal(id, targetId)
    requested()
    return new Promise(resolve => { acknowledge = resolve })
  }
  const used = client.useTarget(targetId)
  await Promise.resolve()
  assert.equal(acknowledge, undefined, 'private inspection cannot precede reaching the container')
  apply(snapshot({ revision: 2, location: [3, 2], lastCommand: { id: 20, type: 'use', targetId,
    status: 'completed', result: { kind: 'container', targetId,
      items: [{ label: 'A public snapshot must never supply private rows' }] } } }))
  await privateRequested
  assert.equal(client.interactionState.inspected, undefined)
  assert.equal(client.interactionState.items, undefined)
  await assert.rejects(client.movePlayerTo([2, 2]), { code: 'BUSY' })
  const item = { id: 'fixture/Gold/coins.json', slot: 7, label: 'Gold', type: 'Gold', prototypeId: 9076, quantity: 62 }
  acknowledge({ id: 21, status: 'completed', result: { kind: 'container', targetId,
    items: [{ ...item, parent: '/private/owner', arbitrary: 'omit' }] } })
  assert.deepEqual(await used, { path, commandId: 21, approachCommandId: 20,
    result: { kind: 'container', targetId, items: [item] } })
  assert.deepEqual(client.interactionState.items, [item])
  assert.equal(client.interactionState.inspected, true)
  assert.equal(client.preparingMovement, false)
})

test('invalid private container rows reject without stopping the game or retaining prior contents', async () => {
  const { client, targetId } = containerReplica()
  const errors = []
  client.events.on('Game:Error', error => errors.push(error))
  client.interactionState = { kind: 'container', inspected: true, items: [{ label: 'Old item' }] }
  client.authority.use = async () => ({ id: 22, status: 'completed', path: [[2, 2]], result: { kind: 'container', targetId } })
  client.authority.inspect = async () => ({ id: 23, status: 'completed', result: { kind: 'container', targetId,
    items: [{ id: 'bad-item', slot: -1, label: 'Bad', type: 'Gold', prototypeId: 9076, quantity: 0 }] } })
  await assert.rejects(client.useTarget(targetId), /invalid container contents/)
  assert.equal(client.interactionState.status, 'rejected')
  assert.equal(client.interactionState.inspected, undefined)
  assert.equal(client.interactionState.items, undefined)
  assert.equal(client.ready, true)
  assert.deepEqual(errors, [])
})

test('walking away and stopping a private inspection clear owner contents and reject late completion', async () => {
  const { client, targetId } = containerReplica()
  client.interactionState = { kind: 'container', inspected: true, items: [{ label: 'Old item' }] }
  client.authority.move = async () => ({ id: 24, status: 'completed', path: [[2, 2]] })
  await client.movePlayerTo([2, 2])
  assert.equal(client.interactionState, null)
  client.authority.use = async () => ({ id: 25, status: 'completed', path: [[2, 2]], result: { kind: 'container', targetId } })
  let rejectInspection, requested
  const privateRequested = new Promise(resolve => { requested = resolve })
  client.authority.inspect = () => {
    requested()
    return new Promise((_, reject) => { rejectInspection = reject })
  }
  client.authority.close = () => rejectInspection(new Error('Local authority client closed'))
  const used = client.useTarget(targetId)
  const rejected = assert.rejects(used, /Local authority client closed/)
  await privateRequested
  client.stop()
  await rejected
  assert.equal(client.interactionState, null)
  assert.equal(client.preparingMovement, false)
  assert.equal(client.ready, false)
})

const checkpointDate = '2026-10-12T08:30:00.000Z'

function checkpointSnapshot(snapshot, { action = 'load', id = 9, ...changes }: {action?: string; id?: number; [field: string]: unknown} = {}) {
  return { ...snapshot({ ...changes, lastCommand: { id, type: action, status: 'completed',
    result: { kind: action, savedAt: checkpointDate } } }),
    checkpoint: { supported: true, busy: false, lastAction: action, savedAt: checkpointDate } }
}

test('checkpoint load uses an earlier completion snapshot without optimistic world changes', async () => {
  const { client, door, snapshot, apply, crossings } = doorReplica()
  const statuses = [], errors = []
  client.events.on('Player:CheckpointUpdated', state => statuses.push(state))
  client.events.on('Game:Error', error => errors.push(error))
  let acknowledge
  client.authority.load = actorId => {
    assert.equal(actorId, '0')
    return new Promise(resolve => { acknowledge = resolve })
  }
  client.authorityLastPath = [[2, 2], [3, 2]]
  const loaded = client.loadCheckpoint()
  assert.equal(door.portalOpen, false)
  assert.deepEqual(crossings, [])
  assert.equal(statuses.at(-1).status, 'pending')
  apply(checkpointSnapshot(snapshot, { revision: 2, location: [3, 2], open: true }))
  assert.equal(door.portalOpen, true)
  assert.deepEqual(crossings, [[[2, 2], [3, 2]]])
  assert.equal(client.authorityLastPath, null)
  acknowledge({ id: 9, status: 'completed', result: { kind: 'load', savedAt: checkpointDate } })
  assert.deepEqual(await loaded, { commandId: 9, kind: 'load', savedAt: checkpointDate })
  assert.equal(statuses.at(-1).status, 'completed')
  assert.deepEqual(errors, [])
  assert.equal(client.checkpointPending, null)
  assert.equal(client.checkpointRequest, null)
})

test('checkpoint acknowledgement waits for matching snapshot and renderer readiness', async () => {
  const { client, snapshot, apply } = doorReplica()
  let visualReady, completed = false
  client.authorityVisualReady = new Promise(resolve => { visualReady = resolve })
  client.authority.save = async () => ({ id: 11, status: 'completed',
    result: { kind: 'save', savedAt: checkpointDate } })
  const saved = client.saveCheckpoint().then(result => { completed = true; return result })
  await Promise.resolve()
  assert.equal(completed, false)
  apply(checkpointSnapshot(snapshot, { action: 'save', id: 10, revision: 2 }))
  await Promise.resolve()
  assert.equal(completed, false, 'a different completed command cannot satisfy the save')
  apply(checkpointSnapshot(snapshot, { action: 'save', id: 11, revision: 3 }))
  await Promise.resolve()
  assert.equal(completed, false, 'the matching snapshot still waits for its artwork')
  visualReady()
  assert.deepEqual(await saved, { commandId: 11, kind: 'save', savedAt: checkpointDate })
})

test('checkpoint requests block conflicting commands and cancellation clears pending state', async () => {
  const { client, door } = doorReplica()
  const statuses = []
  client.events.on('Player:CheckpointUpdated', state => statuses.push(state))
  client.authority.save = async () => ({ id: 12, status: 'completed',
    result: { kind: 'save', savedAt: checkpointDate } })
  client.authority.close = () => {}
  client.authority.move = client.authority.use = client.authority.load = () => assert.fail('Conflicting intent reached the server')
  const saved = client.saveCheckpoint()
  const rejected = assert.rejects(saved, /Client stopped during checkpoint/)
  await Promise.resolve()
  await assert.rejects(client.loadCheckpoint(), { code: 'BUSY' })
  await assert.rejects(client.movePlayerTo([3, 2]), { code: 'BUSY' })
  await assert.rejects(client.useTarget(door.sourcePath), { code: 'BUSY' })
  assert.equal(statuses.at(-1).status, 'pending', 'a conflicting action cannot overwrite Save status')
  client.stop()
  await rejected
  assert.equal(client.checkpointRequest, null)
  assert.equal(client.checkpointPending, null)
})

test('a missing checkpoint is a recoverable status and preserves the running world', async () => {
  const { client, door, crossings } = doorReplica()
  const errors = []
  client.events.on('Game:Error', error => errors.push(error))
  client.authority.load = async () => { throw Object.assign(new Error('No local checkpoint has been saved'), { code: 'CHECKPOINT_NOT_FOUND' }) }
  await assert.rejects(client.loadCheckpoint(), { code: 'CHECKPOINT_NOT_FOUND' })
  assert.equal(client.ready, true)
  assert.equal(client.stopped, false)
  assert.equal(client.checkpointState.status, 'rejected')
  assert.deepEqual(crossings, [])
  assert.equal(door.portalOpen, false)
  assert.deepEqual(errors, [])
})

test('checkpoint diagnostics omit private storage paths and unknown fields', () => {
  const { client } = doorReplica()
  client.authorityState.checkpoint = { supported: true, busy: false, lastAction: 'save', savedAt: checkpointDate,
    checkpointPath: '/private/save.json', token: 'private-token',
    error: { code: 'CHECKPOINT_IO_ERROR', message: 'Checkpoint could not be written', path: '/private/save.json' } }
  assert.deepEqual(client.getCheckpointDevelopmentState(), { supported: true, busy: false,
    lastAction: 'save', savedAt: checkpointDate,
    error: { code: 'CHECKPOINT_IO_ERROR', message: 'Checkpoint could not be written' } })
  delete client.authorityState.checkpoint
  assert.deepEqual(client.getCheckpointDevelopmentState(), { supported: false, busy: false })
})

test('snapshots during replica asset loading are cached until its player sprite is ready', () => {
  const client = Object.create(engine.ClientEngine.prototype)
  client.ready = false
  client.player = { id: '0' }
  client.map = { id: 'fixture' }
  const snapshot = { actors: [{ id: '0', location: [2, 2] }] }
  client.applyAuthoritySnapshot(snapshot)
  assert.equal(client.authorityState, snapshot)
})

test('stopping during asynchronous renderer startup cannot restart the client', async () => {
  const client = Object.create(engine.ClientEngine.prototype)
  let finishRenderer
  const started = new Promise(resolve => { finishRenderer = resolve })
  let stops = 0
  client.scene = { start: () => started, stop() { stops++ } }
  const starting = client.start()
  const rejected = assert.rejects(starting, /Client stopped during startup/)
  client.stop()
  finishRenderer()
  await rejected
  assert.equal(client.stopped, true)
  assert.equal(client.ready, false)
  assert.equal(stops, 2, 'both the stop request and the late renderer completion are stopped')
})

function pauseReplica() {
  const replica = doorReplica()
  replica.client.authority.close = () => {}
  const snapshot = (changes: {pause?: object; revision?: number; [field: string]: unknown} = {}) => ({ ...replica.snapshot(changes),
    pause: { supported: true, paused: false, ...changes.pause } })
  replica.apply(snapshot())
  return { ...replica, snapshot }
}

test('paused replica keeps a mid-tile sprite and animation at the committed fraction across long frame gaps', () => {
  const { client, snapshot, apply } = pauseReplica()
  const positions = [], updates = []
  client.player.visual.classes.current.sprite.setPosition = (x, y) => positions.push([x, y])
  client.world.stepCount = 7
  client.world.entityManager.update = (...args) => updates.push(args)
  client.updateEntities = () => {}
  const movement = { commandId: 50, path: [[2, 2], [3, 2]], index: 0, elapsedMs: 375, durationMs: 1000 }
  apply(snapshot({ revision: 2, movement, lastCommand: { id: 50, status: 'accepted' }, pause: { paused: true } }))
  client.authorityReceivedAt = performance.now() - 60000
  client.updateAuthorityPresentation()
  client.step(99999, 60000)
  client.step(100999, 1000)
  assert.deepEqual(positions.at(-1), [95, 80], 'freeze at 2.375 tiles, not the tile origin or endpoint')
  assert.equal(client.world.stepCount, 7)
  assert.deepEqual(updates, [], 'paused frames must not advance sprite animation systems')
  assert.deepEqual(engine.Location.transformToRaw(client.player.base.location), [2, 2])
  apply(snapshot({ revision: 3, movement, lastCommand: { id: 50, status: 'accepted' } }))
  client.step(101099, 100)
  assert.equal(updates.length, 1)
  assert.equal(client.world.stepCount, 8)
})

test('pause can interrupt an outstanding move without replacing its completion or resolving it early', async () => {
  const { client, snapshot, apply } = pauseReplica()
  const path = [[2, 2], [3, 2]]
  client.authority.move = async () => ({ id: 50, status: 'accepted', path })
  let finished = false
  const moved = client.movePlayerTo([3, 2]).then(result => { finished = true; return result })
  await Promise.resolve()
  const movement = { commandId: 50, path, index: 0, elapsedMs: 375, durationMs: 1000 }
  const accepted = { id: 50, status: 'accepted' }
  apply(snapshot({ revision: 2, movement, lastCommand: accepted }))
  client.authority.pause = async actorId => {
    assert.equal(actorId, '0')
    apply(snapshot({ revision: 3, movement, lastCommand: accepted, pause: { paused: true } }))
    return { id: 51, status: 'completed', revision: 3, result: { kind: 'pause', paused: true } }
  }
  assert.deepEqual(await client.setPaused(true), { commandId: 51, kind: 'pause', paused: true })
  assert.equal(finished, false)
  assert.equal(client.authorityState.actors[0].lastCommand.id, 50)
  await assert.rejects(client.useTarget('fixture/door'), { code: 'PAUSED' })
  client.authority.resume = async () => {
    apply(snapshot({ revision: 4, movement, lastCommand: accepted }))
    return { id: 52, status: 'completed', revision: 4, result: { kind: 'resume', paused: false } }
  }
  assert.deepEqual(await client.setPaused(false), { commandId: 52, kind: 'resume', paused: false })
  assert.equal(finished, false)
  apply(snapshot({ revision: 5, location: [3, 2], lastCommand: { id: 50, status: 'completed' } }))
  assert.deepEqual(await moved, { path, commandId: 50 })
  assert.equal(client.movement, null)
})

test('pause acknowledgement waits for its committed snapshot without relying on actor lastCommand', async () => {
  const { client, snapshot, apply } = pauseReplica()
  client.authority.pause = async () => ({ id: 60, status: 'completed', revision: 7,
    result: { kind: 'pause', paused: true } })
  let finished = false
  const paused = client.setPaused(true).then(result => { finished = true; return result })
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(finished, false)
  await assert.rejects(client.movePlayerTo([3, 2]), { code: 'BUSY' })
  apply(snapshot({ revision: 6, pause: { paused: true } }))
  assert.equal(finished, false, 'an older paused snapshot cannot confirm a newer command')
  apply(snapshot({ revision: 7, pause: { paused: true }, lastCommand: { id: 12, status: 'completed' } }))
  assert.deepEqual(await paused, { commandId: 60, kind: 'pause', paused: true })
  assert.equal(client.authorityState.actors[0].lastCommand.id, 12)
})

test('malformed pause acknowledgement is a recoverable error and cannot change the replica clock', async () => {
  const { client } = pauseReplica()
  const errors = []
  client.events.on('Game:Error', error => errors.push(error))
  client.authority.pause = async () => ({ id: 61, status: 'completed', revision: 2,
    result: { kind: 'resume', paused: true } })
  await assert.rejects(client.setPaused(true), /invalid pause/i)
  assert.equal(client.authorityState.pause.paused, false)
  assert.equal(client.ready, true)
  assert.deepEqual(errors, [])
  client.authority.move = async () => ({ id: 62, status: 'completed', path: [[2, 2]] })
  assert.deepEqual(await client.movePlayerTo([2, 2]), { path: [[2, 2]], commandId: 62 })
})

test('stopping during pause snapshot confirmation rejects immediately and consumes a late snapshot', async () => {
  const { client, snapshot, apply } = pauseReplica()
  client.authority.pause = async () => ({ id: 63, status: 'completed', revision: 4,
    result: { kind: 'pause', paused: true } })
  const paused = client.setPaused(true)
  const rejected = assert.rejects(paused, /stopped|closed/i)
  await Promise.resolve()
  await Promise.resolve()
  client.stop()
  await rejected
  const before = client.pauseState
  apply(snapshot({ revision: 4, pause: { paused: true } }))
  assert.equal(client.pauseState, before, 'late snapshots cannot revive a stopped pause view')
  assert.equal(client.ready, false)
})

test('pause obeys explicit host capability and checkpoint exclusion without sending a request', async () => {
  const { client, snapshot, apply } = pauseReplica()
  client.authority.pause = () => assert.fail('unsupported or busy pause must not send a command')
  apply(snapshot({ revision: 2, pause: { supported: false } }))
  await assert.rejects(client.setPaused(true), { code: 'PAUSE_UNAVAILABLE' })
  apply(snapshot({ revision: 3 }))
  client.checkpointRequest = {}
  await assert.rejects(client.setPaused(true), { code: 'BUSY' })
  client.checkpointRequest = null
  await assert.rejects(client.setPaused('true'), /boolean/i)
})

test('a delayed pause acknowledgement rejects a newer opposite authoritative state instead of blocking the session', async () => {
  const { client, snapshot, apply } = pauseReplica()
  let acknowledge
  client.authority.pause = () => new Promise(resolve => { acknowledge = resolve })
  const paused = client.setPaused(true)
  const rejected = assert.rejects(paused, { code: 'PAUSE_SUPERSEDED' })
  apply(snapshot({ revision: 3, pause: { paused: true } }))
  apply(snapshot({ revision: 4, pause: { paused: false } }))
  acknowledge({ id: 65, status: 'completed', revision: 3, result: { kind: 'pause', paused: true } })
  await rejected
  assert.equal(client.pausePending, null)
  assert.equal(client.pauseRequest, null)
  assert.equal(client.authorityState.pause.paused, false)
  client.authority.move = async () => ({ id: 66, status: 'completed', path: [[2, 2]] })
  assert.deepEqual(await client.movePlayerTo([2, 2]), { commandId: 66, path: [[2, 2]] })
})

test('missing pause confirmation times out recoverably and leaves later commands usable', { timeout: 10000 }, async () => {
  const { client, snapshot, apply } = pauseReplica()
  client.authority.pause = async () => ({ id: 67, status: 'completed', revision: 10,
    result: { kind: 'pause', paused: true } })
  await assert.rejects(client.setPaused(true), { code: 'PAUSE_TIMEOUT' })
  assert.equal(client.ready, true)
  assert.equal(client.pausePending, null)
  assert.equal(client.pauseRequest, null)
  assert.equal(client.authorityState.pause.paused, false)
  client.authority.resume = async () => ({ id: 68, status: 'completed', revision: 11,
    result: { kind: 'resume', paused: false } })
  const resumed = client.setPaused(false)
  await Promise.resolve()
  apply(snapshot({ revision: 11 }))
  assert.deepEqual(await resumed, { commandId: 68, kind: 'resume', paused: false })
})

test('owned-module client creates its scene without requesting missing legacy GUI assets', async () => {
  const originalCreate = engine.Scene.prototype.create
  const client = Object.create(engine.ClientEngine.prototype)
  let scenes = 0, guiLoads = 0
  client.options = { authoredGui: false }
  client.gameEngine = { events: new EventEmitter() }
  client.guiManager = { async loadAssets() { guiLoads++; throw new Error('Retail GUI assets are absent') } }
  client.listenUI = () => {}
  engine.Scene.prototype.create = async () => { scenes++ }
  try {
    await client.create({})
    assert.equal(scenes, 1)
    assert.equal(guiLoads, 0)
    client.options.authoredGui = true
    await assert.rejects(client.create({}), /Retail GUI assets are absent/)
    assert.equal(guiLoads, 1, 'the existing authored GUI path still requires its assets')
  } finally { engine.Scene.prototype.create = originalCreate }
})

test('controlled actors share a stable template source identity without inventing missing ownership', async () => {
  const original = mutableFixture({ Base: { prototype: 900001, location: [0, 0] }, Critter: { inventoryIndex: 0 } })
  let loaded
  const sector = { addEntity(entity) { assert.equal(entity.sourcePath, '16086.json') } }
  const map = { getSectorFromLocation: () => sector }
  const world = {
    loadPlayer: async () => structuredClone(original),
    entityManager: { async newEntity(id, data) {
      loaded = data
      return { id, base: { location: new engine.Location(data.Base.location) }, critter: data.Critter }
    } },
    findMapByLocation: () => map,
  }
  const actor = await engine.GameWorld.prototype.addPlayer.call(world, new engine.Location(4, 4))
  assert.equal(actor.id, '0')
  assert.equal(actor.sourcePath, '16086.json')
  assert.equal(actor.map, map)
  assert.deepEqual(loaded.Base.location, [4, 4])
  assert.equal(Object.hasOwn(actor.critter, 'inventory'), false)
  original.Critter.inventory = []
  const ownedActor = await engine.GameWorld.prototype.addPlayer.call(world, new engine.Location(5, 4))
  assert.deepEqual(ownedActor.critter.inventory, [])
  assert.equal(ownedActor.sourcePath, actor.sourcePath)
})

test('sprite metadata selects a real PNG atlas and rejects unsupported file extensions before image loading', async () => {
  const previous = globalThis.AGate
  const descriptors = []
  const source = { type: 'Container', category: 'Workshop', name: 'Box', stage: 'North' }
  const sprite = new engine.Sprite({ isometric: {}, assetLoader: {
    async loadJsonFile() { return { frameRate: 1, animated: false, imageExtension: 'png' } },
    async findDirs() { return new Map([['North', new Map()]]) },
    getCachedAsset() { return null },
  } })
  sprite.loadSpritesheet = async (_key, options) => {
    descriptors.push(options)
    return { totalFrames: 1, getTextureByIndex: () => engine.PIXI.Texture.EMPTY }
  }
  const pathAdapter: Pick<NonNullable<typeof globalThis.AGate>, 'getDataPath'> = { getDataPath: value => value }
  globalThis.AGate = pathAdapter as NonNullable<typeof globalThis.AGate>
  try {
    await sprite.load(source)
    assert.match(descriptors[0].texture, /\/North\/Sprite\.png$/)
    sprite.assetLoader.loadJsonFile = async () => ({ imageExtension: '../../outside' })
    await assert.rejects(sprite.load(source), /Unsupported sprite image extension/)
    assert.equal(descriptors.length, 1)
  } finally {
    sprite.iso.destroy()
    if (previous === undefined) delete globalThis.AGate
    else globalThis.AGate = previous
  }
})

function inventoryReplica() {
  const replica = containerReplica()
  const { client, targetId } = replica
  client.player.sourcePath = '16086.json'
  client.inventoryEpoch = 0
  client.inventoryState = { status: 'ready', known: true, ownerId: '16086.json', items: [], revision: 1 }
  const token = { id: 'fixture/Generic/token.json', slot: 3, label: 'Item', type: 'Generic', prototypeId: 900003 }
  const inspect = () => client.setInteractionState(targetId, 'completed', 'Container inspected.', null, [{ ...token }], 1)
  client.authority.nextId = 30
  client.authority.close = () => {}
  inspect()
  return { ...replica, token, inspect }
}

test('taking waits for private ownership acknowledgement and updates both views without editing replica entities', async () => {
  const { client, targetId, token, snapshot, apply } = inventoryReplica()
  const inventories = []
  client.events.on('Player:InventoryUpdated', state => inventories.push(state))
  let acknowledge
  client.authority.take = (actorId, id, itemId, revision) => {
    assert.deepEqual([actorId,id,itemId,revision], ['0',targetId,token.id,1])
    return new Promise(resolve => { acknowledge = resolve })
  }
  const taking = client.takeItem(targetId, token.id)
  assert.equal(client.interactionState.status, 'pending')
  assert.deepEqual(client.inventoryState.items, [], 'no optimistic item creation')
  await assert.rejects(client.takeItem(targetId, token.id), { code: 'BUSY' })
  await assert.rejects(client.movePlayerTo([3,2]), { code: 'BUSY' })
  const owned = { ...token, slot: 0 }
  apply(snapshot({ revision: 2, lastCommand: { id: 30, type: 'take', status: 'completed', result: { kind: 'take', targetId } } }))
  assert.deepEqual(client.inventoryState.items, [], 'public summaries cannot populate private inventory')
  acknowledge({ id: 30, status: 'completed', revision: 2, result: { kind: 'take', targetId, itemId: token.id,
    items: [], inventory: { ownerId: '16086.json', items: [owned] } } })
  assert.equal((await taking).commandId, 30)
  assert.deepEqual(client.interactionState.items, [])
  assert.deepEqual(inventories.at(-1).items, [owned])
  assert.equal(client.inventoryState.known, true)
  assert.equal(client.transferRequest, null)
})

test('stale inspections, unknown inventories, paused sessions and unsupported items cannot send Take', async () => {
  const { client, token, targetId, inspect } = inventoryReplica()
  client.authority.take = () => assert.fail('Invalid take reached transport')
  client.authorityState.revision = 2
  await assert.rejects(client.takeItem(targetId, token.id), { code: 'STALE_REVISION' })
  client.authorityState.revision = 1; inspect()
  client.inventoryState.known = false
  await assert.rejects(client.takeItem(targetId, token.id), { code: 'INVENTORY_UNAVAILABLE' })
  client.inventoryState.known = true; inspect()
  client.authorityState.pause = { supported: true, paused: true }
  await assert.rejects(client.takeItem(targetId, token.id), { code: 'PAUSED' })
  client.authorityState.pause.paused = false; inspect()
  client.interactionState.items[0].type = 'Gold'
  await assert.rejects(client.takeItem(targetId, token.id), { code: 'UNSUPPORTED_ITEM' })
})

test('an indeterminate Take acknowledgement rereads ownership without retrying the mutation', async () => {
  const { client, targetId, token } = inventoryReplica()
  let takes = 0, reads = 0
  client.authority.take = async () => { takes++; throw new Error('Acknowledgement timed out') }
  client.authority.inventory = async () => { reads++; return { status: 'completed', revision: 2,
    result: { kind: 'inventory', ownerId: '16086.json', items: [{ ...token, slot: 0 }] } } }
  await assert.rejects(client.takeItem(targetId, token.id), /timed out/)
  assert.equal(takes, 1); assert.equal(reads, 1)
  assert.equal(client.interactionState.status, 'rejected')
  assert.equal(client.interactionState.inspected, undefined)
  assert.deepEqual(client.inventoryState.items, [{ ...token, slot: 0 }])
  assert.equal(client.ready, true)
})

test('duplicate private item rows and inconsistent transfer results never populate ownership views', async () => {
  const { client, targetId, token } = inventoryReplica()
  client.authority.inventory = async () => ({ status: 'completed', revision: 2,
    result: { kind: 'inventory', ownerId: '16086.json', items: [token, { ...token, slot: 4 }] } })
  await assert.rejects(client.refreshInventory(), /invalid private inventory/)
  assert.equal(client.inventoryState.known, false)
  client.inventoryState = { status: 'ready', known: true, items: [] }
  client.authority.take = async () => ({ id: 30, status: 'completed', revision: 2,
    result: { kind: 'take', targetId, itemId: token.id, items: [token], inventory: { ownerId: '16086.json', items: [token] } } })
  await assert.rejects(client.takeItem(targetId, token.id), /inconsistent item ownership/)
  assert.equal(client.interactionState.inspected, undefined)
  assert.equal(client.inventoryState.known, false)
})

test('unknown recovered actor inventory stays unavailable rather than becoming an empty owned inventory', async () => {
  const { client } = inventoryReplica()
  client.authority.inventory = async () => { throw Object.assign(new Error('Recovered actor inventory is unknown'), { code: 'INVENTORY_UNAVAILABLE' }) }
  assert.equal((await client.refreshInventory()).known, false)
  assert.equal(client.inventoryState.status, 'unavailable')
})

test('checkpoint load invalidates private inventory and repopulates only through an owner read', async () => {
  const { client, snapshot, apply, token } = inventoryReplica()
  client.inventoryState.items = [{ ...token, slot: 0 }]
  client.authority.load = async () => {
    assert.equal(client.inventoryState.known, false)
    assert.equal(client.interactionState, null)
    apply(checkpointSnapshot(snapshot, { id: 31, revision: 2 }))
    return { id: 31, status: 'completed', result: { kind: 'load', savedAt: checkpointDate } }
  }
  client.authority.inventory = async () => ({ status: 'completed', revision: 2,
    result: { kind: 'inventory', ownerId: '16086.json', items: [] } })
  await client.loadCheckpoint()
  assert.deepEqual(client.inventoryState.items, [])
  assert.equal(client.inventoryState.known, true)
  assert.equal(client.checkpointState.status, 'completed')
})

test('late inventory reads and late Take ACKs cannot resurrect state after load invalidation or teardown', async () => {
  const { client, targetId, token } = inventoryReplica()
  let acknowledge
  client.authority.inventory = () => new Promise(resolve => { acknowledge = resolve })
  const reading = assert.rejects(client.refreshInventory(), { code: 'INVENTORY_SUPERSEDED' })
  client.invalidateInventory('Loading inventory…')
  acknowledge({ status: 'completed', revision: 1, result: { kind: 'inventory', ownerId: '16086.json', items: [token] } })
  await reading
  assert.equal(client.inventoryState.known, false)
  client.inventoryState = { status: 'ready', known: true, items: [] }
  client.setInteractionState(targetId, 'completed', 'Inspected', null, [token], 1)
  client.authority.take = () => new Promise(resolve => { acknowledge = resolve })
  const taking = assert.rejects(client.takeItem(targetId, token.id), /stopped during item transfer/)
  client.stop()
  acknowledge({ id: 30, status: 'completed', revision: 2, result: { kind: 'take', targetId, itemId: token.id,
    items: [], inventory: { ownerId: '16086.json', items: [{ ...token, slot: 0 }] } } })
  await taking
  assert.equal(client.inventoryState, null)
  assert.equal(client.interactionState, null)
})


test('a delayed public Take summary preserves private contents already confirmed at that revision', async () => {
  const { client, targetId, token, snapshot, apply } = inventoryReplica()
  client.authority.take = async () => ({ id: 30, status: 'completed', revision: 2,
    result: { kind: 'take', targetId, itemId: token.id, items: [],
      inventory: { ownerId: '16086.json', items: [{ ...token, slot: 0 }] } } })
  await client.takeItem(targetId, token.id)
  apply(snapshot({ revision: 2, lastCommand: { id: 30, type: 'take', status: 'completed', result: { kind: 'take', targetId } } }))
  assert.deepEqual(client.interactionState.items, [])
  assert.equal(client.interactionState.inspected, true)
  assert.equal(client.interactionState.canTake, true, 'the private view matches the committed revision')
  assert.deepEqual(client.inventoryState.items, [{ ...token, slot: 0 }])
})

test('an item claimed by both private owner views cannot be turned into an unrelated invented item', async () => {
  const { client, targetId, token } = inventoryReplica()
  client.inventoryState.items = [{ ...token, slot: 0 }]
  client.authority.take = () => assert.fail('Conflicting source/destination views cannot submit a transfer')
  await assert.rejects(client.takeItem(targetId, token.id), { code: 'INVENTORY_UNAVAILABLE' })
  assert.equal(client.interactionState.inspected, undefined)
})

function putReplica() {
  const replica = inventoryReplica()
  const { client, targetId, token } = replica
  client.inventoryState.items = [{ ...token, slot: 0 }]
  client.setInteractionState(targetId, 'completed', 'Container is empty.', null, [], 1)
  return replica
}

test('Put waits for its private ACK, blocks conflicting actions and preserves unaffected inventory rows', async () => {
  const { client, targetId, token, snapshot, apply } = putReplica()
  const other = { ...token, id: 'fixture/Generic/other.json', slot: 4 }
  client.inventoryState.items.push(other)
  let acknowledge
  client.authority.put = (actorId, target, itemId, revision) => {
    assert.deepEqual([actorId,target,itemId,revision], ['0',targetId,token.id,1])
    return new Promise(resolve => { acknowledge = resolve })
  }
  const putting = client.putItem(targetId, token.id)
  assert.equal(client.interactionState.status, 'pending')
  assert.deepEqual(client.inventoryState.items, [{ ...token, slot: 0 }, other])
  await assert.rejects(client.putItem(targetId, token.id), { code: 'BUSY' })
  await assert.rejects(client.saveCheckpoint(), { code: 'BUSY' })
  apply(snapshot({ revision: 2, lastCommand: { id: 30, type: 'put', status: 'completed', result: { kind: 'put', targetId } } }))
  assert.equal(client.inventoryState.items.length, 2, 'a public summary cannot remove private rows')
  acknowledge({ id: 30, status: 'completed', revision: 2, result: { kind: 'put', targetId, itemId: token.id,
    items: [{ ...token, slot: 0 }], inventory: { ownerId: '16086.json', items: [other] } } })
  assert.equal((await putting).result.kind, 'put')
  assert.deepEqual(client.inventoryState.items, [other])
  assert.deepEqual(client.interactionState.items, [{ ...token, slot: 0 }])
  assert.equal(client.interactionState.canPut, true)
  assert.equal(client.transferRequest, null)
})

test('a delayed Put broadcast retains its fresh ACK view and permits a subsequent Take of the same identity', async () => {
  const { client, targetId, token, snapshot, apply } = putReplica()
  client.authority.put = async () => ({ id: 30, status: 'completed', revision: 2,
    result: { kind: 'put', targetId, itemId: token.id, items: [{ ...token, slot: 0 }], inventory: { ownerId: '16086.json', items: [] } } })
  await client.putItem(targetId, token.id)
  assert.equal(client.interactionState.canTake, false, 'an ACK ahead of public state cannot submit a stale revision')
  apply(snapshot({ revision: 2, lastCommand: { id: 30, type: 'put', status: 'completed', result: { kind: 'put', targetId } } }))
  assert.equal(client.interactionState.canTake, true)
  client.authority.nextId = 31
  client.authority.take = async () => {
    apply(snapshot({ revision: 3, lastCommand: { id: 31, type: 'take', status: 'completed', result: { kind: 'take', targetId } } }))
    return { id: 31, status: 'completed', revision: 3,
      result: { kind: 'take', targetId, itemId: token.id, items: [], inventory: { ownerId: '16086.json', items: [{ ...token, slot: 0 }] } } }
  }
  await client.takeItem(targetId, token.id)
  assert.deepEqual(client.inventoryState.items, [{ ...token, slot: 0 }])
  assert.deepEqual(client.interactionState.items, [])
})

test('Put rejects stale or wrong-target inspection, unknown actor metadata and unsupported items without transport', async () => {
  for (const scenario of ['stale','target','unknown','unsupported','paused'] as const) {
    const { client, targetId, token } = putReplica()
    client.authority.put = () => assert.fail('Invalid Put reached transport')
    let code
    if (scenario === 'stale') { client.authorityState.revision = 2; code = 'STALE_REVISION' }
    if (scenario === 'target') { client.interactionState.targetId = 'different-box'; code = 'STALE_REVISION' }
    if (scenario === 'unknown') { client.inventoryState.known = false; code = 'INVENTORY_UNAVAILABLE' }
    if (scenario === 'unsupported') { client.inventoryState.items[0].type = 'Gold'; code = 'UNSUPPORTED_ITEM' }
    if (scenario === 'paused') { client.authorityState.pause = { supported: true, paused: true }; code = 'PAUSED' }
    await assert.rejects(client.putItem(targetId, token.id), { code })
  }
})

test('a Put timeout rereads committed ownership without retrying or restoring a stale actor row', async () => {
  const { client, targetId, token } = putReplica()
  let writes = 0, reads = 0
  client.authority.put = async () => { writes++; throw new Error('Put acknowledgement timed out') }
  client.authority.inventory = async () => { reads++; return { status: 'completed', revision: 2,
    result: { kind: 'inventory', ownerId: '16086.json', items: [] } } }
  await assert.rejects(client.putItem(targetId, token.id), /timed out/)
  assert.deepEqual([writes,reads], [1,1])
  assert.equal(client.interactionState.inspected, undefined)
  assert.deepEqual(client.inventoryState.items, [])
  assert.equal(client.inventoryState.known, true)
})

test('a malformed Put ACK cannot duplicate or substitute the moving item', async () => {
  for (const scenario of ['still-in-actor','invented-item','changed-prototype','wrong-kind'] as const) {
    const { client, targetId, token } = putReplica()
    const result = { kind: 'put', targetId, itemId: token.id, items: [{ ...token, slot: 0 }], inventory: { ownerId: '16086.json', items: [] } }
    if (scenario === 'still-in-actor') result.inventory.items = [{ ...token, slot: 0 }]
    if (scenario === 'invented-item') result.items[0].id = 'invented-item'
    if (scenario === 'changed-prototype') result.items[0].prototypeId = 12345
    if (scenario === 'wrong-kind') result.kind = 'take'
    client.authority.put = async () => ({ id: 30, status: 'completed', revision: 2, result })
    client.authority.inventory = async () => ({ status: 'completed', revision: 2,
      result: { kind: 'inventory', ownerId: '16086.json', items: [{ ...token, slot: 0 }] } })
    await assert.rejects(client.putItem(targetId, token.id), /(?:inconsistent item ownership|invalid item transfer)/)
    assert.equal(client.interactionState.inspected, undefined)
    assert.deepEqual(client.inventoryState.items, [{ ...token, slot: 0 }], 'only a separate read can recover the true owner')
  }
})

test('an external Put invalidates old private ownership, while a late local ACK cannot survive teardown', async () => {
  const replica = putReplica()
  const { client, targetId, token, snapshot, apply } = replica
  let read
  client.authority.inventory = () => new Promise(resolve => { read = resolve })
  apply(snapshot({ revision: 2, lastCommand: { id: 40, type: 'put', status: 'completed', result: { kind: 'put', targetId } } }))
  assert.equal(client.inventoryState.known, false)
  assert.equal(client.interactionState, null)
  read({ status: 'completed', revision: 2, result: { kind: 'inventory', ownerId: '16086.json', items: [] } })
  await client.inventoryRequest.promise
  assert.deepEqual(client.inventoryState.items, [])
  const local = putReplica()
  let acknowledge
  local.client.authority.put = () => new Promise(resolve => { acknowledge = resolve })
  const rejected = assert.rejects(local.client.putItem(local.targetId, local.token.id), /stopped during item transfer/)
  local.client.stop()
  acknowledge({ id: 30, status: 'completed', revision: 2, result: { kind: 'put', targetId: local.targetId,
    itemId: local.token.id, items: [{ ...local.token, slot: 0 }], inventory: { ownerId: '16086.json', items: [] } } })
  await rejected
  assert.equal(local.client.inventoryState, null)
  assert.equal(local.client.interactionState, null)
})

function takeAllReplica() {
  const replica = inventoryReplica()
  const { client, targetId, token } = replica
  const second = { ...token, id: 'fixture/Generic/second.json', slot: 8 }
  const existing = { ...token, id: 'fixture/Generic/existing.json', slot: 1 }
  client.inventoryState.items = [existing]
  client.setInteractionState(targetId, 'completed', 'Container inspected.', null, [second, token], 1)
  const result = () => ({ kind: 'take-all', targetId, itemIds: [token.id, second.id], items: [],
    inventory: { ownerId: '16086.json', items: [{ ...token, slot: 0 }, { ...existing }, { ...second, slot: 2 }] } })
  return { ...replica, second, existing, result }
}

test('Take All waits for one private ACK and conserves every item around occupied actor slots', async () => {
  const { client, targetId, token, second, existing, snapshot, apply, result } = takeAllReplica()
  let acknowledge
  client.authority.takeAll = (actorId, target, revision) => {
    assert.deepEqual([actorId, target, revision], ['0', targetId, 1])
    return new Promise(resolve => { acknowledge = resolve })
  }
  const taking = client.takeAllItems(targetId)
  assert.equal(client.interactionState.status, 'pending')
  assert.deepEqual(client.inventoryState.items, [existing], 'no optimistic item creation')
  await assert.rejects(client.takeAllItems(targetId), { code: 'BUSY' })
  await assert.rejects(client.takeItem(targetId, token.id), { code: 'BUSY' })
  await assert.rejects(client.saveCheckpoint(), { code: 'BUSY' })
  apply(snapshot({ revision: 2, lastCommand: { id: 30, type: 'take-all', status: 'completed', result: { kind: 'take-all', targetId } } }))
  assert.deepEqual(client.inventoryState.items, [existing], 'a public batch summary contains no private rows')
  acknowledge({ id: 30, status: 'completed', revision: 2, result: result() })
  assert.deepEqual((await taking).result.itemIds, [token.id, second.id])
  assert.deepEqual(client.inventoryState.items, result().inventory.items)
  assert.deepEqual(client.interactionState.items, [])
  assert.equal(client.transferRequest, null)
})

test('Take All cannot submit from an empty, stale, conflicting or unavailable private view', async () => {
  for (const scenario of ['empty', 'stale', 'wrong-target', 'unknown', 'duplicate-owner', 'paused', 'moving', 'checkpoint'] as const) {
    const { client, targetId, token } = takeAllReplica()
    client.authority.takeAll = () => assert.fail(`Invalid ${scenario} batch reached transport`)
    let code = 'BUSY'
    if (scenario === 'empty') { client.interactionState.items = []; code = 'EMPTY_CONTAINER' }
    if (scenario === 'stale') { client.authorityState.revision = 2; code = 'STALE_REVISION' }
    if (scenario === 'wrong-target') { client.interactionState.targetId = 'other'; code = 'STALE_REVISION' }
    if (scenario === 'unknown') { client.inventoryState.known = false; code = 'INVENTORY_UNAVAILABLE' }
    if (scenario === 'duplicate-owner') { client.inventoryState.items = [{ ...token, slot: 0 }]; code = 'INVENTORY_UNAVAILABLE' }
    if (scenario === 'paused') { client.authorityState.pause = { supported: true, paused: true }; code = 'PAUSED' }
    if (scenario === 'moving') client.preparingMovement = true
    if (scenario === 'checkpoint') client.checkpointRequest = { action: 'save' }
    await assert.rejects(client.takeAllItems(targetId), { code }, scenario)
  }
})

test('a mixed Take All sends the complete intention and recovers unchanged ownership after server rejection', async () => {
  const { client, targetId, existing } = takeAllReplica()
  client.interactionState.items[0].type = 'Gold'
  let writes = 0
  client.authority.takeAll = async () => {
    writes++
    throw Object.assign(new Error('Only supported whole Generic items can be transferred'), { code: 'UNSUPPORTED_ITEM' })
  }
  client.authority.inventory = async () => ({ status: 'completed', revision: 1,
    result: { kind: 'inventory', ownerId: '16086.json', items: [existing] } })
  await assert.rejects(client.takeAllItems(targetId), { code: 'UNSUPPORTED_ITEM' })
  assert.equal(writes, 1)
  assert.deepEqual(client.inventoryState.items, [existing])
  assert.equal(client.interactionState.inspected, undefined)
})

test('a partial, duplicated, fabricated or reordered batch ACK cannot populate ownership', async () => {
  for (const scenario of ['partial-ids', 'duplicate-ids', 'reordered-ids', 'wrong-kind', 'wrong-target', 'wrong-owner',
    'retained-source', 'missing-item', 'invented-item', 'changed-metadata', 'wrong-slot', 'changed-existing', 'unsupported-type'] as const) {
    const { client, targetId, token, existing, result } = takeAllReplica()
    const batch = result()
    if (scenario === 'partial-ids') batch.itemIds.pop()
    if (scenario === 'duplicate-ids') batch.itemIds[1] = token.id
    if (scenario === 'reordered-ids') batch.itemIds.reverse()
    if (scenario === 'wrong-kind') batch.kind = 'take'
    if (scenario === 'wrong-target') batch.targetId = 'other'
    if (scenario === 'wrong-owner') batch.inventory.ownerId = 'other'
    if (scenario === 'retained-source') batch.items = [token]
    if (scenario === 'missing-item') batch.inventory.items.pop()
    if (scenario === 'invented-item') batch.inventory.items[2].id = 'invented'
    if (scenario === 'changed-metadata') batch.inventory.items[2].prototypeId++
    if (scenario === 'wrong-slot') batch.inventory.items[2].slot = 9
    if (scenario === 'changed-existing') batch.inventory.items[1].label = 'Invented label'
    if (scenario === 'unsupported-type') {
      Object.assign(client.interactionState.items[0], { type: 'Gold', quantity: 4 })
      Object.assign(batch.inventory.items[2], { type: 'Gold', quantity: 4 })
    }
    client.authority.takeAll = async () => ({ id: 30, status: 'completed', revision: 2, result: batch })
    client.authority.inventory = async () => ({ status: 'completed', revision: 2,
      result: { kind: 'inventory', ownerId: '16086.json', items: [existing] } })
    await assert.rejects(client.takeAllItems(targetId), /(?:inconsistent item ownership|invalid item transfer)/, scenario)
    assert.deepEqual(client.inventoryState.items, [existing], 'only an independent private read can recover ownership')
    assert.equal(client.interactionState.inspected, undefined)
  }
})

test('a timed-out Take All rereads the complete committed batch without retrying', async () => {
  const { client, targetId, result } = takeAllReplica()
  let writes = 0, reads = 0
  client.authority.takeAll = async () => { writes++; throw new Error('Take All acknowledgement timed out') }
  client.authority.inventory = async () => { reads++; return { status: 'completed', revision: 2,
    result: { kind: 'inventory', ...result().inventory } } }
  await assert.rejects(client.takeAllItems(targetId), /timed out/)
  assert.equal(writes, 1); assert.equal(reads, 1)
  assert.deepEqual(client.inventoryState.items, result().inventory.items)
  assert.equal(client.interactionState.inspected, undefined)
})

test('batch ACK before its public summary preserves fresh ownership, and an external batch invalidates old private rows', async () => {
  const { client, targetId, snapshot, apply, result } = takeAllReplica()
  client.authority.takeAll = async () => ({ id: 30, status: 'completed', revision: 2, result: result() })
  await client.takeAllItems(targetId)
  assert.equal(client.interactionState.canTake, false)
  apply(snapshot({ revision: 2, lastCommand: { id: 30, type: 'take-all', status: 'completed', result: { kind: 'take-all', targetId } } }))
  assert.deepEqual(client.inventoryState.items, result().inventory.items)
  assert.deepEqual(client.interactionState.items, [])
  assert.equal(client.interactionState.canPut, true)
  const remote = takeAllReplica()
  let read
  remote.client.authority.inventory = () => new Promise(resolve => { read = resolve })
  remote.apply(remote.snapshot({ revision: 2, lastCommand: { id: 40, type: 'take-all', status: 'completed',
    result: { kind: 'take-all', targetId: remote.targetId } } }))
  assert.equal(remote.client.inventoryState.known, false)
  assert.equal(remote.client.interactionState, null)
  read({ status: 'completed', revision: 2, result: { kind: 'inventory', ...remote.result().inventory } })
  await remote.client.inventoryRequest.promise
  assert.deepEqual(remote.client.inventoryState.items, remote.result().inventory.items)
})

test('a superseded or late Take All ACK cannot resurrect private state', async () => {
  for (const stop of [false, true] as const) {
    const { client, targetId, result } = takeAllReplica()
    let acknowledge
    client.authority.takeAll = () => new Promise(resolve => { acknowledge = resolve })
    const rejected = assert.rejects(client.takeAllItems(targetId), stop ? /stopped during item transfer/ : { code: 'INVENTORY_SUPERSEDED' })
    if (stop) client.stop()
    else client.invalidateInventory('Loading inventory…')
    acknowledge({ id: 30, status: 'completed', revision: 2, result: result() })
    await rejected
    if (stop) {
      assert.equal(client.inventoryState, null)
      assert.equal(client.interactionState, null)
    } else assert.equal(client.inventoryState.known, false)
  }
})

test('private item labels accept the protocol limit and reject oversized names without reviving stale rows', async () => {
  const { client, targetId, token, existing } = takeAllReplica()
  const permitted = { ...token, label: 'N'.repeat(128), slot: 0 }
  client.authority.inventory = async () => ({ status: 'completed', revision: 1,
    result: { kind: 'inventory', ownerId: '16086.json', items: [permitted] } })
  await client.refreshInventory()
  assert.deepEqual(client.inventoryState.items, [permitted])
  client.authority.inventory = async () => ({ status: 'completed', revision: 1,
    result: { kind: 'inventory', ownerId: '16086.json', items: [{ ...permitted, label: 'N'.repeat(129) }] } })
  await assert.rejects(client.refreshInventory(), /invalid private inventory/)
  assert.equal(client.inventoryState.known, false)
  assert.deepEqual(client.inventoryState.items, [])
  client.inventoryState = { status: 'ready', known: true, ownerId: '16086.json', items: [existing], revision: 1 }
  client.authority.use = async () => ({ id: 30, status: 'completed', path: [[2, 2]], result: { kind: 'container', targetId } })
  client.authority.inspect = async () => ({ id: 31, status: 'completed', revision: 1,
    result: { kind: 'container', targetId, items: [permitted] } })
  await client.useTarget(targetId)
  assert.equal(client.interactionState.items[0].label.length, 128)
  client.authority.inspect = async () => ({ id: 32, status: 'completed', revision: 1,
    result: { kind: 'container', targetId, items: [{ ...permitted, label: 'N'.repeat(129) }] } })
  await assert.rejects(client.useTarget(targetId), /invalid container contents/)
  assert.equal(client.interactionState.inspected, undefined)
  assert.equal(client.inventoryState.items[0].id, existing.id)
})

test('a standalone Key follows the private Take and Put flow without client-selected lock data', async () => {
  const { client, targetId, token, snapshot, apply } = inventoryReplica()
  const key = { ...token, id: 'fixture/Key/key.json', label: 'Key', type: 'Key', prototypeId: 900005 }
  client.setInteractionState(targetId, 'completed', 'Inspected.', null, [key], 1)
  client.authority.take = async (actorId, target, itemId, revision) => {
    assert.deepEqual([actorId, target, itemId, revision], ['0', targetId, key.id, 1])
    apply(snapshot({ revision: 2, lastCommand: { id: 30, type: 'take', status: 'completed', result: { kind: 'take', targetId } } }))
    return { id: 30, status: 'completed', revision: 2, result: { kind: 'take', targetId, itemId: key.id,
      items: [], inventory: { ownerId: '16086.json', items: [{ ...key, slot: 0 }] } } }
  }
  await client.takeItem(targetId, key.id)
  assert.deepEqual(client.inventoryState.items, [{ ...key, slot: 0 }])
  client.authority.nextId = 31
  client.authority.put = async (actorId, target, itemId, revision) => {
    assert.deepEqual([actorId, target, itemId, revision], ['0', targetId, key.id, 2])
    apply(snapshot({ revision: 3, lastCommand: { id: 31, type: 'put', status: 'completed', result: { kind: 'put', targetId } } }))
    return { id: 31, status: 'completed', revision: 3, result: { kind: 'put', targetId, itemId: key.id,
      items: [{ ...key, slot: 0 }], inventory: { ownerId: '16086.json', items: [] } } }
  }
  await client.putItem(targetId, key.id)
  assert.deepEqual(client.inventoryState.items, [])
  assert.deepEqual(client.interactionState.items, [{ ...key, slot: 0 }])
})

test('Take All accepts the complete supported mixed Generic and Key batch without changing metadata', async () => {
  const { client, targetId, token, second, result } = takeAllReplica()
  client.interactionState.items.find(item => item.id === second.id).type = 'Key'
  client.interactionState.items.find(item => item.id === second.id).label = 'Key'
  const batch = result()
  Object.assign(batch.inventory.items[2], { type: 'Key', label: 'Key' })
  client.authority.takeAll = async () => ({ id: 30, status: 'completed', revision: 2, result: batch })
  assert.deepEqual((await client.takeAllItems(targetId)).result.itemIds, [token.id, second.id])
  assert.deepEqual(client.inventoryState.items, batch.inventory.items)
  assert.deepEqual(client.interactionState.items, [])
})

function groundReplica() {
  const replica = inventoryReplica()
  const { client } = replica
  const descriptor = { id: 'fixture/Generic/pebble.json', kind: 'ground', label: 'Workshop pebble', type: 'Generic',
    prototypeId: 900007, location: [2, 3] }
  const row = { id: descriptor.id, slot: 0, label: descriptor.label, type: descriptor.type,
    prototypeId: descriptor.prototypeId, canDrop: true }
  const flags = new engine.Flags(); flags.add('NoBlock')
  const positions = []
  const entity = { sourcePath: descriptor.id, item: { groundTransferSupported: true },
    base: { type: 'Generic', prototype: descriptor.prototypeId, flags, location: new engine.Location(descriptor.location) },
    visual: { classes: { current: { sprite: { iso: { parent: {}, visible: true },
      setPosition: (x, y) => positions.push([x, y]) } } } } }
  client.world.entityManager.entities.set('pebble', entity)
  client.map.getTile = (x, y) => x >= 0 && y >= 0 && x < 64 && y < 64 ? {} : null
  client.map.objectGroup = {}
  client.scene = { sortGroup() {}, stop() {}, async addEntity() { assert.fail('The existing sprite should be reused') } }
  const snapshot = (changes: {groundItems?: unknown; [field: string]: unknown} = {}) => ({ ...replica.snapshot(changes),
    groundItems: Object.hasOwn(changes, 'groundItems') ? changes.groundItems : [descriptor] })
  const apply = (changes = {}) => replica.apply(snapshot(changes))
  apply()
  client.authority.use = async (_actor, targetId) => {
    const id = client.authority.nextId++
    const result = { kind: 'ground', targetId }
    apply({ revision: client.authorityState.revision + 1,
      lastCommand: { id, type: 'use', status: 'completed', targetId, result } })
    return { id, status: 'completed', result, path: [[2, 2]] }
  }
  return { ...replica, descriptor, row, entity, positions, snapshot, apply }
}

test('ground pickup and drop conserve the same private item and render only committed floor state', async () => {
  const { client, descriptor, row, entity, apply } = groundReplica()
  let acknowledge, submitted
  const sent = new Promise(resolve => { submitted = resolve })
  client.authority.pickup = (actorId, targetId, revision) => {
    assert.deepEqual([actorId, targetId, revision], ['0', descriptor.id, 2])
    submitted()
    return new Promise(resolve => { acknowledge = resolve })
  }
  const picking = client.pickupGroundItem(descriptor.id)
  await sent
  assert.deepEqual(client.inventoryState.items, [], 'no optimistic ownership')
  assert.equal(entity.visual.classes.current.sprite.iso.visible, true)
  await assert.rejects(client.dropItem(descriptor.id), { code: 'BUSY' })
  await assert.rejects(client.movePlayerTo([3, 2]), { code: 'BUSY' })
  apply({ revision: 3, groundItems: [], lastCommand: { id: 31, type: 'pickup', status: 'completed', result: { kind: 'pickup' } } })
  assert.equal(entity.visual.classes.current.sprite.iso.visible, false, 'the public commit hides the floor sprite')
  assert.deepEqual(client.inventoryState.items, [], 'the public summary cannot populate private rows')
  acknowledge({ id: 31, status: 'completed', revision: 3,
    result: { kind: 'pickup', targetId: descriptor.id, inventory: { ownerId: '16086.json', items: [row] } } })
  await picking
  assert.deepEqual(client.inventoryState.items, [row])
  client.authority.nextId = 32
  client.authority.drop = async (actorId, itemId, revision) => {
    assert.deepEqual([actorId, itemId, revision], ['0', row.id, 3])
    apply({ revision: 4, groundItems: [{ ...descriptor, location: [2, 2] }],
      lastCommand: { id: 32, type: 'drop', status: 'completed', result: { kind: 'drop', targetId: row.id } } })
    return { id: 32, status: 'completed', revision: 4, result: { kind: 'drop', itemId: row.id,
      ground: { ...descriptor, location: [2, 2] }, inventory: { ownerId: '16086.json', items: [] } } }
  }
  await client.dropItem(row.id)
  assert.equal(entity.visual.classes.current.sprite.iso.visible, true)
  assert.deepEqual(engine.Location.transformToRaw(entity.base.location), [2, 2])
  assert.deepEqual([...entity.base.flags], ['NoBlock'], 'authored flags are immutable; committed ground state drives visibility')
  assert.deepEqual(client.inventoryState.items, [])
  assert.equal(client.groundState.status, 'completed')
})

test('ground commands reject unavailable ownership, missing capabilities and paused state before transport', async () => {
  const { client, descriptor, row } = groundReplica()
  client.authority.pickup = client.authority.drop = () => assert.fail('Invalid action reached transport')
  client.inventoryState.known = false
  await assert.rejects(client.pickupGroundItem(descriptor.id), { code: 'INVENTORY_UNAVAILABLE' })
  client.inventoryState.known = true
  client.inventoryState.items = [{ ...row, canDrop: undefined }]
  await assert.rejects(client.dropItem(row.id), { code: 'UNSUPPORTED_ITEM' })
  client.inventoryState.items = [row]
  client.authorityState.pause = { supported: true, paused: true }
  await assert.rejects(client.dropItem(row.id), { code: 'PAUSED' })
})

test('malformed pickup replies cannot invent inventory and trigger a private reread', async () => {
  for (const change of [item => { item.slot = 7 }, item => { delete item.canDrop }, item => { item.label = 'Changed' },
    item => { item.type = 'Key' }] as const) {
    const { client, descriptor, row } = groundReplica()
    const invalid = { ...row }; change(invalid)
    let reads = 0
    client.authority.pickup = async () => ({ id: 31, status: 'completed', revision: 3,
      result: { kind: 'pickup', targetId: row.id, inventory: { ownerId: '16086.json', items: [invalid] } } })
    client.authority.inventory = async () => {
      reads++
      return { status: 'completed', revision: 3, result: { kind: 'inventory', ownerId: '16086.json', items: [] } }
    }
    await assert.rejects(client.pickupGroundItem(descriptor.id), /changed|invalid/i)
    assert.equal(reads, 1)
    assert.deepEqual(client.inventoryState.items, [])
    assert.equal(client.groundState.status, 'rejected')
  }
})

test('a timed out ground mutation rereads ownership once without retrying or restoring the sprite', async () => {
  const { client, descriptor, row, entity, apply } = groundReplica()
  let writes = 0, reads = 0
  client.authority.pickup = async () => {
    writes++
    apply({ revision: 3, groundItems: [], lastCommand: { id: 31, type: 'pickup', status: 'completed', result: { kind: 'pickup' } } })
    throw new Error('Ground acknowledgement timed out')
  }
  client.authority.inventory = async () => {
    reads++
    return { status: 'completed', revision: 3, result: { kind: 'inventory', ownerId: '16086.json', items: [row] } }
  }
  await assert.rejects(client.pickupGroundItem(descriptor.id), /timed out/)
  assert.equal(writes, 1); assert.equal(reads, 1)
  assert.deepEqual(client.inventoryState.items, [row])
  assert.equal(entity.visual.classes.current.sprite.iso.visible, false)
})

test('late ground replies after stop cannot resurrect private ownership', async () => {
  const { client, descriptor, row } = groundReplica()
  let acknowledge, submitted
  const sent = new Promise(resolve => { submitted = resolve })
  client.authority.pickup = () => { submitted(); return new Promise(resolve => { acknowledge = resolve }) }
  const pending = assert.rejects(client.pickupGroundItem(descriptor.id), /stopped/)
  await sent
  client.stop()
  acknowledge({ id: 31, status: 'completed', revision: 3,
    result: { kind: 'pickup', targetId: row.id, inventory: { ownerId: '16086.json', items: [row] } } })
  await pending
  assert.equal(client.inventoryState, null)
  assert.equal(client.groundState, null)
})

test('ground rendering rejects duplicate or unmatched descriptors before changing any sprite', async () => {
  const { client, descriptor, entity } = groundReplica()
  await client.groundVisualReady
  for (const rows of [[descriptor, descriptor], [{ ...descriptor, prototypeId: 1 }], [{ ...descriptor, location: [-1, 3] }]] as const) {
    assert.throws(() => client.applyAuthorityGroundItems(rows), /ground/i)
    assert.equal(entity.visual.classes.current.sprite.iso.visible, true)
    assert.deepEqual(engine.Location.transformToRaw(entity.base.location), descriptor.location)
  }
  const picked = []
  client.pickupGroundItem = async id => picked.push(id)
  client.onObjectClick({ data: entity })
  await Promise.resolve()
  assert.deepEqual(picked, [descriptor.id], 'native ground artwork uses the same pickup path as the panel')
})

test('a slow first ground sprite load cannot revive an item picked up by a newer snapshot', async () => {
  const { client, descriptor, entity } = groundReplica()
  await client.groundVisualReady
  entity.visual.classes.current.sprite.iso.parent = null
  let resume, started
  const loading = new Promise(resolve => { started = resolve })
  client.scene.addEntity = async () => {
    started()
    await new Promise(resolve => { resume = resolve })
    entity.visual.classes.current.sprite.iso.parent = {}
    entity.visual.classes.current.sprite.iso.visible = true
  }
  client.applyAuthorityGroundItems([{ ...descriptor, location: [3, 3] }])
  await loading
  client.applyAuthorityGroundItems([])
  resume()
  await client.groundVisualReady
  assert.equal(entity.visual.classes.current.sprite.iso.visible, false)
  assert.equal((entity as {ground?: boolean}).ground, false)
  assert.deepEqual(engine.Location.transformToRaw(entity.base.location), descriptor.location)
})

function conversationReplica() {
  const replica = inventoryReplica(), { client } = replica
  const targetId = 'fixture/Sector/0/0/Npc/guide.json'
  const descriptor = { id: targetId, kind: 'conversation', label: 'Guide', location: [4, 2] }
  const snapshot = (changes = {}) => ({ ...replica.snapshot(changes), conversationTargets: [descriptor] })
  const apply = (changes = {}) => replica.apply(snapshot(changes))
  const entry = { id: 'closer-look', title: 'A closer look', status: 'active', text: 'Show the pebble.' }
  const response = (entries = [], changes = {}) => ({ id: client.authority.nextId++, status: 'completed', revision: client.authorityState.revision,
    result: { kind: 'conversation', targetId, closed: false, conversationId: 'turn-1', nodeId: 'offer', speaker: 'Guide',
      text: 'Will you help?', options: [{ id: 'accept', text: 'I will help.' }, { id: 'leave', text: 'Goodbye.' }], journal: { entries }, character: { kind: 'character', supported: false }, ...changes } })
  apply()
  client.authority.use = async (_actor, target) => {
    const id = client.authority.nextId++, result = { kind: 'conversation', targetId: target }
    apply({ revision: client.authorityState.revision + 1, lastCommand: { id, type: 'use', status: 'completed', result } })
    return { id, status: 'completed', result, path: [[2, 2]] }
  }
  client.authority.talk = async () => response()
  client.authority.journal = async () => ({ status: 'completed', revision: client.authorityState.revision, result: { kind: 'journal', entries: [], character: { kind: 'character', supported: false } } })
  client.scene = { stop() {} }
  return { ...replica, targetId, descriptor, entry, response, snapshot, apply }
}

test('talk uses authoritative approach and publishes only private server-issued replies and journal', async () => {
  const { client, targetId, descriptor } = conversationReplica()
  const targets = [], pages = []
  client.events.on('World:ConversationTargetsUpdated', state => targets.push(state))
  client.events.on('Player:ConversationUpdated', state => pages.push(state))
  const before = client.authorityState.revision
  const state = await client.beginConversation(targetId)
  assert.equal(client.authorityState.revision, before + 1, 'only the approach publishes a revision')
  assert.equal(state.status, 'ready')
  assert.equal(state.targetId, targetId)
  assert.deepEqual(state.options, [{ id: 'accept', text: 'I will help.' }, { id: 'leave', text: 'Goodbye.' }])
  assert.deepEqual(client.journalState.entries, [])
  assert.equal(client.getInteractionTarget(targetId), descriptor)
  assert.equal(client.conversationRequest, null)
  assert.equal(pages[0].status, 'pending')
  assert.equal(pages.at(-1).status, 'ready')
  assert.deepEqual(targets, [], 'unchanged descriptors are not re-emitted')
})

test('reply tolerates its public commit before the private ACK and never invents a quest from that summary', async () => {
  const { client, targetId, entry, response, apply } = conversationReplica()
  await client.beginConversation(targetId)
  const revision = client.authorityState.revision, commandId = client.authority.nextId
  let acknowledge
  client.authority.reply = (actorId, target, token, optionId, expectedRevision) => {
    assert.deepEqual([actorId, target, token, optionId, expectedRevision], ['0', targetId, 'turn-1', 'accept', revision])
    return new Promise(resolve => { acknowledge = resolve })
  }
  const replying = client.replyConversation('accept')
  assert.deepEqual(client.journalState.entries, [])
  await assert.rejects(client.movePlayerTo([3, 2]), { code: 'BUSY' })
  await assert.rejects(client.saveCheckpoint(), { code: 'BUSY' })
  await assert.rejects(client.refreshJournal(), { code: 'BUSY' })
  apply({ revision: revision + 1, lastCommand: { id: commandId, type: 'reply', status: 'completed', result: { kind: 'reply' } } })
  assert.deepEqual(client.journalState.entries, [])
  acknowledge(response([entry], { conversationId: 'turn-2', nodeId: 'active', options: [{ id: 'leave', text: 'Later.' }] }))
  await replying
  assert.equal(client.conversationState.status, 'ready')
  assert.equal(client.conversationState.conversationId, 'turn-2')
  assert.deepEqual(client.journalState.entries, [entry])
  assert.equal(client.conversationRequest, null)
})

test('unrelated revisions invalidate replies and an old delayed talk ACK cannot revive the page', async () => {
  const { client, targetId, response, apply } = conversationReplica()
  await client.beginConversation(targetId)
  apply({ revision: client.authorityState.revision + 1, lastCommand: { id: 99, type: 'save', status: 'completed', result: { kind: 'save' } } })
  assert.equal(client.conversationState.status, 'stale')
  assert.deepEqual(client.conversationState.options, [])
  await assert.rejects(client.replyConversation('accept'), { code: 'STALE_CONVERSATION' })
  let acknowledge, submitted
  const sent = new Promise(resolve => { submitted = resolve })
  client.authority.talk = () => { submitted(); return new Promise(resolve => { acknowledge = resolve }) }
  const talking = client.beginConversation(targetId)
  await sent
  const old = response()
  apply({ revision: client.authorityState.revision + 1, lastCommand: { id: 100, type: 'reply', status: 'completed', result: { kind: 'reply' } } })
  acknowledge(old)
  await assert.rejects(talking, { code: 'CONVERSATION_SUPERSEDED' })
  assert.deepEqual(client.conversationState.options, [])
})

test('conversation guards reject missing targets, paused sessions and unoffered replies before transport', async () => {
  const { client, targetId } = conversationReplica()
  client.authority.talk = () => assert.fail('Invalid talk reached transport')
  await assert.rejects(client.beginConversation('missing'), { code: 'UNKNOWN_TARGET' })
  client.authorityState.pause = { supported: true, paused: true }
  await assert.rejects(client.beginConversation(targetId), { code: 'PAUSED' })
  client.authorityState.pause.paused = false
  await assert.rejects(client.replyConversation('show'), { code: 'STALE_CONVERSATION' })
})

test('malformed dialogue and quest rows cannot enter private client presentation', async () => {
  for (const change of [result => { result.options.push({ ...result.options[0] }) },
    result => { result.conversationId = '' }, result => { result.journal.entries = [{ id: 'quest', title: 'Quest', status: 'unknown', text: 'Hidden' }] },
    result => { result.targetId = 'other' }, result => { result.text = '' }] as const) {
    const { client, targetId, response } = conversationReplica()
    client.authority.talk = async () => { const answer = response(); change(answer.result); return answer }
    await assert.rejects(client.beginConversation(targetId), /invalid/i)
    assert.equal(client.conversationState.status, 'rejected')
    assert.deepEqual(client.conversationState.options, [])
    assert.equal(client.journalState, undefined)
  }
})

test('an uncertain reply reads the resulting journal once and never retries the choice', async () => {
  const { client, targetId, entry, apply } = conversationReplica()
  await client.beginConversation(targetId)
  let replies = 0, reads = 0
  client.authority.reply = async () => {
    replies++
    apply({ revision: client.authorityState.revision + 1,
      lastCommand: { id: client.authority.nextId, type: 'reply', status: 'completed', result: { kind: 'reply' } } })
    throw new Error('Reply acknowledgement timed out')
  }
  client.authority.journal = async () => { reads++; return { status: 'completed', revision: client.authorityState.revision,
    result: { kind: 'journal', entries: [entry], character: { kind: 'character', supported: false } } } }
  await assert.rejects(client.replyConversation('accept'), /timed out/)
  assert.equal(replies, 1); assert.equal(reads, 1)
  assert.deepEqual(client.journalState.entries, [entry])
  assert.equal(client.conversationState.status, 'rejected')
  assert.deepEqual(client.conversationState.options, [])
})

test('late conversation ACK after stop cannot restore a page or a private journal', async () => {
  const { client, targetId, response } = conversationReplica()
  let acknowledge, submitted
  const sent = new Promise(resolve => { submitted = resolve })
  client.authority.talk = () => { submitted(); return new Promise(resolve => { acknowledge = resolve }) }
  const talking = client.beginConversation(targetId)
  await sent
  const answer = response()
  client.stop()
  acknowledge(answer)
  await assert.rejects(talking, /stopped/i)
  assert.equal(client.conversationState, null)
  assert.equal(client.journalState, null)
})

test('journal reads remain private, work paused, and cannot overwrite a newer restored quest revision', async () => {
  const { client, entry, apply } = conversationReplica()
  client.authorityState.pause = { supported: true, paused: true }
  await client.refreshJournal()
  assert.equal(client.journalState.status, 'ready')
  let acknowledge
  client.authority.journal = () => new Promise(resolve => { acknowledge = resolve })
  const reading = client.refreshJournal()
  apply({ revision: 9, lastCommand: { id: 100, type: 'load', status: 'completed', result: { kind: 'load' } } })
  acknowledge({ status: 'completed', revision: 1, result: { kind: 'journal', entries: [entry], character: { kind: 'character', supported: false } } })
  await assert.rejects(reading, { code: 'JOURNAL_SUPERSEDED' })
  assert.deepEqual(client.journalState.entries, [])
})

test('native guide clicks route to conversation and local Close cannot leave usable replies', async () => {
  const { client, targetId } = conversationReplica()
  const targets = []
  client.beginConversation = async value => targets.push(value)
  client.onObjectClick({ data: { sourcePath: targetId } })
  assert.deepEqual(targets, [targetId])
  client.conversationState = { status: 'ready', options: [{ id: 'accept', text: 'Accept' }] }
  client.closeConversation()
  assert.equal(client.conversationState.status, 'closed')
  assert.deepEqual(client.conversationState.options, [])
  client.conversationRequest = {}
  assert.throws(() => client.closeConversation(), { code: 'BUSY' })
})

const attributeNames = ['strength', 'dexterity', 'constitution', 'beauty', 'intelligence', 'perception', 'willpower', 'charisma']
const neutralDerived = { maxHealth: 30, maxFatigue: 30, carryWeight: 4000, damageBonus: -1, armorClassAdjustment: -2,
  speed: 8, healRate: 3, poisonRecovery: 8, reactionModifier: -7, maxFollowers: 2 }
const characterView = (changes: {unspentPoints?: number; level?: number; [field: string]: unknown} = {}) => ({ kind: 'character', supported: true,
  experiencePoints: 0, level: 1, unspentPoints: 5, nextLevelExperience: 2100,
  attributes: attributeNames.map(id => ({ id, label: id[0].toUpperCase() + id.slice(1), value: 8, maximum: 20,
    pointCost: 1, canIncrease: changes.unspentPoints !== 0, ...(changes.unspentPoints === 0 ? { reason: 'Not enough Character Points.' } : {}) })),
  derived: { ...neutralDerived, ...(changes.level === 2 ? { maxHealth: 32, maxFatigue: 32 } :
    changes.level === 50 ? { maxHealth: 128, maxFatigue: 128 } : {}) }, ...changes })

function characterReplica() {
  const replica = conversationReplica(), { client } = replica
  client.authority.character = async () => ({ status: 'completed', revision: client.authorityState.revision, result: characterView() })
  return replica
}

test('character reads show private server progression, work paused and preserve an open conversation', async () => {
  const { client, targetId } = characterReplica()
  await client.beginConversation(targetId)
  const turn = { ...client.conversationState }, revision = client.authorityState.revision
  client.authorityState.pause = { supported: true, paused: true }
  const result = await client.refreshCharacter()
  assert.deepEqual([result.experiencePoints, result.level, result.unspentPoints, result.nextLevelExperience], [0, 1, 5, 2100])
  assert.equal(result.status, 'ready')
  assert.equal(client.authorityState.revision, revision)
  assert.deepEqual(client.conversationState, turn, 'private read does not expire choices')
  assert.equal(Object.hasOwn(client.authorityState.actors[0], 'experiencePoints'), false)
})

test('unsupported character progression never infers counters from legacy actor stats', async () => {
  const { client } = characterReplica()
  client.player.critter = { stats: { experiencePoints: 1234, level: 20, unspentPoints: 55 } }
  client.authority.character = async () => ({ status: 'completed', revision: 1, result: { kind: 'character', supported: false } })
  await client.refreshCharacter()
  assert.equal(client.characterState.status, 'unavailable')
  assert.equal(client.characterState.supported, false)
  for (const field of ['experiencePoints', 'level', 'unspentPoints', 'nextLevelExperience'] as const) assert.equal(Object.hasOwn(client.characterState, field), false)
})

test('pending character read deduplicates transport and excludes conflicting world actions', async () => {
  const { client, targetId } = characterReplica()
  let acknowledge, reads = 0
  client.authority.character = () => { reads++; return new Promise(resolve => { acknowledge = resolve }) }
  const reading = client.refreshCharacter(), second = client.refreshCharacter()
  assert.equal(reads, 1)
  await assert.rejects(client.movePlayerTo([3, 2]), { code: 'BUSY' })
  await assert.rejects(client.beginConversation(targetId), { code: 'BUSY' })
  await assert.rejects(client.refreshJournal(), { code: 'BUSY' })
  await assert.rejects(client.saveCheckpoint(), { code: 'BUSY' })
  await assert.rejects(client.setPaused(true), { code: 'BUSY' })
  acknowledge({ status: 'completed', revision: 1, result: characterView() })
  await Promise.all([reading, second])
  assert.equal(client.characterRequest, null)
})

test('malformed private progression cannot enter character or conversation presentation', async () => {
  const invalid = [characterView({ experiencePoints: -1 }), characterView({ experiencePoints: 1300001 }),
    characterView({ level: 51 }), characterView({ unspentPoints: 57 }), characterView({ nextLevelExperience: 0 }),
    characterView({ level: 50, nextLevelExperience: 1300000 }), { kind: 'character', supported: false, level: 1 },
    { kind: 'character', supported: true }]
  for (const view of invalid) {
    const { client, targetId, response, entry } = characterReplica()
    client.authority.character = async () => ({ status: 'completed', revision: 1, result: view })
    await assert.rejects(client.refreshCharacter(), /invalid/i)
    assert.equal(client.characterState.status, 'rejected')
    assert.equal(Object.hasOwn(client.characterState, 'level'), false)
    client.authority.talk = async () => response([entry], { character: view })
    await assert.rejects(client.beginConversation(targetId), /invalid/i)
    assert.deepEqual(client.conversationState.options, [])
    assert.equal(client.journalState, undefined, 'a bad character cannot partially publish the journal')
  }
})

test('quest reward and journal enter private views only after a valid ACK, including commit-before-ACK', async () => {
  const { client, targetId, response, entry, apply } = characterReplica()
  const baseline = characterView(), awarded = characterView({ experiencePoints: 2100, level: 2, unspentPoints: 6, nextLevelExperience: 4600 })
  client.authority.talk = async () => response([entry], { character: baseline, nodeId: 'active', options: [{ id: 'show', text: 'Show pebble.' }] })
  await client.beginConversation(targetId)
  const revision = client.authorityState.revision, commandId = client.authority.nextId
  let acknowledge
  client.authority.reply = () => new Promise(resolve => { acknowledge = resolve })
  const replying = client.replyConversation('show')
  apply({ revision: revision + 1, lastCommand: { id: commandId, type: 'reply', status: 'completed', result: { kind: 'reply' } } })
  assert.equal(client.characterState.experiencePoints, 0)
  assert.equal(client.journalState.entries[0].status, 'active')
  acknowledge(response([{ ...entry, status: 'completed' }], { character: awarded, nodeId: 'completed', options: [{ id: 'leave', text: 'Goodbye.' }] }))
  await replying
  assert.deepEqual([client.characterState.experiencePoints, client.characterState.level, client.characterState.unspentPoints], [2100, 2, 6])
  assert.equal(client.journalState.entries[0].status, 'completed')
})

test('uncertain rewarded reply rereads character and quest together without resending the choice', async () => {
  const { client, targetId, response, entry, apply } = characterReplica()
  client.authority.talk = async () => response([entry], { character: characterView(), nodeId: 'active', options: [{ id: 'show', text: 'Show pebble.' }] })
  await client.beginConversation(targetId)
  let replies = 0, journalReads = 0
  client.authority.reply = async () => {
    replies++
    apply({ revision: client.authorityState.revision + 1, lastCommand: { id: client.authority.nextId, type: 'reply', status: 'completed', result: { kind: 'reply' } } })
    throw new Error('Reward ACK timed out')
  }
  client.authority.journal = async () => { journalReads++; return { status: 'completed', revision: client.authorityState.revision,
    result: { kind: 'journal', entries: [{ ...entry, status: 'completed' }],
      character: characterView({ experiencePoints: 2100, level: 2, unspentPoints: 6, nextLevelExperience: 4600 }) } } }
  await assert.rejects(client.replyConversation('show'), /timed out/)
  assert.equal(replies, 1); assert.equal(journalReads, 1)
  assert.equal(client.characterState.experiencePoints, 2100)
  assert.equal(client.journalState.entries[0].status, 'completed')
  assert.deepEqual(client.conversationState.options, [])
})

test('a delayed character read cannot overwrite a newer restored timeline or revive after stop', async () => {
  for (const stop of [false, true] as const) {
    const { client, apply } = characterReplica()
    let acknowledge
    client.authority.character = () => new Promise(resolve => { acknowledge = resolve })
    const reading = client.refreshCharacter()
    if (stop) client.stop()
    else apply({ revision: 8, lastCommand: { id: 99, type: 'load', status: 'completed', result: { kind: 'load' } } })
    acknowledge({ status: 'completed', revision: 1, result: characterView() })
    await assert.rejects(reading, stop ? /stopped/ : { code: 'CHARACTER_SUPERSEDED' })
    assert.equal(client.characterState?.experiencePoints, undefined)
    if (stop) assert.equal(client.characterState, null)
  }
})

test('the character cap view accepts server saturation without calculating an XP curve', async () => {
  const { client } = characterReplica()
  client.authority.character = async () => ({ status: 'completed', revision: 1,
    result: characterView({ experiencePoints: 1300000, level: 50, unspentPoints: 56, nextLevelExperience: null }) })
  await client.refreshCharacter()
  assert.equal(client.characterState.level, 50)
  assert.equal(client.characterState.unspentPoints, 56)
  assert.equal(client.characterState.nextLevelExperience, null)
})

function boughtStrength(before) {
  return { ...before, unspentPoints: before.unspentPoints - 1,
    attributes: before.attributes.map(row => ({ ...row, value: row.value + (row.id === 'strength' ? 1 : 0) })),
    derived: { ...before.derived, maxHealth: 32, carryWeight: 4500, damageBonus: 0 } }
}

test('attribute purchase waits for private conservation and tolerates its public commit before ACK', async () => {
  const { client, apply } = characterReplica()
  await client.refreshCharacter()
  const before = characterView(), after = boughtStrength(before), commandId = client.authority.nextId
  let acknowledge, submitted
  const sent = new Promise(resolve => { submitted = resolve })
  client.authority.buyAttribute = (actorId, statId, revision) => {
    assert.deepEqual([actorId, statId, revision], ['0', 'strength', 1]); submitted()
    return new Promise(resolve => { acknowledge = resolve })
  }
  const buying = client.spendCharacterPoint('strength')
  await sent
  assert.equal(client.characterState.status, 'pending')
  assert.equal(client.characterState.attributes, undefined, 'no optimistic attribute increment')
  await assert.rejects(client.refreshCharacter(), { code: 'BUSY' })
  await assert.rejects(client.movePlayerTo([3, 2]), { code: 'BUSY' })
  await assert.rejects(client.saveCheckpoint(), { code: 'BUSY' })
  apply({ revision: 2, lastCommand: { id: commandId, type: 'buy-attribute', status: 'completed', result: { kind: 'buy-attribute' } } })
  assert.equal(client.characterState.status, 'pending')
  acknowledge({ status: 'completed', revision: 2, result: { kind: 'buy-attribute', statId: 'strength', character: after } })
  await buying
  assert.equal(client.characterState.attributes[0].value, 9)
  assert.equal(client.characterState.unspentPoints, 4)
  assert.equal(client.characterState.derived.damageBonus, 0)
  assert.equal(client.characterRequest, null)
})

test('buy uses a current world revision while unchanged private attributes may predate movement', async () => {
  const { client, apply } = characterReplica()
  await client.refreshCharacter()
  apply({ revision: 7, location: [3, 2], lastCommand: { id: 50, status: 'completed' } })
  client.authority.buyAttribute = async (_actor, _statId, revision) => {
    assert.equal(revision, 7)
    return { status: 'completed', revision: 8, result: { kind: 'buy-attribute', statId: 'strength', character: boughtStrength(characterView()) } }
  }
  await client.spendCharacterPoint('strength')
  assert.equal(client.characterState.revision, 8)
})

test('attribute purchases reject unknown, unavailable, unsupported and paused choices before transport', async () => {
  const { client } = characterReplica()
  client.authority.buyAttribute = () => assert.fail('Invalid purchase reached transport')
  await assert.rejects(client.spendCharacterPoint('strength'), { code: 'PROGRESSION_UNAVAILABLE' })
  await client.refreshCharacter()
  await assert.rejects(client.spendCharacterPoint('luck'), { code: 'INVALID_ATTRIBUTE' })
  client.characterState.attributes[0].canIncrease = false
  client.characterState.attributes[0].reason = 'Attribute is at its maximum.'
  await assert.rejects(client.spendCharacterPoint('strength'), { code: 'ATTRIBUTE_UNAVAILABLE' })
  client.authorityState.pause = { supported: true, paused: true }
  await assert.rejects(client.spendCharacterPoint('dexterity'), { code: 'PAUSED' })
})

test('malformed attribute rows and derived values never enter private character presentation', async () => {
  for (const change of [view => { view.attributes[1].id = view.attributes[0].id }, view => { view.attributes.pop() },
    view => { view.attributes[0].value = 21 }, view => { view.attributes[0].pointCost = 0 },
    view => { view.attributes[0].maximum = 30 }, view => { view.attributes[0].canIncrease = 'yes' },
    view => { view.derived.speed = 26 }, view => { delete view.derived.maxHealth }, view => { view.derived.damageBonus = -5 }] as const) {
    const { client } = characterReplica(), view = characterView(); change(view)
    client.authority.character = async () => ({ status: 'completed', revision: 1, result: view })
    await assert.rejects(client.refreshCharacter(), /invalid/i)
    assert.equal(client.characterState.attributes, undefined)
    assert.equal(client.characterState.derived, undefined)
  }
})

test('malformed purchase ACK cannot grant extra stats or points and rereads once', async () => {
  for (const change of [view => { view.unspentPoints = 5 }, view => { view.attributes[0].value = 10 },
    view => { view.attributes[1].value = 9 }, view => { view.experiencePoints = 2100 }] as const) {
    const { client } = characterReplica()
    await client.refreshCharacter()
    let reads = 0, purchases = 0
    const invalid = boughtStrength(characterView()); change(invalid)
    client.authority.buyAttribute = async () => { purchases++; return { status: 'completed', revision: 2,
      result: { kind: 'buy-attribute', statId: 'strength', character: invalid } } }
    client.authority.character = async () => { reads++; return { status: 'completed', revision: 2, result: characterView() } }
    await assert.rejects(client.spendCharacterPoint('strength'), /invalid|inconsistent/i)
    assert.equal(reads, 1); assert.equal(purchases, 1)
    assert.equal(client.characterState.unspentPoints, 5)
    assert.equal(client.characterState.attributes[0].value, 8)
    assert.equal(client.characterState.status, 'ready')
  }
})

test('a timed-out purchase reloads committed private stats without retrying or losing the recovery view', async () => {
  const { client, apply } = characterReplica()
  await client.refreshCharacter()
  let writes = 0, reads = 0
  client.authority.buyAttribute = async () => {
    writes++
    apply({ revision: 2, lastCommand: { id: client.authority.nextId, type: 'buy-attribute', status: 'completed', result: { kind: 'buy-attribute' } } })
    throw new Error('Purchase ACK timed out')
  }
  client.authority.character = async () => { reads++; return { status: 'completed', revision: 2, result: boughtStrength(characterView()) } }
  await assert.rejects(client.spendCharacterPoint('strength'), /timed out/)
  assert.equal(writes, 1); assert.equal(reads, 1)
  assert.equal(client.characterState.attributes[0].value, 9)
  assert.equal(client.characterState.unspentPoints, 4)
  assert.equal(client.characterState.status, 'ready')
})

test('external purchases invalidate private values and old read ACKs cannot overwrite them', async () => {
  const { client, apply } = characterReplica()
  await client.refreshCharacter()
  let acknowledge
  client.authority.character = () => new Promise(resolve => { acknowledge = resolve })
  const reading = client.refreshCharacter()
  apply({ revision: 9, lastCommand: { id: 80, type: 'buy-attribute', status: 'completed', result: { kind: 'buy-attribute' } } })
  assert.equal(client.characterState.status, 'stale')
  acknowledge({ status: 'completed', revision: 1, result: characterView() })
  await assert.rejects(reading, { code: 'CHARACTER_SUPERSEDED' })
  assert.equal(client.characterState.attributes, undefined)
})

test('late purchase ACK after stop cannot restore attributes, balances or recovery requests', async () => {
  const { client } = characterReplica()
  await client.refreshCharacter()
  let acknowledge
  client.authority.buyAttribute = () => new Promise(resolve => { acknowledge = resolve })
  client.authority.character = () => assert.fail('Stopped purchase must not read again')
  const buying = client.spendCharacterPoint('strength')
  client.stop()
  acknowledge({ status: 'completed', revision: 2, result: { kind: 'buy-attribute', statId: 'strength', character: boughtStrength(characterView()) } })
  await assert.rejects(buying, /stopped/i)
  assert.equal(client.characterState, null)
})
