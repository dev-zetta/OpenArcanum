const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const { before, test } = require('node:test') as typeof import('node:test')
const fs = require('node:fs/promises') as typeof import('node:fs/promises')
const os = require('node:os') as typeof import('node:os')
const path = require('node:path') as typeof import('node:path')
const Module = require('node:module') as typeof import('node:module')
const { generate, MAP_ID, BOX_ID, TOKEN_ID, TOKEN_LABEL, DOOR_ID, LOCKED_DOOR_ID } = require('../../../examples/inventory-workshop/generate.cts')
const root = path.resolve(__dirname, '../../..')
const source = path.join(root, '@openarcanum/agate/src')
let engine

before(async () => {
  const { build } = await import('esbuild')
  const result = await build({
    absWorkingDir: root,
    stdin: { contents: `export { createAuthorityServer } from './server/authority/AuthorityServer.ts';
      export { default as InventoryOwnership, prepareOwnWrites } from './server/authority/InventoryOwnership.ts';`,
    resolveDir: source, sourcefile: 'inventory-transfer-tests.js' },
    bundle: true, platform: 'node', format: 'cjs', target: 'node24', write: false,
    external: ['electron', 'workerpool'], loader: { '.glsl': 'text' },
  })
  const compiled = new Module(__filename + '.bundle.cjs', module)
  compiled.filename = __filename + '.bundle.cjs'
  compiled.paths = Module._nodeModulePaths(root)
  compiled._compile(result.outputFiles[0].text, compiled.filename)
  engine = compiled.exports
})

async function fixture(t: import("node:test").TestContext, modify?) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agate-inventory-transfer-'))
  await generate(directory)
  const dataPath = path.join(directory, 'data')
  const change = async (name, update) => {
    const filename = path.join(dataPath, name)
    const data = JSON.parse(await fs.readFile(filename, 'utf8'))
    update(data)
    await fs.writeFile(filename, JSON.stringify(data))
  }
  if (modify) await modify(change)
  const server = engine.createAuthorityServer({ dataPath, mapId: MAP_ID,
    checkpointPath: path.join(directory, 'checkpoint.json') })
  t.after(async () => { await server.stop(); await fs.rm(directory, { recursive: true, force: true }) })
  await server.loadWorld()
  const owner = { data: { joined: true, role: 'owner' } }
  let nextId = 0
  const command = (type, extra = {}) => server.command(owner, { version: 1, id: ++nextId, actorId: '0', type, ...extra })
  const finish = () => server.advanceMovement(performance.now() + 120000)
  const approach = () => { const result = command('use', { targetId: BOX_ID }); finish(); return result }
  const take = () => command('take', { targetId: BOX_ID, itemId: TOKEN_ID, expectedRevision: server.revision })
  const put = () => command('put', { targetId: BOX_ID, itemId: TOKEN_ID, expectedRevision: server.revision })
  const item = () => [...server.map.entityManager.entities.values()].find(entity => entity.sourcePath === TOKEN_ID)
  const state = () => ({ location: [server.player.base.location.x, server.player.base.location.y],
    doors: server.doors.checkpointStates(), ownership: server.ownership.checkpointStates() })
  return { server, command, approach, take, put, item, state, finish, directory }
}

function ownershipFixture(definitions) {
  const map = { entityManager: { entities: new Map() } }, owners = new Map(), items = new Map()
  const flags = values => { const set = new Set(values) as Set<unknown> & {hasAny(values: unknown[]): boolean}; set.hasAny = values => values.some(value => set.has(value)); return set }
  for (const definition of definitions) {
    const { id, type = 'Container', entries = [], usable = true } = definition
    const component = { inventory: entries.map(({ id, slot }) => ({ id, slot })), inventoryIndex: entries.length, inventorySource: 0 }
    const owner = { id, sourcePath: id, map, usable, base: { type, flags: flags([]) },
      [type === 'Container' ? 'container' : 'critter']: component }
    owners.set(id, owner); map.entityManager.entities.set(id, owner)
    for (const entry of entries) {
      const itemType = entry.type || 'Generic'
      const item = { id: entry.id, sourcePath: entry.id, map,
        base: { type: itemType, prototype: itemType === 'Gold' ? 9076 : 900003, flags: flags(['Inventory']) },
        item: { parent: id, invLocation: 7, flags: flags([]) }, ...(itemType === 'Gold' ? { gold: { quantity: 1 } } : {}) }
      items.set(item.id, item); map.entityManager.entities.set(item.id, item)
    }
  }
  const actor = owners.get('16086.json')
  const create = () => new engine.InventoryOwnership(map, actor, { canTakeFrom: owner => owner.usable })
  return { map, actor, owners, items, create }
}

