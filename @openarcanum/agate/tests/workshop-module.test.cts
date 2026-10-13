const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const { before, test } = require('node:test') as typeof import('node:test')
const fs = require('node:fs/promises') as typeof import('node:fs/promises')
const os = require('node:os') as typeof import('node:os')
const path = require('node:path') as typeof import('node:path')
const zlib = require('node:zlib') as typeof import('node:zlib')
const Module = require('node:module') as typeof import('node:module')
const EventEmitter = require('node:events') as typeof import('node:events')
const StreamZip = require('node-stream-zip') as typeof import('node-stream-zip')

const root = path.resolve(__dirname, '../../..')
const source = path.join(root, '@openarcanum/agate/src')
const directory = path.join(root, 'examples/inventory-workshop')
const dataPath = path.join(directory, 'data')
const { buildFiles, manifest, MAP_ID, BOX_ID, TOKEN_ID, TOKEN_LABEL, DOOR_ID,
  KEY_BOX_ID, KEY_ID, LOCKED_DOOR_ID, LOCK_KEY_ID, LOCKED_BOX_ID, PRIZE_ID,
  PRIZE_LABEL, GROUND_ITEM_ID, GROUND_ITEM_LABEL, NPC_ID, NPC_LABEL, CONVERSATION_ID,
  QUEST_ID, QUEST_TITLE, QUEST_EXPERIENCE_REWARD, PROGRESSION_BASELINE,
  DIRECTIONS, BALLAST_BOX_ID, BALLAST_ID, BALLAST_LABEL, BALLAST_WEIGHT } = require('../../../examples/inventory-workshop/generate.cts')
let engine

function baselineCharacter() {
  return { kind: 'character', supported: true, experiencePoints: 0, level: 1, unspentPoints: 5,
    nextLevelExperience: QUEST_EXPERIENCE_REWARD,
    attributes: Object.entries(PROGRESSION_BASELINE.attributes).map(([id, value]) => ({
      id, label: id[0].toUpperCase() + id.slice(1), value, maximum: 20, pointCost: 1, canIncrease: true })),
    derived: { maxHealth: 30, maxFatigue: 30, carryWeight: 4000, damageBonus: -1,
      armorClassAdjustment: -2, speed: 8, healRate: 3, poisonRecovery: 8,
      reactionModifier: -7, maxFollowers: 2 } }
}

before(async () => {
  const { build } = await import('esbuild')
  const result = await build({
    absWorkingDir: root,
    stdin: { contents: `
      export { createAuthorityServer } from './server/authority/AuthorityServer.ts';
      export { default as GameMap } from './shared/map/GameMap.ts';
      export { default as GfxPathBuilder } from './shared/assets/GfxPathBuilder.ts';
    `, resolveDir: source, sourcefile: 'workshop-module-test-entry.js' },
    bundle: true, platform: 'node', format: 'cjs', target: 'node24', write: false,
    external: ['electron', 'workerpool'], loader: { '.glsl': 'text' },
  })
  const compiled = new Module(path.join(__dirname, 'workshop-module-test-bundle.cjs'), module)
  compiled.filename = path.join(__dirname, 'workshop-module-test-bundle.cjs')
  compiled.paths = Module._nodeModulePaths(root)
  compiled._compile(result.outputFiles[0].text, compiled.filename)
  engine = compiled.exports
})

function pngInfo(bytes) {
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  let offset = 8, width, height
  const compressed = []
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset)
    const type = bytes.toString('ascii', offset + 4, offset + 8)
    const body = bytes.subarray(offset + 8, offset + 8 + length)
    assert.ok(offset + length + 12 <= bytes.length, 'PNG chunk remains inside its file')
    if (type === 'IHDR') {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4)
      assert.equal(body[8], 8); assert.equal(body[9], 6)
    }
    if (type === 'IDAT') compressed.push(body)
    offset += length + 12
  }
  assert.equal(offset, bytes.length)
  const pixels = zlib.inflateSync(Buffer.concat(compressed))
  assert.equal(pixels.length, (width * 4 + 1) * height)
  for (let y = 0; y < height; y++) assert.equal(pixels[y * (width * 4 + 1)], 0)
  return { width, height, pixels }
}