test('whole Generic transfer preserves instance ownership, sparse placement and prototype data', async t => {
  const { server, command, approach, take, item } = await fixture(t)
  const box = server.containers.states.get(BOX_ID).entity
  const originalList = box.container.inventory
  const originalActorList = server.player.critter.inventory
  const prototype = box.container._prototype
  const originalPrototype = { count: prototype.inventoryIndex, inventory: prototype.inventory }
  approach()
  const revision = server.revision, lastCommand = server.lastCommand
  assert.deepEqual(command('inventory').result, { kind: 'inventory', ownerId: '16086.json', items: [] })
  assert.equal(server.revision, revision)
  assert.equal(server.lastCommand, lastCommand)
  const result = take()
  assert.equal(result.ok, true)
  assert.deepEqual(result.result, { kind: 'take', targetId: BOX_ID, itemId: TOKEN_ID, items: [],
    inventory: { ownerId: '16086.json', items: [{ id: TOKEN_ID, slot: 0, label: TOKEN_LABEL, type: 'Generic', prototypeId: 900003 }] } })
  assert.equal(server.revision, revision + 1)
  assert.equal(item().item.parent, '16086.json')
  assert.equal(item().item.invLocation, 7, 'original inventory placement is independent of sparse owner slot')
  assert.equal(box.container.inventoryIndex, 0)
  assert.equal(server.player.critter.inventoryIndex, 1)
  assert.deepEqual(originalList, [{ id: TOKEN_ID, slot: 3 }], 'the original array was replaced rather than mutated')
  assert.deepEqual(originalActorList, [])
  assert.equal(prototype.inventoryIndex, originalPrototype.count)
  assert.equal(prototype.inventory, originalPrototype.inventory)
  assert.deepEqual(server.lastCommand.result, { kind: 'take', targetId: BOX_ID })
  assert.equal(JSON.stringify(server.getSnapshot()).includes(TOKEN_ID), false)
  const badSlot = server.createCheckpoint()
  badSlot.ownership.owners.find(owner => owner.id === '16086.json').items[0].slot = 999
  assert.throws(() => server.validateCheckpoint(badSlot), { code: 'CHECKPOINT_INVALID' }, 'a checkpoint cannot invent unreachable sparse placement')
  const retry = take()
  assert.equal(retry.code, 'UNKNOWN_ITEM')
  assert.equal(server.player.critter.inventory.length, 1)
})

test('take preflights every component write and never leaves a partial transfer', async t => {
  const { server, approach, take, state } = await fixture(t)
  approach()
  const before = state()
  Object.defineProperty(server.player.critter, 'inventoryIndex', { value: 0, writable: false, configurable: true })
  const result = take()
  assert.equal(result.code, 'INVENTORY_UNAVAILABLE')
  assert.deepEqual(server.containers.states.get(BOX_ID).entity.container.inventory, before.ownership.owners.find(owner => owner.id === BOX_ID).items)
  assert.equal(server.player.critter.inventory.length, 0)
  assert.equal(server.ownership.items.get(TOKEN_ID).entity.item.parent, BOX_ID)
  Object.defineProperty(server.player.critter, 'inventoryIndex', { value: 0, writable: true, configurable: true })
  assert.deepEqual(state(), before)
})