test('owned workshop source, metadata and generated archives reproduce exactly without retail files', async () => {
  const files = buildFiles()
  const recorded = JSON.parse(await fs.readFile(path.join(directory, 'module.json'), 'utf8'))
  assert.deepEqual(recorded, manifest(files))
  assert.equal(recorded.format, 'openarcanum-owned-module')
  assert.equal(recorded.version, 1)
  assert.equal(recorded.mapId, MAP_ID)
  assert.equal(recorded.files.length, 95)
  assert.equal(new Set(recorded.files).size, recorded.files.length)
  for (const [name, expected] of files) {
    assert.equal(path.posix.normalize(name), name)
    assert.equal(path.posix.isAbsolute(name), false)
    assert.equal(name.split('/').includes('..'), false)
    assert.deepEqual(await fs.readFile(path.join(dataPath, name)), expected, name)
  }
  assert.deepEqual(JSON.parse(files.get('16086.json')).Critter,
    { inventory: [], inventoryIndex: 0, inventorySource: 0, progressionSupported: true })
  assert.deepEqual(JSON.parse(files.get('rules/Progression.json')),
    { version: 2, actorId: '16086.json', profile: 'neutral-human', baseline: PROGRESSION_BASELINE })
  assert.equal(Object.hasOwn(JSON.parse(files.get('16086.json')).Critter, 'stats'), false,
    'authored progression does not mirror the legacy stat component')
  assert.equal(JSON.parse(files.get('16086.json')).Base.prototype, 900001)
  assert.deepEqual(JSON.parse(files.get(`${MAP_ID}/Map.json`)).startLocation, [4, 4])
  assert.deepEqual(JSON.parse(files.get(BOX_ID)).Container.inventory, [{ id: TOKEN_ID, slot: 3 }])
  assert.equal(JSON.parse(files.get(TOKEN_ID)).Item.parent, BOX_ID)
  assert.equal(JSON.parse(files.get(TOKEN_ID)).Item.invLocation, 7)
  const tokenPrototype = JSON.parse(files.get('Prototypes/Generic/900003.json'))
  assert.equal(tokenPrototype.Base.descIndex, 9003)
  assert.equal(tokenPrototype.Item.magicTechComplexity, 0)
  assert.deepEqual(JSON.parse(files.get('mes/Description.json')),
    { Description: [{ id: '9003', text: TOKEN_LABEL }, { id: '9006', text: PRIZE_LABEL },
      { id: '9007', text: GROUND_ITEM_LABEL }, { id: '9009', text: BALLAST_LABEL }] })
  assert.deepEqual(JSON.parse(files.get(BALLAST_BOX_ID)), { Base: { prototype: 900002, location: [11, 2] },
    Container: { inventory: [{ id: BALLAST_ID, slot: 3 }], inventoryIndex: 1 } })
  assert.deepEqual(JSON.parse(files.get(BALLAST_ID)), { Base: { prototype: 900009, location: [11, 2] },
    Item: { parent: BALLAST_BOX_ID, invLocation: 0 } })
  const ballastPrototype = JSON.parse(files.get('Prototypes/Generic/900009.json'))
  assert.equal(ballastPrototype.Base.descIndex, 9009)
  assert.deepEqual(ballastPrototype.Item, { flags: [], weight: BALLAST_WEIGHT, worth: 0, invLocation: 0,
    magicTechComplexity: 0, groundTransferSupported: true })
  assert.deepEqual(ballastPrototype.Visual.classes.current, { type: 'Item', category: 'Workshop',
    subcat: 'Base', number: 1, display: 'Ground', stage: 'North', frame: 0 })
  assert.deepEqual(JSON.parse(files.get(KEY_BOX_ID)).Base.location, [3, 7])
  assert.deepEqual(JSON.parse(files.get(KEY_BOX_ID)).Container.inventory, [{ id: KEY_ID, slot: 3 }])
  assert.equal(JSON.parse(files.get(KEY_ID)).Item.parent, KEY_BOX_ID)
  assert.equal(JSON.parse(files.get(KEY_ID)).Item.invLocation, 0)
  const keyPrototype = JSON.parse(files.get('Prototypes/Key/900005.json'))
  assert.equal(keyPrototype.Base.type, 'Key')
  assert.deepEqual(keyPrototype.Base.flags, ['Inventory', 'NoBlock'])
  assert.deepEqual(keyPrototype.Item.flags, [])
  assert.equal(keyPrototype.Item.magicTechComplexity, 0)
  assert.equal(keyPrototype.Key.keyId, LOCK_KEY_ID)
  const lockedDoor = JSON.parse(files.get(LOCKED_DOOR_ID))
  assert.deepEqual(lockedDoor.Base.location, [10, 6])
  assert.deepEqual(lockedDoor.Portal, { flags: ['Locked'], keyID: LOCK_KEY_ID, keyUseSupported: true })
  assert.equal(Object.hasOwn(JSON.parse(files.get(DOOR_ID)), 'Portal'), false,
    'the existing unlocked door does not gain a key policy')
  const lockedBox = JSON.parse(files.get(LOCKED_BOX_ID))
  assert.deepEqual(lockedBox.Base.location, [6, 8])
  assert.deepEqual(lockedBox.Container, { flags: ['Locked'], keyId: LOCK_KEY_ID, keyUseSupported: true,
    inventory: [{ id: PRIZE_ID, slot: 3 }], inventoryIndex: 1 })
  assert.equal(JSON.parse(files.get(PRIZE_ID)).Item.parent, LOCKED_BOX_ID)
  assert.equal(JSON.parse(files.get(PRIZE_ID)).Item.invLocation, 0)
  const prizePrototype = JSON.parse(files.get('Prototypes/Generic/900006.json'))
  assert.equal(prizePrototype.Base.descIndex, 9006)
  assert.equal(prizePrototype.Item.magicTechComplexity, 0)
  const pebblePrototype = JSON.parse(files.get('Prototypes/Generic/900007.json'))
  assert.equal(pebblePrototype.Base.descIndex, 9007)
  assert.deepEqual(pebblePrototype.Base.flags, ['NoBlock'])
  assert.deepEqual(pebblePrototype.Item, { flags: [], weight: 1, worth: 0, invLocation: 0,
    magicTechComplexity: 0, groundTransferSupported: true })
  assert.deepEqual(pebblePrototype.Visual.classes.current, { type: 'Item', category: 'Workshop',
    subcat: 'Base', number: 0, display: 'Ground', stage: 'North', frame: 0 })
  assert.deepEqual(JSON.parse(files.get(GROUND_ITEM_ID)), { Base: { prototype: 900007, location: [4, 7] },
    Item: { parent: null, invLocation: 0 } })
  for (const prototype of [tokenPrototype, keyPrototype, prizePrototype] as const) {
    assert.equal(Object.hasOwn(prototype.Item, 'groundTransferSupported'), false,
      'existing carried items do not acquire ground-transfer policy or artwork')
    assert.equal(Object.hasOwn(prototype, 'Visual'), false)
  }
  const guidePrototype = JSON.parse(files.get('Prototypes/Npc/900008.json'))
  assert.equal(guidePrototype.Base.type, 'Npc')
  assert.deepEqual(guidePrototype.Critter, { flags: [], inventoryIndex: 0, inventorySource: 0 })
  assert.deepEqual(guidePrototype.Npc, { flags: [], waypoints: [], conversationSupported: true,
    conversationId: CONVERSATION_ID })
  assert.deepEqual(JSON.parse(files.get(NPC_ID)), { Base: { prototype: 900008, location: [9, 8] } })
  const conversations = JSON.parse(files.get('rules/Conversations.json'))
  assert.equal(conversations.version, 1)
  assert.deepEqual(conversations.quests.map(quest => [quest.id, quest.title]), [[QUEST_ID, QUEST_TITLE]])
  assert.equal(conversations.quests[0].rewardExperience, QUEST_EXPERIENCE_REWARD)
  assert.equal(conversations.conversations.length, 1)
  const conversation = conversations.conversations[0]
  assert.deepEqual([conversation.id, conversation.targetId, conversation.label, conversation.questId],
    [CONVERSATION_ID, NPC_ID, NPC_LABEL, QUEST_ID])
  assert.deepEqual(conversation.nodes.map(node => node.id), ['offer', 'active', 'completed'])
  assert.deepEqual(conversation.nodes[0].options.map(option => [option.id, option.effect]),
    [['accept', 'start'], ['leave', 'close']])
  assert.deepEqual(conversation.nodes[1].options.map(option => [option.id, option.effect]),
    [['show', 'complete'], ['leave', 'close']])
  assert.deepEqual(conversation.nodes[1].options[0].condition, { kind: 'held-item', itemId: GROUND_ITEM_ID })
  assert.deepEqual(conversation.nodes[2].options.map(option => [option.id, option.effect]), [['leave', 'close']])
})

test('owned ZIP catalogs contain exactly the readable prototypes, map records and artwork', async () => {
  const files = buildFiles()
  for (const [filename, prefix] of [['Prototypes.zip', 'Prototypes/'], [`${MAP_ID}.zip`, `${MAP_ID}/`], ['Gfx.zip', 'Gfx/']] as const) {
    const archive = new StreamZip.async({ file: path.join(dataPath, 'archives', filename) })
    try {
      const entries = await archive.entries()
      const expected = [...files.keys()].filter(name => name.startsWith(prefix)).sort()
      assert.deepEqual(Object.keys(entries).sort(), expected)
      for (const name of expected) assert.deepEqual(await archive.entryData(name), files.get(name), name)
    } finally { await archive.close() }
  }
})

test('owned PNG atlases cover every declared frame, direction and animation with real artwork', () => {
  const files = buildFiles()
  let sheets = 0
  for (const [name, bytes] of files) {
    if (!name.endsWith('/Stage.json') && name !== 'Gfx/2D/Tile/tiles.json') continue
    const textureName = name.endsWith('/Stage.json') ? name.replace(/Stage\.json$/, 'Sprite.png') : 'Gfx/2D/Tile/tiles.png'
    const { width, height, pixels } = pngInfo(files.get(textureName))
    const frames = JSON.parse(bytes).frames
    for (const [key, value] of Object.entries(frames)) {
      const { x, y, w, h } = (value as {frame: {x: number; y: number; w: number; h: number}}).frame
      assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= width && y + h <= height, key)
      assert.ok((value as {center: {x: number; y: number}}).center.x >= 0 && (value as {center: {x: number; y: number}}).center.x <= w && (value as {center: {x: number; y: number}}).center.y >= 0 && (value as {center: {x: number; y: number}}).center.y <= h)
      let opaque = false
      for (let yy = y; yy < y + h && !opaque; yy++) for (let xx = x; xx < x + w; xx++) {
        if (pixels[yy * (width * 4 + 1) + 1 + xx * 4 + 3]) { opaque = true; break }
      }
      assert.equal(opaque, true, key)
    }
    sheets++
  }
  assert.equal(sheets, 29)
  for (const animation of ['Stand', 'Walk'] as const) {
    const prefix = `Gfx/2D/Critter/Workshop/Male/Coat/None/Unarmed/${animation}`
    const metadata = JSON.parse(files.get(`${prefix}/Meta.json`))
    assert.equal(metadata.imageExtension, 'png')
    assert.equal(metadata.animated, animation === 'Walk')
    for (const direction of DIRECTIONS) {
      assert.equal(Object.keys(JSON.parse(files.get(`${prefix}/0/${direction}/Stage.json`)).frames).length,
        animation === 'Walk' ? 4 : 1)
    }
  }
  for (const filename of ['Prototypes/Pc/900001.json', 'Prototypes/Container/900002.json',
    'Prototypes/Portal/900004.json', 'Prototypes/Generic/900007.json', 'Prototypes/Npc/900008.json',
    'Prototypes/Generic/900009.json'] as const) {
    const visual = JSON.parse(files.get(filename)).Visual.classes.current
    assert.ok(files.has(`Gfx/2D/${engine.GfxPathBuilder.build(visual)}/Meta.json`), filename)
  }
  const tileFrames = JSON.parse(files.get('Gfx/2D/Tile/tiles.json')).frames
  for (const version of [0, 1] as const) {
    const graphicPath = engine.GfxPathBuilder.build({ type: 'Tile', start: { category: 'Workshop', version },
      end: { category: 'Workshop', version: 0 } })
    assert.ok(tileFrames[`${graphicPath}/0/North/Sprite.gif`])
  }
})

test('the owned workshop loads headlessly and privately inspects its reciprocal item without an original installation', async t => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'agate-owned-workshop-'))
  const server = engine.createAuthorityServer({ dataPath, mapId: MAP_ID,
    checkpointPath: path.join(temporary, 'checkpoint.json') })
  t.after(async () => { await server.stop(); await fs.rm(temporary, { recursive: true, force: true }) })
  await server.loadWorld()
  assert.equal(server.map.width, 1)
  assert.equal(server.map.height, 1)
  assert.equal(server.world.entityManager.prototypes.size, 9)
  assert.equal(server.world.entityManager.systems.size, 0)
  assert.deepEqual([server.player.base.location.x, server.player.base.location.y], [4, 4])
  assert.deepEqual(server.player.critter.inventory, [])
  assert.equal(Object.hasOwn(server.player.critter, 'inventory'), true)
  const initial = server.getSnapshot()
  assert.deepEqual(initial.containers, [{ id: BALLAST_BOX_ID, kind: 'container', label: 'Container',
    location: [11, 2], locked: false, usable: true }, { id: BOX_ID, kind: 'container', label: 'Container',
    location: [6, 4], locked: false, usable: true },
  { id: KEY_BOX_ID, kind: 'container', label: 'Container', location: [3, 7], locked: false, usable: true },
  { id: LOCKED_BOX_ID, kind: 'container', label: 'Container', location: [6, 8], locked: true, usable: true }])
  assert.equal(initial.doors[0].id, DOOR_ID)
  assert.equal(initial.doors[0].open, false)
  assert.equal(server.map.isTileBlocked(0, 0), true)
  assert.equal(server.map.isTileBlocked(12, 10), false)
  assert.equal(server.map.isTileBlocked(6, 4), true)
  const owner = { data: { joined: true, role: 'owner' } }
  const request = (id, type, extra = {}) => ({ version: 1, id, actorId: '0', type, ...extra })
  const accepted = server.command(owner, request(1, 'use', { targetId: BOX_ID }))
  assert.equal(accepted.status, 'accepted')
  assert.deepEqual(accepted.path, [[4, 4], [5, 4]])
  server.advanceMovement(performance.now() + 1100)
  const inspected = server.command(owner, request(2, 'inspect', { targetId: BOX_ID }))
  assert.equal(inspected.ok, true)
  assert.deepEqual(inspected.result, { kind: 'container', targetId: BOX_ID, items: [
    { id: TOKEN_ID, slot: 3, label: TOKEN_LABEL, type: 'Generic', prototypeId: 900003, weight: 1 },
  ] })
  const publicState = JSON.stringify(server.getSnapshot())
  assert.equal(publicState.includes(TOKEN_ID), false)
  assert.equal(publicState.includes('"items"'), false)
  assert.equal(server.command({ data: { joined: true, role: 'observer' } },
    request(3, 'inspect', { targetId: BOX_ID })).code, 'FORBIDDEN')
  assert.equal((await server.command(owner, request(3, 'save'))).ok, true)
  const checkpoint = JSON.parse(await fs.readFile(path.join(temporary, 'checkpoint.json'), 'utf8'))
  assert.deepEqual(checkpoint.actor.location, [5, 4])
  assert.deepEqual(checkpoint.doors, [{ id: DOOR_ID, open: false }, { id: LOCKED_DOOR_ID, open: false }])
  assert.equal(checkpoint.version, 6)
  assert.deepEqual(checkpoint.ownership, { owners: [
    { id: '16086.json', inventoryIndex: 0, items: [] },
    { id: BALLAST_BOX_ID, inventoryIndex: 1, items: [{ id: BALLAST_ID, slot: 3 }] },
    { id: BOX_ID, inventoryIndex: 1, items: [{ id: TOKEN_ID, slot: 3 }] },
    { id: KEY_BOX_ID, inventoryIndex: 1, items: [{ id: KEY_ID, slot: 3 }] },
    { id: LOCKED_BOX_ID, inventoryIndex: 1, items: [{ id: PRIZE_ID, slot: 3 }] },
  ], items: [{ id: BALLAST_ID, parent: BALLAST_BOX_ID, groundLocation: null },
    { id: GROUND_ITEM_ID, parent: null, groundLocation: [4, 7] },
    { id: PRIZE_ID, parent: LOCKED_BOX_ID, groundLocation: null },
    { id: TOKEN_ID, parent: BOX_ID, groundLocation: null },
    { id: KEY_ID, parent: KEY_BOX_ID, groundLocation: null }] })
  assert.equal(JSON.stringify(server.getSnapshot()).includes(TOKEN_ID), false, 'persisted private ownership stays out of public snapshots')
})