test('repeated take and put conserve identity and allocate the lowest unused container slot', async t => {
  const { server, approach, take, put, item } = await fixture(t)
  approach()
  for (let index = 0; index < 3; index++) {
    assert.equal(take().ok, true)
    const revision = server.revision
    const returned = put()
    assert.equal(returned.ok, true)
    assert.equal(server.revision, revision + 1)
    assert.deepEqual(returned.result, { kind: 'put', targetId: BOX_ID, itemId: TOKEN_ID,
      items: [{ id: TOKEN_ID, slot: 0, label: TOKEN_LABEL, type: 'Generic', prototypeId: 900003 }],
      inventory: { ownerId: '16086.json', items: [] } })
    assert.equal(item().item.parent, BOX_ID)
    assert.equal(item().item.invLocation, 7)
    assert.deepEqual(server.lastCommand.result, { kind: 'put', targetId: BOX_ID })
    assert.equal(JSON.stringify(server.getSnapshot()).includes(TOKEN_ID), false)
    const checkpoint = server.createCheckpoint()
    assert.doesNotThrow(() => server.validateCheckpoint(checkpoint))
    assert.equal(put().code, 'UNKNOWN_ITEM', 'an item cannot be inserted twice')
  }
})

test('an initially actor-owned Generic can be put and taken back without invented placement rules', async t => {
  const { server, approach, take, put, item } = await fixture(t, async change => {
    await change('16086.json', data => {
      data.Critter.inventory = [{ id: TOKEN_ID, slot: 5 }]; data.Critter.inventoryIndex = 1
    })
    await change(BOX_ID, data => { data.Container.inventory = []; data.Container.inventoryIndex = 0 })
    await change(TOKEN_ID, data => { data.Item.parent = '16086.json' })
  })
  approach()
  assert.equal(put().result.items[0].slot, 0)
  assert.equal(take().result.inventory.items[0].slot, 0, 'returning actor item fills the lowest hole instead of guessing its old slot')
  assert.equal(item().item.invLocation, 7)
  assert.equal(server.player.critter.inventoryIndex, 1)
  assert.doesNotThrow(() => server.validateCheckpoint(server.createCheckpoint()))
})

test('put preflight preserves both owners and parent on a frozen destination field', async t => {
  const { server, approach, take, put, state } = await fixture(t)
  approach(); assert.equal(take().ok, true)
  const before = state()
  const component = server.containers.states.get(BOX_ID).entity.container
  Object.defineProperty(component, 'inventoryIndex', { value: 0, writable: false, configurable: true })
  assert.equal(put().code, 'INVENTORY_UNAVAILABLE')
  Object.defineProperty(component, 'inventoryIndex', { value: 0, writable: true, configurable: true })
  assert.deepEqual(state(), before)
})

test('older ownership rules are rejected without modifying live state or the saved file', async t => {
  const { server, approach, take, put, command, state } = await fixture(t)
  approach(); assert.equal(take().ok, true)
  const current = server.createCheckpoint()
  assert.equal(put().ok, true)
  const before = state()
  for (const rulesVersion of ['movement-doors-ownership-v2', 'movement-doors-ownership-v3', 'movement-doors-ownership-v4', 'movement-doors-ownership-v5'] as const) {
    const older = { ...current, rulesVersion }
    const bytes = JSON.stringify(older)
    await fs.writeFile(server.checkpointStore.filename, bytes)
    assert.equal((await command('load')).code, 'CHECKPOINT_INCOMPATIBLE')
    assert.deepEqual(state(), before)
    assert.equal(await fs.readFile(server.checkpointStore.filename, 'utf8'), bytes, 'incompatible files remain untouched')
  }
  assert.equal(Object.hasOwn(server, 'legacyOwnershipIdentity'), false)
})

test('checkpoint v3 restores ownership, position and doors together and rejects v1 explicitly', async t => {
  const { server, approach, take, command, state, finish } = await fixture(t)
  const original = server.createCheckpoint()
  approach(); assert.equal(take().ok, true)
  const saved = await command('save')
  assert.equal(saved.ok, true)
  const transferred = await server.checkpointStore.read()
  assert.equal(transferred.version, 6)
  assert.equal(transferred.rulesVersion, 'movement-doors-ownership-attributes-v9')
  assert.equal(transferred.ownership.items.find(row => row.id === TOKEN_ID).parent, '16086.json')
  const restoredOriginal = server.validateCheckpoint(original)
  server.applyCheckpoint(restoredOriginal)
  assert.equal(server.player.critter.inventory.length, 0)
  command('use', { targetId: DOOR_ID }); finish()
  assert.equal(server.doors.states.get(DOOR_ID).open, true)
  const loaded = await command('load')
  assert.equal(loaded.ok, true)
  assert.deepEqual(state(), { location: [5, 4], doors: [{ id: DOOR_ID, open: false }, { id: LOCKED_DOOR_ID, open: false }], ownership: transferred.ownership })
  const legacy = structuredClone(original)
  legacy.version = 1; delete legacy.ownership
  assert.throws(() => server.validateCheckpoint(legacy), { code: 'CHECKPOINT_INCOMPATIBLE' })
})