test('the owned key must be taken before opening its authored door and is neither consumed nor an unlock mutation', async t => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'agate-owned-workshop-key-'))
  const server = engine.createAuthorityServer({ dataPath, mapId: MAP_ID,
    checkpointPath: path.join(temporary, 'checkpoint.json') })
  t.after(async () => { await server.stop(); await fs.rm(temporary, { recursive: true, force: true }) })
  await server.loadWorld()
  const owner = { data: { joined: true, role: 'owner' } }
  let id = 0
  const request = (type, extra = {}) => server.command(owner,
    { version: 1, id: ++id, actorId: '0', type, ...extra })
  const approach = targetId => {
    const result = request('use', { targetId })
    assert.equal(result.ok, true)
    server.advanceMovement(performance.now() + 10000)
  }
  const door = () => server.getSnapshot().doors.find(entry => entry.id === LOCKED_DOOR_ID)
  assert.deepEqual(server.player.critter.inventory, [])
  assert.equal(door().locked, true)
  assert.equal(door().open, false)
  assert.equal(request('use', { targetId: LOCKED_DOOR_ID }).code, 'LOCKED')

  approach(KEY_BOX_ID)
  const inspected = request('inspect', { targetId: KEY_BOX_ID })
  assert.deepEqual(inspected.result.items,
    [{ id: KEY_ID, slot: 3, label: 'Key', type: 'Key', prototypeId: 900005, weight: 1 }])
  const taken = request('take', { targetId: KEY_BOX_ID, itemId: KEY_ID, expectedRevision: server.revision })
  assert.equal(taken.ok, true)
  assert.deepEqual(taken.result.inventory.items,
    [{ id: KEY_ID, slot: 0, label: 'Key', type: 'Key', prototypeId: 900005, weight: 1 }])
  const key = server.ownership.items.get(KEY_ID).entity
  assert.equal(key.item.parent, '16086.json')
  assert.equal(key.key.keyId, LOCK_KEY_ID)

  approach(LOCKED_DOOR_ID)
  assert.equal(door().open, true)
  assert.equal(door().locked, true, 'matching key authorizes opening while the original lock stays set')
  assert.deepEqual([...server.doors.states.get(LOCKED_DOOR_ID).entity.portal.flags], ['Locked'])
  assert.deepEqual(request('inventory').result.items, taken.result.inventory.items, 'the key remains possessed')
  assert.deepEqual(server.ownership.actorInventory().items.map(entry => entry.id), [KEY_ID])
  assert.equal(key.item.parent, '16086.json')
  assert.equal(key.item.invLocation, 0)
  const publicState = JSON.stringify(server.getSnapshot())
  assert.equal(publicState.includes(KEY_ID), false)
  assert.equal(publicState.includes(String(LOCK_KEY_ID)), false)
  assert.equal((await request('save')).ok, true)
  const checkpoint = JSON.parse(await fs.readFile(path.join(temporary, 'checkpoint.json'), 'utf8'))
  assert.equal(checkpoint.doors.find(entry => entry.id === LOCKED_DOOR_ID).open, true)
  assert.deepEqual(checkpoint.ownership.owners.find(entry => entry.id === '16086.json').items,
    [{ id: KEY_ID, slot: 0 }])
  assert.equal(checkpoint.ownership.items.find(entry => entry.id === KEY_ID).parent, '16086.json')
})

test('the owned locked crate requires its held key for private access and conserves its named prize through restart', async t => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'agate-owned-workshop-locked-box-'))
  const checkpointPath = path.join(temporary, 'checkpoint.json'), hosts = []
  t.after(async () => {
    for (const host of hosts) await host.stop()
    await fs.rm(temporary, { recursive: true, force: true })
  })
  const start = async () => {
    const server = engine.createAuthorityServer({ dataPath, mapId: MAP_ID, checkpointPath })
    hosts.push(server)
    await server.loadWorld()
    let id = 0
    const request = (type, extra = {}) => server.command({ data: { joined: true, role: 'owner' } },
      { version: 1, id: ++id, actorId: '0', type, ...extra })
    const approach = targetId => {
      assert.equal(request('use', { targetId }).ok, true)
      server.advanceMovement(performance.now() + 10000)
    }
    const transfer = (type, targetId, itemId?) => request(type, { targetId,
      ...(itemId ? { itemId } : {}), expectedRevision: server.revision })
    return { server, request, approach, transfer }
  }
  const first = await start()
  assert.equal(first.request('use', { targetId: LOCKED_BOX_ID }).code, 'LOCKED')
  assert.equal(first.request('inspect', { targetId: LOCKED_BOX_ID }).code, 'LOCKED')
  first.approach(KEY_BOX_ID)
  assert.equal(first.request('inspect', { targetId: KEY_BOX_ID }).ok, true)
  assert.equal(first.transfer('take', KEY_BOX_ID, KEY_ID).ok, true)
  first.approach(LOCKED_BOX_ID)
  assert.deepEqual(first.request('inspect', { targetId: LOCKED_BOX_ID }).result.items,
    [{ id: PRIZE_ID, slot: 3, label: PRIZE_LABEL, type: 'Generic', prototypeId: 900006, weight: 1 }])
  assert.equal(first.transfer('take-all', LOCKED_BOX_ID).ok, true)
  const inventory = first.request('inventory').result.items
  assert.deepEqual(inventory.map(row => [row.id, row.slot]), [[KEY_ID, 0], [PRIZE_ID, 1]])
  assert.equal(inventory[1].label, PRIZE_LABEL)
  assert.equal(first.request('inspect', { targetId: LOCKED_BOX_ID }).ok, true)
  assert.equal(first.transfer('put', LOCKED_BOX_ID, PRIZE_ID).ok, true)
  assert.deepEqual(first.request('inspect', { targetId: LOCKED_BOX_ID }).result.items,
    [{ id: PRIZE_ID, slot: 0, label: PRIZE_LABEL, type: 'Generic', prototypeId: 900006, weight: 1 }])
  assert.equal(first.transfer('take', LOCKED_BOX_ID, PRIZE_ID).ok, true)
  first.approach(KEY_BOX_ID)
  assert.equal(first.request('inspect', { targetId: KEY_BOX_ID }).ok, true)
  assert.equal(first.transfer('put', KEY_BOX_ID, KEY_ID).ok, true)
  assert.equal(first.request('use', { targetId: LOCKED_BOX_ID }).code, 'LOCKED')
  assert.equal(first.request('inspect', { targetId: LOCKED_BOX_ID }).code, 'LOCKED')
  assert.equal(first.transfer('put', LOCKED_BOX_ID, PRIZE_ID).code, 'LOCKED',
    'fresh revision cannot replace current possession')
  assert.deepEqual(first.request('inventory').result.items,
    [{ id: PRIZE_ID, slot: 1, label: PRIZE_LABEL, type: 'Generic', prototypeId: 900006, weight: 1 }])
  const box = first.server.containers.states.get(LOCKED_BOX_ID).entity
  assert.deepEqual([...box.container.flags], ['Locked'])
  assert.equal(box.container.keyId, LOCK_KEY_ID)
  assert.equal(first.server.ownership.items.get(KEY_ID).entity.item.parent, KEY_BOX_ID)
  assert.equal(first.server.ownership.items.get(PRIZE_ID).entity.item.parent, '16086.json')
  const publicState = JSON.stringify(first.server.getSnapshot())
  assert.equal(publicState.includes(PRIZE_ID), false)
  assert.equal(publicState.includes(PRIZE_LABEL), false)
  assert.equal((await first.request('save')).ok, true)
  const saved = await fs.readFile(checkpointPath, 'utf8')
  await first.server.stop()

  const second = await start()
  assert.equal((await second.request('load')).ok, true)
  assert.deepEqual(second.request('inventory').result.items,
    [{ id: PRIZE_ID, slot: 1, label: PRIZE_LABEL, type: 'Generic', prototypeId: 900006, weight: 1 }])
  assert.equal(second.request('inspect', { targetId: LOCKED_BOX_ID }).code, 'LOCKED')
  assert.equal(second.server.ownership.items.get(KEY_ID).entity.item.parent, KEY_BOX_ID)
  assert.deepEqual([...second.server.containers.states.get(LOCKED_BOX_ID).entity.container.flags], ['Locked'])
  assert.equal(await fs.readFile(checkpointPath, 'utf8'), saved)
})

test('the ballast advertises Drop and preserves the same weighted identity through its first Drop and Pickup', async t => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'agate-owned-workshop-ballast-'))
  const server = engine.createAuthorityServer({ dataPath, mapId: MAP_ID,
    checkpointPath: path.join(temporary, 'checkpoint.json') })
  t.after(async () => { await server.stop(); await fs.rm(temporary, { recursive: true, force: true }) })
  await server.loadWorld()
  let id = 0
  const request = (type, extra = {}) => server.command({ data: { joined: true, role: 'owner' } },
    { version: 1, id: ++id, actorId: '0', type, ...extra })
  const ballast = server.ownership.items.get(BALLAST_ID).entity
  assert.equal(ballast.ground, false, 'the first Drop starts from a contained item that was never on the floor')
  assert.equal(request('use', { targetId: BALLAST_BOX_ID }).ok, true)
  server.advanceMovement(performance.now() + 10000)
  const inspected = request('inspect', { targetId: BALLAST_BOX_ID })
  assert.equal(inspected.ok, true)
  assert.deepEqual(inspected.result.items, [{ id: BALLAST_ID, slot: 3, label: BALLAST_LABEL,
    type: 'Generic', prototypeId: 900009, canDrop: true, weight: BALLAST_WEIGHT }])
  const taken = request('take', { targetId: BALLAST_BOX_ID, itemId: BALLAST_ID, expectedRevision: server.revision })
  assert.equal(taken.ok, true)
  assert.equal(taken.result.inventory.items[0].canDrop, true)
  assert.deepEqual(taken.result.inventory.carrying,
    { supported: true, weight: BALLAST_WEIGHT, capacity: BALLAST_WEIGHT, encumbrance: 'severe' })
  assert.equal(server.ownership.items.get(BALLAST_ID).entity === ballast, true)
  const location = [server.player.base.location.x, server.player.base.location.y]
  const dropped = request('drop', { itemId: BALLAST_ID, expectedRevision: server.revision })
  assert.equal(dropped.ok, true)
  assert.deepEqual(dropped.result.ground, { id: BALLAST_ID, kind: 'ground', label: BALLAST_LABEL,
    type: 'Generic', prototypeId: 900009, location })
  assert.deepEqual(dropped.result.inventory.carrying,
    { supported: true, weight: 0, capacity: BALLAST_WEIGHT, encumbrance: 'none' })
  assert.equal(ballast.item.parent, null)
  assert.equal(ballast.ground, true)
  assert.equal(server.getSnapshot().groundItems.filter(item => item.id === BALLAST_ID).length, 1)
  assert.equal(request('use', { targetId: BALLAST_ID }).ok, true)
  server.advanceMovement(performance.now() + 10000)
  const pickedUp = request('pickup', { targetId: BALLAST_ID, expectedRevision: server.revision })
  assert.equal(pickedUp.ok, true)
  assert.deepEqual(pickedUp.result.inventory.items, [{ id: BALLAST_ID, slot: 0, label: BALLAST_LABEL,
    type: 'Generic', prototypeId: 900009, canDrop: true, weight: BALLAST_WEIGHT }])
  assert.equal(server.ownership.items.get(BALLAST_ID).entity === ballast, true)
  assert.equal(ballast.item.parent, '16086.json')
  assert.equal(ballast.ground, false)
  assert.equal(server.getSnapshot().groundItems.some(item => item.id === BALLAST_ID), false)
  assert.equal(server.ownership.items.size, 5, 'Drop and Pickup do not create another item')
})

test('the authored ground pebble is conserved through pickup, actor-tile drop and both checkpoint directions', async t => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'agate-owned-workshop-ground-'))
  const checkpointPath = path.join(temporary, 'checkpoint.json'), hosts = []
  t.after(async () => {
    for (const host of hosts) await host.stop()
    await fs.rm(temporary, { recursive: true, force: true })
  })
  const start = async () => {
    const server = engine.createAuthorityServer({ dataPath, mapId: MAP_ID, checkpointPath })
    hosts.push(server)
    await server.loadWorld()
    let id = 0
    const request = (type, extra = {}) => server.command({ data: { joined: true, role: 'owner' } },
      { version: 1, id: ++id, actorId: '0', type, ...extra })
    const pickup = () => request('pickup', { targetId: GROUND_ITEM_ID, expectedRevision: server.revision })
    const drop = () => request('drop', { itemId: GROUND_ITEM_ID, expectedRevision: server.revision })
    const ground = () => server.getSnapshot().groundItems
    const approach = () => {
      assert.equal(request('use', { targetId: GROUND_ITEM_ID }).ok, true)
      server.advanceMovement(performance.now() + 10000)
    }
    return { server, request, pickup, drop, ground, approach }
  }
  const row = { id: GROUND_ITEM_ID, slot: 0, label: GROUND_ITEM_LABEL, type: 'Generic',
    prototypeId: 900007, canDrop: true, weight: 1 }
  const descriptor = location => ({ id: GROUND_ITEM_ID, kind: 'ground', label: GROUND_ITEM_LABEL,
    type: 'Generic', prototypeId: 900007, location })
  const first = await start()
  assert.deepEqual(first.ground(), [descriptor([4, 7])])
  assert.equal(first.server.map.isTileBlocked(4, 7), false)
  assert.equal(first.pickup().code, 'OUT_OF_RANGE')
  assert.deepEqual(first.request('inventory').result.items, [])
  first.approach()
  assert.deepEqual(first.pickup().result, { kind: 'pickup', targetId: GROUND_ITEM_ID,
    inventory: { ownerId: '16086.json', items: [row], carrying: { supported: true, weight: 1, capacity: 4000, encumbrance: 'none' } } })
  assert.deepEqual(first.ground(), [])
  assert.equal(JSON.stringify(first.server.getSnapshot()).includes(GROUND_ITEM_ID), false,
    'a held item identity leaves public floor state')
  assert.equal(JSON.stringify(first.server.getSnapshot()).includes(GROUND_ITEM_LABEL), false)
  const entity = first.server.ownership.items.get(GROUND_ITEM_ID).entity
  assert.equal(entity.item.parent, '16086.json')
  assert.equal(entity.ground, false)
  assert.deepEqual([...entity.base.flags], ['NoBlock'], 'authored flags stay immutable')
  assert.equal(entity.item.invLocation, 0)
  assert.deepEqual([entity.base.location.x, entity.base.location.y], [4, 7],
    'held location canonicalizes to its authored value')
  assert.equal((await first.request('save')).ok, true)
  const heldCheckpoint = JSON.parse(await fs.readFile(checkpointPath, 'utf8'))
  assert.equal(heldCheckpoint.version, 6)
  assert.equal(heldCheckpoint.rulesVersion, 'movement-doors-ownership-attributes-weight-v10')
  assert.deepEqual(heldCheckpoint.ownership.items.find(item => item.id === GROUND_ITEM_ID),
    { id: GROUND_ITEM_ID, parent: '16086.json', groundLocation: null })
  const location = [first.server.player.base.location.x, first.server.player.base.location.y]
  const dropped = first.drop()
  assert.equal(dropped.ok, true)
  assert.deepEqual(dropped.result, { kind: 'drop', itemId: GROUND_ITEM_ID, ground: descriptor(location),
    inventory: { ownerId: '16086.json', items: [], carrying: { supported: true, weight: 0, capacity: 4000, encumbrance: 'none' } } })
  assert.deepEqual(first.ground(), [descriptor(location)])
  assert.equal(entity.item.parent, null)
  assert.equal(entity.ground, true)
  assert.deepEqual([...entity.base.flags], ['NoBlock'])
  assert.equal(entity.item.invLocation, 0)
  assert.equal((await first.request('load')).ok, true)
  assert.deepEqual(first.ground(), [])
  assert.deepEqual(first.request('inventory').result.items, [row])
  assert.equal(first.drop().ok, true)
  assert.equal((await first.request('save')).ok, true)
  const saved = await fs.readFile(checkpointPath, 'utf8')
  assert.deepEqual(JSON.parse(saved).ownership.items.find(item => item.id === GROUND_ITEM_ID),
    { id: GROUND_ITEM_ID, parent: null, groundLocation: location })
  await first.server.stop()

  const second = await start()
  assert.equal((await second.request('load')).ok, true)
  assert.deepEqual(second.ground(), [descriptor(location)])
  assert.deepEqual(second.request('inventory').result.items, [])
  assert.equal(second.pickup().ok, true)
  assert.deepEqual(second.ground(), [])
  assert.deepEqual(second.request('inventory').result.items, [row])
  assert.equal(second.server.ownership.items.size, 5, 'the fixed five-item universe is conserved')
  assert.equal(await fs.readFile(checkpointPath, 'utf8'), saved, 'playing does not rewrite the saved document')
})