test('tampered ownership checkpoints cannot change any actor, door or inventory field', async t => {
  const { server, approach, take, command, state } = await fixture(t)
  const beforeTake = server.createCheckpoint()
  approach(); assert.equal(take().ok, true)
  const before = state()
  const tamper = [
    value => { value.ownership.owners.pop() },
    value => { value.ownership.owners.push(structuredClone(value.ownership.owners[0])) },
    value => { value.ownership.owners[0].id = 'unknown-owner' },
    value => { value.ownership.owners.find(owner => owner.id === BOX_ID).inventoryIndex = 0 },
    value => { value.ownership.owners.find(owner => owner.id === BOX_ID).items[0].slot = -1 },
    value => { value.ownership.owners.find(owner => owner.id === BOX_ID).items[0].slot = 1.5 },
    value => { value.ownership.owners.find(owner => owner.id === BOX_ID).items[0].slot = 4 },
    value => { value.ownership.owners.find(owner => owner.id === BOX_ID).items[0].id = 'fabricated-item' },
    value => { value.ownership.items = [] },
    value => { value.ownership.items.push({ id: 'fabricated-item', parent: BOX_ID }) },
    value => { value.ownership.items[0].parent = '16086.json' },
    value => { value.ownership.items[0].quantity = 500 },
    value => { value.ownership.items[0].prototypeId = 1 },
    value => { value.ownership.owners.find(owner => owner.id === '16086.json').items.push({ id: TOKEN_ID, slot: 0 }) },
  ]
  for (const change of tamper) {
    const document = structuredClone(beforeTake)
    document.actor.location = [4, 5]
    document.doors[0].open = true
    change(document)
    server.checkpointStore.read = async () => document
    const result = await command('load')
    assert.equal(result.code, 'CHECKPOINT_INVALID')
    assert.deepEqual(state(), before)
  }
})

test('loading preflights immutable inventory fields before moving actor or changing doors', async t => {
  const { server, approach, take, state } = await fixture(t)
  const original = server.createCheckpoint()
  approach(); assert.equal(take().ok, true)
  original.actor.location = [4, 5]
  original.doors[0].open = true
  const before = state()
  const item = server.ownership.items.get(TOKEN_ID).entity
  Object.defineProperty(item.item, 'parent', { value: '16086.json', writable: false, configurable: true })
  assert.throws(() => server.validateCheckpoint(original), { code: 'CHECKPOINT_INVALID' })
  Object.defineProperty(item.item, 'parent', { value: '16086.json', writable: true, configurable: true })
  assert.deepEqual(state(), before)
})

test('load rolls back placement and ownership if a synchronous placement hook throws', async t => {
  const { server, approach, take, state } = await fixture(t)
  const original = server.createCheckpoint()
  approach(); assert.equal(take().ok, true)
  original.actor.location = [4, 5]; original.doors[0].open = true
  const before = state(), candidate = server.validateCheckpoint(original)
  const move = server.map.moveEntity.bind(server.map)
  server.map.moveEntity = (...args) => { move(...args); throw new Error('Synthetic sector event failure') }
  assert.throws(() => server.applyCheckpoint(candidate), { code: 'CHECKPOINT_INVALID' })
  assert.deepEqual(state(), before)
  assert.equal(server.map.getTile(5, 4).Pc['0'], server.player)
  assert.equal(server.map.getTile(4, 5).Pc, undefined)
})