test('the owned guide atomically awards its persistent quest experience only once while the actor holds its pebble', async t => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'agate-owned-workshop-dialogue-'))
  const checkpointPath = path.join(temporary, 'checkpoint.json'), hosts = []
  t.after(async () => {
    for (const host of hosts) await host.stop()
    await fs.rm(temporary, { recursive: true, force: true })
  })
  const start = async () => {
    const server = engine.createAuthorityServer({ dataPath, mapId: MAP_ID, checkpointPath })
    hosts.push(server)
    await server.loadWorld()
    const owner = { data: { joined: true, role: 'owner' } }
    let id = 0
    const request = (type, extra = {}) => server.command(owner,
      { version: 1, id: ++id, actorId: '0', type, ...extra })
    const approach = targetId => {
      assert.equal(request('use', { targetId }).ok, true)
      server.advanceMovement(performance.now() + 10000)
    }
    const talk = () => request('talk', { targetId: NPC_ID })
    const reply = (page, optionId) => request('reply', { targetId: NPC_ID,
      conversationId: page.conversationId, optionId, expectedRevision: server.revision })
    const journal = () => request('journal').result.entries
    const character = () => request('character').result
    return { server, request, approach, talk, reply, journal, character }
  }
  const first = await start()
  assert.deepEqual(first.server.getSnapshot().conversationTargets,
    [{ id: NPC_ID, kind: 'conversation', label: NPC_LABEL, location: [9, 8] }])
  assert.equal(first.server.map.isTileBlocked(9, 8), true, 'the stationary guide occupies its tile')
  assert.equal(first.talk().code, 'OUT_OF_RANGE')
  assert.deepEqual(first.journal(), [])
  const baseline = baselineCharacter()
  const rewarded = { ...baseline, experiencePoints: QUEST_EXPERIENCE_REWARD,
    level: 2, unspentPoints: 6, nextLevelExperience: 4600,
    derived: { ...baseline.derived, maxHealth: 32, maxFatigue: 32 } }
  assert.deepEqual(first.character(), baseline)
  assert.equal(first.server.ownership.owners.has(NPC_ID), false, 'unknown NPC inventory is not manufactured')
  first.approach(NPC_ID)
  const beforeTalk = first.server.revision
  let page = first.talk().result
  assert.equal(first.server.revision, beforeTalk, 'opening private dialogue does not publish a world revision')
  assert.equal(page.speaker, NPC_LABEL)
  assert.equal(page.nodeId, 'offer')
  assert.deepEqual(page.options.map(option => option.id), ['accept', 'leave'])
  assert.equal(first.reply(page, 'leave').result.closed, true)
  assert.deepEqual(first.journal(), [], 'declining does not start the quest')
  assert.deepEqual(first.character(), baseline, 'declining awards nothing')
  page = first.talk().result
  page = first.reply(page, 'accept').result
  assert.equal(page.nodeId, 'active')
  assert.deepEqual(page.options.map(option => option.id), ['leave'], 'a floor pebble does not satisfy current ownership')
  const activeEntry = first.journal()[0]
  assert.deepEqual([activeEntry.id, activeEntry.title, activeEntry.status], [QUEST_ID, QUEST_TITLE, 'active'])
  assert.equal(first.reply(page, 'show').ok, false, 'a client cannot invent an unoffered completion reply')
  assert.equal(first.journal()[0].status, 'active')
  assert.deepEqual(first.character(), baseline, 'accepting and invalid replies award nothing')
  assert.equal((await first.request('save')).ok, true)
  const activeCheckpoint = JSON.parse(await fs.readFile(checkpointPath, 'utf8'))
  assert.equal(activeCheckpoint.version, 6)
  assert.equal(activeCheckpoint.rulesVersion, 'movement-doors-ownership-attributes-weight-v10')
  assert.deepEqual(activeCheckpoint.quests, [{ id: QUEST_ID, status: 'active' }])
  assert.deepEqual(activeCheckpoint.character, { ...PROGRESSION_BASELINE, history: [] })
  assert.equal((await first.request('load')).ok, true)
  assert.equal(first.reply(page, 'leave').ok, false, 'load expires transient conversation turns')
  assert.deepEqual(first.journal(), [activeEntry])
  assert.deepEqual(first.character(), baseline)

  first.approach(GROUND_ITEM_ID)
  assert.equal(first.request('pickup', { targetId: GROUND_ITEM_ID, expectedRevision: first.server.revision }).ok, true)
  first.approach(NPC_ID)
  page = first.talk().result
  assert.deepEqual(page.options.map(option => option.id), ['show', 'leave'])
  assert.equal(first.request('drop', { itemId: GROUND_ITEM_ID, expectedRevision: first.server.revision }).ok, true)
  assert.equal(first.reply(page, 'show').ok, false, 'putting the pebble down invalidates an offered reply')
  assert.equal(first.journal()[0].status, 'active')
  assert.deepEqual(first.character(), baseline, 'a dropped-item stale reply awards nothing')
  assert.equal(first.request('pickup', { targetId: GROUND_ITEM_ID, expectedRevision: first.server.revision }).ok, true)
  page = first.talk().result
  const ownershipBefore = first.server.ownership.checkpointStates()
  const inventoryBefore = first.request('inventory').result.items
  const completed = first.reply(page, 'show')
  assert.equal(completed.ok, true)
  assert.equal(completed.result.nodeId, 'completed')
  assert.deepEqual(completed.result.options.map(option => option.id), ['leave'])
  assert.deepEqual(first.server.ownership.checkpointStates(), ownershipBefore, 'showing does not consume or transfer any item')
  assert.deepEqual(first.request('inventory').result.items, inventoryBefore)
  assert.deepEqual(first.character(), rewarded, 'completion grants the authored XP and level-up CP atomically')
  const completedEntry = first.journal()[0]
  assert.deepEqual([completedEntry.id, completedEntry.title, completedEntry.status], [QUEST_ID, QUEST_TITLE, 'completed'])
  assert.equal(first.reply(page, 'show').ok, false, 'an old turn cannot repeat completion')
  assert.deepEqual(first.character(), rewarded, 'an old completion cannot award XP twice')
  page = first.talk().result
  assert.equal(page.nodeId, 'completed')
  assert.equal(first.reply(page, 'accept').ok, false, 'completed status cannot be downgraded by a made-up option')
  assert.deepEqual(first.character(), rewarded)
  assert.equal(first.request('drop', { itemId: GROUND_ITEM_ID, expectedRevision: first.server.revision }).ok, true)
  assert.deepEqual(first.journal(), [completedEntry], 'completion persists after the pebble is put away')
  const publicState = JSON.stringify(first.server.getSnapshot())
  assert.equal(publicState.includes(QUEST_ID), false)
  assert.equal(publicState.includes(QUEST_TITLE), false)
  assert.equal(publicState.includes('"options"'), false)
  assert.equal(publicState.includes('"journal"'), false)
  assert.equal(publicState.includes('"experiencePoints"'), false)
  assert.equal(publicState.includes('"unspentPoints"'), false)
  assert.equal((await first.request('save')).ok, true)
  const saved = await fs.readFile(checkpointPath, 'utf8')
  assert.deepEqual(JSON.parse(saved).quests, [{ id: QUEST_ID, status: 'completed' }])
  assert.deepEqual(JSON.parse(saved).character, { experiencePoints: QUEST_EXPERIENCE_REWARD, level: 2,
    unspentPoints: 6, attributes: PROGRESSION_BASELINE.attributes,
    history: [{ kind: 'quest', questId: QUEST_ID }] })
  const forged = JSON.parse(saved)
  forged.character.unspentPoints++
  await fs.writeFile(checkpointPath, JSON.stringify(forged))
  assert.equal((await first.request('load')).ok, false, 'a character inconsistent with committed quest rewards cannot load')
  assert.deepEqual(first.character(), rewarded, 'rejected load retains the reward and quest together')
  assert.deepEqual(first.journal(), [completedEntry])
  await fs.writeFile(checkpointPath, saved)
  await first.server.stop()

  const second = await start()
  assert.deepEqual(second.journal(), [])
  assert.deepEqual(second.character(), baseline)
  assert.equal((await second.request('load')).ok, true)
  assert.deepEqual(second.journal(), [completedEntry])
  assert.deepEqual(second.character(), rewarded, 'fresh-host load restores earned XP and banked CP with completion')
  assert.deepEqual(second.request('inventory').result.items, [])
  assert.equal(second.talk().result.nodeId, 'completed')
  assert.deepEqual(second.character(), rewarded, 'reopening a completed conversation awards nothing')
  assert.equal(second.server.ownership.items.size, 5)
  assert.equal(await fs.readFile(checkpointPath, 'utf8'), saved)
})

test('owned purchases spend the starting and quest-earned points once and restore their ordered builds', async t => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'agate-owned-workshop-attributes-'))
  const checkpointPath = path.join(temporary, 'checkpoint.json'), hosts = []
  t.after(async () => {
    for (const host of hosts) await host.stop()
    await fs.rm(temporary, { recursive: true, force: true })
  })
  const start = async () => {
    const server = engine.createAuthorityServer({ dataPath, mapId: MAP_ID, checkpointPath })
    hosts.push(server)
    await server.loadWorld()
    const owner = { data: { joined: true, role: 'owner' } }
    let id = 0
    const request = (type, extra = {}) => server.command(owner,
      { version: 1, id: ++id, actorId: '0', type, ...extra })
    const approach = targetId => {
      assert.equal(request('use', { targetId }).ok, true)
      server.advanceMovement(performance.now() + 10000)
    }
    const buy = (statId, expectedRevision = server.revision) => request('buy-attribute', { statId, expectedRevision })
    const character = () => request('character').result
    return { server, request, approach, buy, character }
  }
  const first = await start()
  assert.deepEqual(first.character(), baselineCharacter())
  const previousRevision = first.server.revision
  const strengthPurchase = first.buy('strength')
  assert.equal(strengthPurchase.ok, true)
  assert.equal(strengthPurchase.result.kind, 'buy-attribute')
  assert.equal(strengthPurchase.result.statId, 'strength')
  assert.equal(strengthPurchase.result.character.unspentPoints, 4)
  assert.deepEqual(strengthPurchase.result.character.derived, { ...baselineCharacter().derived,
    maxHealth: 32, carryWeight: 4500, damageBonus: 0 })
  const afterStrength = first.character()
  assert.equal(first.buy('dexterity', previousRevision).ok, false, 'a stale purchase cannot spend again')
  assert.deepEqual(first.character(), afterStrength)
  assert.equal(first.request('pause').ok, true)
  assert.equal(first.buy('dexterity').code, 'PAUSED')
  assert.deepEqual(first.character(), afterStrength)
  assert.equal(first.request('resume').ok, true)
  const initialPurchases = ['strength', 'dexterity', 'constitution', 'beauty', 'intelligence']
  for (const statId of initialPurchases.slice(1)) assert.equal(first.buy(statId).ok, true)
  const spentStarting = first.character()
  assert.equal(spentStarting.unspentPoints, 0)
  assert.deepEqual(spentStarting.attributes.map(row => [row.id, row.value]),
    Object.keys(PROGRESSION_BASELINE.attributes).map(id => [id, initialPurchases.includes(id) ? 9 : 8]))
  assert.equal(spentStarting.attributes.every(row => row.canIncrease === false), true)
  assert.deepEqual(spentStarting.derived, { maxHealth: 32, maxFatigue: 32, carryWeight: 4500,
    damageBonus: 0, armorClassAdjustment: -1, speed: 9, healRate: 3,
    poisonRecovery: 9, reactionModifier: -3, maxFollowers: 2 })
  assert.equal(first.buy('willpower').ok, false, 'the sixth purchase needs another earned point')
  assert.deepEqual(first.character(), spentStarting)
  assert.equal(first.buy('not-an-attribute').ok, false)
  first.approach(NPC_ID)
  let page = first.request('talk', { targetId: NPC_ID }).result
  assert.equal(first.request('reply', { targetId: NPC_ID, conversationId: page.conversationId,
    optionId: 'accept', expectedRevision: first.server.revision }).ok, true)
  assert.equal((await first.request('save')).ok, true)
  const activeSave = await fs.readFile(checkpointPath, 'utf8')
  const activeCheckpoint = JSON.parse(activeSave)
  assert.equal(activeCheckpoint.version, 6)
  assert.deepEqual(activeCheckpoint.character.history,
    initialPurchases.map(statId => ({ kind: 'attribute', statId })))
  assert.equal(activeCheckpoint.character.unspentPoints, 0)
  assert.deepEqual(activeCheckpoint.quests, [{ id: QUEST_ID, status: 'active' }])

  first.approach(GROUND_ITEM_ID)
  assert.equal(first.request('pickup', { targetId: GROUND_ITEM_ID, expectedRevision: first.server.revision }).ok, true)
  first.approach(NPC_ID)
  page = first.request('talk', { targetId: NPC_ID }).result
  assert.equal(first.request('reply', { targetId: NPC_ID, conversationId: page.conversationId,
    optionId: 'show', expectedRevision: first.server.revision }).ok, true)
  const levelUp = first.character()
  assert.equal(levelUp.experiencePoints, QUEST_EXPERIENCE_REWARD)
  assert.equal(levelUp.level, 2)
  assert.equal(levelUp.unspentPoints, 1, 'level-up adds one point after the starting five were spent')
  assert.equal(levelUp.derived.maxHealth, 34)
  assert.equal(levelUp.derived.maxFatigue, 34)
  const finalPurchase = first.buy('willpower')
  assert.equal(finalPurchase.ok, true)
  const completedBuild = first.character()
  assert.equal(completedBuild.unspentPoints, 0)
  assert.equal(completedBuild.attributes.find(row => row.id === 'willpower').value, 9)
  assert.equal(completedBuild.derived.maxHealth, 35)
  assert.equal(completedBuild.derived.maxFatigue, 35)
  assert.equal(first.server.player.critter.stats, undefined, 'the private build does not rewrite legacy stats')
  assert.equal((await first.request('save')).ok, true)
  const completedSave = await fs.readFile(checkpointPath, 'utf8')
  const completedCheckpoint = JSON.parse(completedSave)
  assert.deepEqual(completedCheckpoint.character.history, [
    ...initialPurchases.map(statId => ({ kind: 'attribute', statId })),
    { kind: 'quest', questId: QUEST_ID }, { kind: 'attribute', statId: 'willpower' }])
  const publicState = JSON.stringify(first.server.getSnapshot())
  assert.equal(publicState.includes('"attributes"'), false)
  assert.equal(publicState.includes('"derived"'), false)
  assert.equal(publicState.includes('"history"'), false)

  await fs.writeFile(checkpointPath, activeSave)
  assert.equal((await first.request('load')).ok, true)
  assert.deepEqual(first.character(), spentStarting)
  assert.equal(first.request('journal').result.entries[0].status, 'active')
  assert.deepEqual(first.request('inventory').result.items, [])
  await fs.writeFile(checkpointPath, completedSave)
  assert.equal((await first.request('load')).ok, true)
  assert.deepEqual(first.character(), completedBuild)
  const held = first.server.ownership.checkpointStates()
  const invalidOrder = JSON.parse(completedSave)
  invalidOrder.character.history.splice(initialPurchases.length, 2,
    { kind: 'attribute', statId: 'willpower' }, { kind: 'quest', questId: QUEST_ID })
  await fs.writeFile(checkpointPath, JSON.stringify(invalidOrder))
  assert.equal((await first.request('load')).ok, false, 'a purchase before its earning quest cannot replay')
  assert.deepEqual(first.character(), completedBuild)
  assert.equal(first.request('journal').result.entries[0].status, 'completed')
  assert.deepEqual(first.server.ownership.checkpointStates(), held)
  await fs.writeFile(checkpointPath, completedSave)
  await first.server.stop()
  const second = await start()
  assert.deepEqual(second.character(), baselineCharacter())
  assert.equal((await second.request('load')).ok, true)
  assert.deepEqual(second.character(), completedBuild)
  assert.equal(second.request('journal').result.entries[0].status, 'completed')
  assert.equal(second.request('inventory').result.items[0].id, GROUND_ITEM_ID)
  assert.equal(await fs.readFile(checkpointPath, 'utf8'), completedSave)
})