test('checkpoint cannot fabricate a transfer from a locked source container', async t => {
  const { server, command } = await fixture(t, change => change(BOX_ID,
    data => { data.Container.flags = ['Locked'] }))
  const document = server.createCheckpoint()
  const owner = document.ownership.owners.find(owner => owner.id === BOX_ID)
  owner.items = []; owner.inventoryIndex = 0
  const actor = document.ownership.owners.find(owner => owner.id === '16086.json')
  actor.items = [{ id: TOKEN_ID, slot: 0 }]; actor.inventoryIndex = 1
  document.ownership.items[0].parent = '16086.json'
  server.checkpointStore.read = async () => document
  assert.equal((await command('load')).code, 'CHECKPOINT_INVALID')
  assert.equal(server.player.critter.inventory.length, 0)
  assert.equal(server.ownership.items.get(TOKEN_ID).entity.item.parent, BOX_ID)
})

test('unknown original actor inventory remains absent through save/load and cannot receive items', async t => {
  const { server, command, approach, take } = await fixture(t, change => change('16086.json',
    data => { delete data.Critter.inventory }))
  approach()
  assert.equal(command('inventory').code, 'INVENTORY_UNAVAILABLE')
  assert.equal(take().code, 'INVENTORY_UNAVAILABLE')
  assert.equal((await command('save')).ok, true)
  assert.equal((await command('load')).ok, true)
  assert.equal(Object.hasOwn(server.player.critter, 'inventory'), false)
  const saved = await server.checkpointStore.read()
  assert.equal(saved.ownership.owners.some(owner => owner.id === '16086.json'), false)
})

test('a failed save preserves the previous slot and every live field', async t => {
  const { server, command, approach, take, item } = await fixture(t)
  approach(); assert.equal(take().ok, true)
  assert.equal((await command('save')).ok, true)
  const previous = await fs.readFile(server.checkpointStore.filename)
  Object.defineProperty(item().item, 'invLocation', { value: 99, writable: true, configurable: true })
  const before = { actor: [server.player.base.location.x, server.player.base.location.y],
    doors: server.doors.checkpointStates(), actorInventory: structuredClone(server.player.critter.inventory),
    containerInventory: structuredClone(server.containers.states.get(BOX_ID).entity.container.inventory),
    parent: item().item.parent, placement: item().item.invLocation }
  assert.equal((await command('save')).code, 'CHECKPOINT_INVALID')
  assert.deepEqual(await fs.readFile(server.checkpointStore.filename), previous)
  assert.deepEqual({ actor: [server.player.base.location.x, server.player.base.location.y],
    doors: server.doors.checkpointStates(), actorInventory: structuredClone(server.player.critter.inventory),
    containerInventory: structuredClone(server.containers.states.get(BOX_ID).entity.container.inventory),
    parent: item().item.parent, placement: item().item.invLocation }, before)
})

test('multiple transfers fill original sparse holes and restore only reachable slot sets', () => {
  const map = { entityManager: { entities: new Map() } }
  const flags = values => { const result = new Set(values) as Set<unknown> & {hasAny(values: unknown[]): boolean}; result.hasAny = values => values.some(value => result.has(value)); return result }
  const owner = (id, type, inventory) => ({ id, sourcePath: id, map,
    base: { type, flags: flags([]) }, [type === 'Container' ? 'container' : 'critter']:
      { inventory, inventoryIndex: inventory.length, inventorySource: 0 } })
  const item = (id, parent) => ({ id, sourcePath: id, map,
    base: { type: 'Generic', prototype: 900003, flags: flags(['Inventory']) },
    item: { parent, invLocation: 7, flags: flags([]) } })
  const actor = owner('16086.json', 'Pc', [{ id: 'original-a', slot: 0 }, { id: 'original-b', slot: 2 }])
  const container = owner('box', 'Container', [{ id: 'new-a', slot: 3 }, { id: 'new-b', slot: 9 }])
  for (const entity of [actor, container, item('original-a', actor.sourcePath), item('original-b', actor.sourcePath),
    item('new-a', 'box'), item('new-b', 'box')] as const) map.entityManager.entities.set(entity.id, entity)
  const ownership = new engine.InventoryOwnership(map, actor, { canTakeFrom: () => true })
  assert.equal(ownership.take(container, 'new-a').result.inventory.items.find(item => item.id === 'new-a').slot, 1)
  assert.equal(ownership.take(container, 'new-b').result.inventory.items.find(item => item.id === 'new-b').slot, 3)
  const saved = ownership.checkpointStates()
  const restored = structuredClone(saved)
  const entries = restored.owners.find(owner => owner.id === actor.sourcePath).items
  entries.find(item => item.id === 'new-a').slot = 3
  entries.find(item => item.id === 'new-b').slot = 1
  assert.doesNotThrow(() => ownership.validateCheckpoint(restored), 'another valid take order can produce the same filled hole set')
  entries.find(item => item.id === 'new-a').slot = 999
  assert.throws(() => ownership.validateCheckpoint(restored), /unreachable/)
})

test('general put accepts legitimate actor holes and moves initial actor items between verified containers', () => {
  const { owners, items, create } = ownershipFixture([
    { id: '16086.json', type: 'Pc', entries: [{ id: 'original-a', slot: 0 }, { id: 'original-b', slot: 2 }] },
    { id: 'box', entries: [{ id: 'new-a', slot: 3 }, { id: 'new-b', slot: 9 }] },
    { id: 'other' },
    { id: 'locked', usable: false, entries: [{ id: 'locked-item', slot: 0 }] },
    { id: 'npc', type: 'Npc', entries: [{ id: 'npc-item', slot: 0 }] },
  ])
  const ownership = create(), box = owners.get('box'), other = owners.get('other')
  assert.equal(ownership.movableCount, 4, 'NPC and locked-source items cannot enlarge the movable slot universe')
  assert.equal(ownership.take(box, 'new-a').result.inventory.items.find(item => item.id === 'new-a').slot, 1)
  assert.equal(ownership.take(box, 'new-b').result.inventory.items.find(item => item.id === 'new-b').slot, 3)
  assert.equal(ownership.put(box, 'original-a').result.items[0].slot, 0)
  assert.equal(ownership.put(other, 'new-a').result.items[0].slot, 0)
  assert.equal(ownership.take(box, 'original-a').result.inventory.items.find(item => item.id === 'original-a').slot, 0)
  assert.equal(ownership.put(other, 'new-b').result.items.find(item => item.id === 'new-b').slot, 1)
  const hole = ownership.checkpointStates()
  assert.deepEqual(hole.owners.find(owner => owner.id === '16086.json').items,
    [{ id: 'original-a', slot: 0 }, { id: 'original-b', slot: 2 }])
  assert.doesNotThrow(() => ownership.validateCheckpoint(hole), 'Put-created actor hole1 is valid')
  assert.equal(ownership.take(other, 'new-b').result.inventory.items.find(item => item.id === 'new-b').slot, 1)
  assert.equal(items.get('new-b').item.invLocation, 7)
  ownership.validateCheckpoint(hole).apply()
  assert.equal(items.get('new-b').item.parent, 'other')
  const excessive = structuredClone(hole)
  excessive.owners.find(owner => owner.id === 'other').items[1].slot = 5
  assert.throws(() => ownership.validateCheckpoint(excessive), /unreachable/)
  const forbidden = structuredClone(hole)
  const moved = forbidden.owners.find(owner => owner.id === 'other').items.pop()
  forbidden.owners.find(owner => owner.id === 'other').inventoryIndex--
  forbidden.owners.find(owner => owner.id === 'locked').items.push(moved)
  forbidden.owners.find(owner => owner.id === 'locked').inventoryIndex++
  forbidden.items.find(item => item.id === moved.id).parent = 'locked'
  assert.throws(() => ownership.validateCheckpoint(forbidden), /Unsupported/)
})

test('put rejects a full destination without losing any original or transferred item', () => {
  const { owners, actor, items, create } = ownershipFixture([
    { id: '16086.json', type: 'Pc', entries: [{ id: 'actor-item', slot: 3 }] },
    { id: 'full', entries: Array.from({ length: 1024 }, (_, slot) => ({ id: `fixed-${slot}`, slot, type: 'Gold' })) },
  ])
  const ownership = create(), before = ownership.checkpointStates()
  assert.equal(ownership.put(owners.get('full'), 'actor-item').code, 'INVENTORY_UNAVAILABLE')
  assert.deepEqual(ownership.checkpointStates(), before)
  assert.equal(actor.critter.inventory.length, 1)
  assert.equal(items.get('actor-item').item.parent, '16086.json')
})