test('the owned positive-XP quest cannot complete or load completed for an actor without progression opt-in', async t => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'agate-owned-workshop-no-progression-'))
  const temporaryData = path.join(temporary, 'data'), checkpointPath = path.join(temporary, 'checkpoint.json')
  let server
  t.after(async () => {
    await server?.stop()
    await fs.rm(temporary, { recursive: true, force: true })
  })
  for (const [name, bytes] of buildFiles()) {
    const filename = path.join(temporaryData, name)
    await fs.mkdir(path.dirname(filename), { recursive: true })
    await fs.writeFile(filename, bytes)
  }
  const actor = JSON.parse(await fs.readFile(path.join(temporaryData, '16086.json'), 'utf8'))
  delete actor.Critter.progressionSupported
  await fs.writeFile(path.join(temporaryData, '16086.json'), JSON.stringify(actor))
  server = engine.createAuthorityServer({ dataPath: temporaryData, mapId: MAP_ID, checkpointPath })
  await server.loadWorld()
  const owner = { data: { joined: true, role: 'owner' } }
  let id = 0
  const request = (type, extra = {}) => server.command(owner,
    { version: 1, id: ++id, actorId: '0', type, ...extra })
  const approach = targetId => {
    assert.equal(request('use', { targetId }).ok, true)
    server.advanceMovement(performance.now() + 10000)
  }
  const reply = (page, optionId) => request('reply', { targetId: NPC_ID,
    conversationId: page.conversationId, optionId, expectedRevision: server.revision })
  assert.deepEqual(request('character').result, { kind: 'character', supported: false })
  approach(NPC_ID)
  assert.equal(reply(request('talk', { targetId: NPC_ID }).result, 'accept').ok, true)
  approach(GROUND_ITEM_ID)
  assert.equal(request('pickup', { targetId: GROUND_ITEM_ID, expectedRevision: server.revision }).ok, true)
  approach(NPC_ID)
  const page = request('talk', { targetId: NPC_ID }).result
  assert.deepEqual(page.options.map(option => option.id), ['show', 'leave'])
  const revision = server.revision, ownership = server.ownership.checkpointStates()
  assert.equal(reply(page, 'show').code, 'PROGRESSION_UNAVAILABLE')
  assert.equal(server.revision, revision, 'a rejected reward cannot commit quest completion')
  assert.deepEqual(request('character').result, { kind: 'character', supported: false })
  assert.equal(request('journal').result.entries[0].status, 'active')
  assert.deepEqual(server.ownership.checkpointStates(), ownership, 'reward rejection leaves the pebble held')
  assert.equal((await request('save')).ok, true)
  const checkpoint = JSON.parse(await fs.readFile(checkpointPath, 'utf8'))
  assert.equal(checkpoint.character, null)
  checkpoint.quests[0].status = 'completed'
  await fs.writeFile(checkpointPath, JSON.stringify(checkpoint))
  assert.equal((await request('load')).ok, false, 'a positive reward cannot be bypassed through a completed checkpoint')
  assert.equal(request('journal').result.entries[0].status, 'active')
  assert.deepEqual(request('character').result, { kind: 'character', supported: false })
  assert.deepEqual(server.ownership.checkpointStates(), ownership)
})

function mapFixture(data) {
  let requested = null
  const map = new engine.GameMap({ gameEngine: { events: new EventEmitter(),
    assetLoader: { loadJsonFile: async () => data } } }, 'owned-spawn-test')
  map.sectors.load = async (x, y) => { requested = [x, y] }
  return { map, requested: () => requested }
}

test('data-defined start locations use runtime bounds, copy input and load around an off-center spawn', async () => {
  const data = { width: 8, height: 6, startLocation: [4, 4] }
  const { map, requested } = mapFixture(data)
  await map.load('owned-spawn-test')
  assert.equal(map.width, 6)
  assert.equal(map.height, 8)
  assert.deepEqual(requested(), [0, 0], 'the declared start sector is loaded instead of the distant map center')
  data.startLocation[0] = 100
  const location = map.getStartLocation()
  assert.deepEqual([location.x, location.y], [4, 4])
  location.x = 50
  assert.equal(map.getStartLocation().x, 4, 'callers cannot mutate the stored start location')
  delete data.startLocation
  await map.load('owned-spawn-test')
  assert.deepEqual([map.getStartLocation().x, map.getStartLocation().y], [92, 99])
  assert.deepEqual(requested(), [3, 4], 'legacy maps retain center-based sector loading')
  const edge = mapFixture({ width: 8, height: 6, startLocation: [383, 511] })
  await edge.map.load('owned-spawn-test')
  assert.deepEqual(edge.requested(), [5, 7])
})

test('declared map start locations reject malformed, unsafe and out-of-bounds coordinates before loading sectors', async () => {
  for (const startLocation of [null, undefined, {}, '4,4', [], [4], [4, 4, 4], [-1, 4], [4, -1],
    [1.5, 4], ['4', 4], [Infinity, 4], [Number.MAX_SAFE_INTEGER + 1, 4], [384, 4], [4, 512]] as const) {
    const { map, requested } = mapFixture({ width: 8, height: 6, startLocation })
    await assert.rejects(map.load('owned-spawn-test'), /Invalid converted map start location/)
    assert.equal(requested(), null)
  }
})