test('put rolls back earlier writes when a destination property rejects the commit', () => {
  const { owners, actor, items, create } = ownershipFixture([
    { id: '16086.json', type: 'Pc', entries: [{ id: 'actor-item', slot: 3 }] }, { id: 'box' },
  ])
  const box = owners.get('box'), component = box.container
  box.container = new Proxy(component, { defineProperty(target, key, descriptor) {
    if (key === 'inventoryIndex' && descriptor.value === 1) throw new Error('Synthetic commit failure')
    return Reflect.defineProperty(target, key, descriptor)
  } })
  const ownership = create(), before = ownership.checkpointStates()
  assert.equal(ownership.put(box, 'actor-item').code, 'INVENTORY_UNAVAILABLE')
  assert.deepEqual(ownership.checkpointStates(), before)
  assert.equal(actor.critter.inventory.length, 1)
  assert.equal(items.get('actor-item').item.parent, '16086.json')
})

test('Take All chooses sparse source order and atomically fills actor holes like sequential Take', () => {
  const definitions = [
    { id: '16086.json', type: 'Pc', entries: [{ id: 'fixed-a', slot: 0, type: 'Gold' }, { id: 'fixed-b', slot: 2, type: 'Gold' }] },
    { id: 'box', entries: [{ id: 'z-item', slot: 8 }, { id: 'a-item', slot: 1 }, { id: 'b-item', slot: 20 }] },
  ]
  const { owners, actor, items, create } = ownershipFixture(definitions)
  const ownership = create(), box = owners.get('box')
  const originalSource = box.container.inventory, originalActor = actor.critter.inventory
  const result = ownership.takeAll(box)
  assert.deepEqual(result.result.itemIds, ['a-item', 'z-item', 'b-item'])
  assert.deepEqual(result.result.items, [])
  assert.deepEqual(result.result.inventory.items.filter(item => item.type === 'Generic').map(({ id, slot }) => ({ id, slot })),
    [{ id: 'a-item', slot: 1 }, { id: 'z-item', slot: 3 }, { id: 'b-item', slot: 4 }])
  assert.equal(box.container.inventoryIndex, 0)
  assert.equal(actor.critter.inventoryIndex, 5)
  assert.equal(originalSource.length, 3)
  assert.equal(originalActor.length, 2)
  for (const id of result.result.itemIds) {
    assert.equal(items.get(id).item.parent, '16086.json')
    assert.equal(items.get(id).item.invLocation, 7)
  }
  const sequential = ownershipFixture(definitions), comparison = sequential.create()
  for (const id of result.result.itemIds) assert.ok(comparison.take(sequential.owners.get('box'), id).result)
  assert.deepEqual(ownership.checkpointStates(), comparison.checkpointStates(), 'batch reaches exactly the sequential ownership state')
  assert.equal(ownership.takeAll(box).code, 'EMPTY_CONTAINER')
})

test('Take All rejects a mixed unsupported item set before changing any item or owner', () => {
  const { owners, create } = ownershipFixture([
    { id: '16086.json', type: 'Pc' },
    { id: 'box', entries: [{ id: 'generic', slot: 0 }, { id: 'gold', slot: 8, type: 'Gold' }] },
  ])
  const ownership = create(), before = ownership.checkpointStates()
  assert.equal(ownership.takeAll(owners.get('box')).code, 'UNSUPPORTED_ITEM')
  assert.deepEqual(ownership.checkpointStates(), before)
})

test('Take All preflights a frozen second item parent before any ownership write', () => {
  const { owners, items, create } = ownershipFixture([
    { id: '16086.json', type: 'Pc' }, { id: 'box', entries: [{ id: 'first', slot: 1 }, { id: 'second', slot: 5 }] },
  ])
  const ownership = create(), before = ownership.checkpointStates(), parent = Object.getOwnPropertyDescriptor(items.get('second').item, 'parent')
  Object.defineProperty(items.get('second').item, 'parent', { ...parent, writable: false })
  assert.equal(ownership.takeAll(owners.get('box')).code, 'INVENTORY_UNAVAILABLE')
  Object.defineProperty(items.get('second').item, 'parent', parent)
  assert.deepEqual(ownership.checkpointStates(), before)
  assert.equal(items.get('first').item.parent, 'box')
})

test('Take All rolls back both owners and the first parent if the second parent rejects commit', () => {
  const { owners, items, create } = ownershipFixture([
    { id: '16086.json', type: 'Pc' }, { id: 'box', entries: [{ id: 'first', slot: 1 }, { id: 'second', slot: 5 }] },
  ])
  const second = items.get('second')
  second.item = new Proxy(second.item, { defineProperty(target, key, descriptor) {
    if (key === 'parent' && descriptor.value === '16086.json') throw new Error('Synthetic second parent failure')
    return Reflect.defineProperty(target, key, descriptor)
  } })
  const ownership = create(), before = ownership.checkpointStates()
  assert.equal(ownership.takeAll(owners.get('box')).code, 'INVENTORY_UNAVAILABLE')
  assert.deepEqual(ownership.checkpointStates(), before)
  assert.equal(items.get('first').item.parent, 'box')
  assert.equal(items.get('second').item.parent, 'box')
})

test('Take All requires capacity for the complete set and never fills only the remaining slot', () => {
  const { owners, create } = ownershipFixture([
    { id: '16086.json', type: 'Pc', entries: Array.from({ length: 1023 }, (_, slot) => ({ id: `fixed-${slot}`, slot, type: 'Gold' })) },
    { id: 'box', entries: [{ id: 'first', slot: 1 }, { id: 'second', slot: 5 }] },
  ])
  const ownership = create(), before = ownership.checkpointStates()
  assert.equal(ownership.takeAll(owners.get('box')).code, 'INVENTORY_UNAVAILABLE')
  assert.deepEqual(ownership.checkpointStates(), before)
})

test('Take All uses the strict server intention, publishes once and never replays a batch', async t => {
  const { server, command, approach } = await fixture(t)
  assert.equal(command('take-all', { targetId: BOX_ID, itemId: TOKEN_ID, expectedRevision: server.revision }).code, 'INVALID_COMMAND')
  assert.equal(command('take-all', { targetId: BOX_ID, itemIds: [TOKEN_ID], expectedRevision: server.revision }).code, 'INVALID_COMMAND')
  assert.equal(command('take-all', { targetId: BOX_ID, expectedRevision: server.revision }).code, 'OUT_OF_RANGE')
  approach()
  const revision = server.revision
  let publications = 0
  const publish = server.publish.bind(server)
  server.publish = () => { publications++; publish() }
  const batch = command('take-all', { targetId: BOX_ID, expectedRevision: revision })
  assert.equal(batch.ok, true)
  assert.equal(batch.result.kind, 'take-all')
  assert.deepEqual(batch.result.itemIds, [TOKEN_ID])
  assert.equal(server.revision, revision + 1)
  assert.equal(publications, 1)
  assert.deepEqual(server.lastCommand.result, { kind: 'take-all', targetId: BOX_ID })
  assert.equal(JSON.stringify(server.getSnapshot()).includes(TOKEN_ID), false)
  const replay = server.command({ data: { joined: true, role: 'owner' } },
    { version: 1, id: batch.id, actorId: '0', type: 'take-all', targetId: BOX_ID, expectedRevision: revision })
  assert.equal(replay.code, 'REPLAYED_COMMAND')
  assert.equal(command('take-all', { targetId: BOX_ID, expectedRevision: revision }).code, 'STALE_REVISION')
  assert.equal(command('take-all', { targetId: BOX_ID, expectedRevision: server.revision }).code, 'EMPTY_CONTAINER')
  assert.equal(publications, 1)
})

test('own-field transaction bypasses legacy proxy setters and rolls back descriptor-for-descriptor', () => {
  const original = [], target = { inventory: original, inventoryIndex: 0 }
  let sets = 0
  const proxy = new Proxy(target, { set() { sets++; throw new Error('Legacy setter must not run') } })
  const descriptors = Object.getOwnPropertyDescriptors(target)
  const transaction = engine.prepareOwnWrites([[proxy, 'inventory', [{ id: 'item', slot: 0 }]],
    [proxy, 'inventoryIndex', 1], [proxy, 'added', true]])
  transaction.apply()
  assert.equal(sets, 0)
  assert.equal(target.inventoryIndex, 1)
  assert.deepEqual(original, [])
  transaction.rollback()
  assert.deepEqual(Object.getOwnPropertyDescriptors(target), descriptors)
})
