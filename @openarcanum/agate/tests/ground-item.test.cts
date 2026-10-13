const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const { before, test } = require('node:test') as typeof import('node:test')
const fs = require('node:fs/promises') as typeof import('node:fs/promises')
const os = require('node:os') as typeof import('node:os')
const path = require('node:path') as typeof import('node:path')
const Module = require('node:module') as typeof import('node:module')
const { generate, MAP_ID, BOX_ID, TOKEN_ID, TOKEN_LABEL, DOOR_ID, LOCKED_DOOR_ID, KEY_BOX_ID, KEY_ID, LOCK_KEY_ID, LOCKED_BOX_ID, PRIZE_ID, PRIZE_LABEL, GROUND_ITEM_ID, GROUND_ITEM_LABEL } = require('../../../examples/inventory-workshop/generate.cts')
const root = path.resolve(__dirname, '../../..')
const source = path.join(root, '@openarcanum/agate/src')
const inventoryView = (items: Array<{ weight: number } & Record<string, unknown>> = [], capacity = 4000) => ({
  ownerId: '16086.json', items, carrying: { supported: true, weight: items.reduce((total, item) => total + item.weight, 0),
    capacity, encumbrance: 'none' } })
let engine

before(async () => {
  const { build } = await import('esbuild')
  const result = await build({
    absWorkingDir: root,
    stdin: { contents: `export { createAuthorityServer } from './server/authority/AuthorityServer.ts';
      export { default as InventoryOwnership, prepareOwnWrites, keyMatchesLock } from './server/authority/InventoryOwnership.ts';`,
    resolveDir: source, sourcefile: 'ground-item-tests.js' },
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
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agate-ground-item-'))
  await generate(directory)
  const dataPath = path.join(directory, 'data'), checkpointPath = path.join(directory, 'checkpoint.json')
  const change = async (name, update) => {
    const filename = path.join(dataPath, name)
    const value = JSON.parse(await fs.readFile(filename, 'utf8'))
    update(value)
    await fs.writeFile(filename, JSON.stringify(value))
  }
  if (modify) await modify(change, dataPath)
  const hosts = []
  t.after(async () => {
    for (const server of hosts) await server.stop()
    await fs.rm(directory, { recursive: true, force: true })
  })
  const start = async () => {
    const server = engine.createAuthorityServer({ dataPath, mapId: MAP_ID, checkpointPath })
    hosts.push(server)
    await server.loadWorld()
    const owner = { data: { joined: true, role: 'owner' } }
    let id = 0
    const command = (type, extra = {}) => server.command(owner, { version: 1, id: ++id, actorId: '0', type, ...extra })
    const finish = () => server.advanceMovement(performance.now() + 120000)
    const use = (targetId, complete = true) => {
      const ack = command('use', { targetId })
      if (complete && ack.status === 'accepted') finish()
      return ack
    }
    const transfer = (kind, targetId = KEY_BOX_ID, itemId = KEY_ID) => command(kind, {
      targetId, ...(kind === 'take-all' ? {} : { itemId }), expectedRevision: server.revision,
    })
    const key = () => server.ownership.items.get(KEY_ID).entity
    const door = () => server.doors.states.get(LOCKED_DOOR_ID)
    const takeKey = () => { use(KEY_BOX_ID); return transfer('take') }
    const state = () => ({ location: [server.player.base.location.x, server.player.base.location.y],
      open: door().open, portalOpen: door().entity.portalOpen, flags: [...door().entity.portal.flags],
      ownership: server.ownership.checkpointStates() })
    return { server, owner, command, finish, use, transfer, key, door, takeKey, state }
  }
  return { start, change, directory, checkpointPath }
}

const groundRow = (location = [4, 7]) => ({ id: GROUND_ITEM_ID, kind: 'ground', label: GROUND_ITEM_LABEL,
  type: 'Generic', prototypeId: 900007, location })
const ownedRow = (slot = 0) => ({ id: GROUND_ITEM_ID, slot, label: GROUND_ITEM_LABEL,
  type: 'Generic', prototypeId: 900007, canDrop: true, weight: 1 })
const actorContents = server => server.ownership.actorInventory().items
const transferGround = (context, type, extra = {}) => context.command(type, {
  ...(type === 'drop' ? { itemId: GROUND_ITEM_ID } : { targetId: GROUND_ITEM_ID }),
  expectedRevision: context.server.revision, ...extra,
})
async function approachPickup(context) {
  const used = context.use(GROUND_ITEM_ID)
  assert.equal(used.ok, true)
  assert.deepEqual(context.server.lastCommand.result, { kind: 'ground', targetId: GROUND_ITEM_ID })
  return transferGround(context, 'pickup')
}

test('initial authored ground Generic is public, pickup is private and drop preserves identity, flags, metadata and tile registration', async t => {
  const { start } = await fixture(t)
  const context = await start(), { server, command } = context
  assert.deepEqual(server.getSnapshot().groundItems, [groundRow()])
  const entity = server.ownership.items.get(GROUND_ITEM_ID).entity
  const prototype = entity.item._prototype, flags = [...entity.base.flags], invLocation = entity.item.invLocation
  assert.equal(entity.ground, true)
  assert.equal(entity.item.parent, null)
  assert.equal(server.map.isTileBlocked(4, 7), false)
  const originalPosition = [entity.base.location.x, entity.base.location.y]
  const picked = await approachPickup(context)
  assert.deepEqual(picked.result, { kind: 'pickup', targetId: GROUND_ITEM_ID,
    inventory: inventoryView([ownedRow()]) })
  assert.equal(entity.ground, false)
  assert.equal(entity.item.parent, '16086.json')
  assert.deepEqual(server.getSnapshot().groundItems, [])
  assert.deepEqual(server.lastCommand, { id: picked.id, type: 'pickup', status: 'completed', result: { kind: 'pickup' } })
  assert.equal(JSON.stringify(server.getSnapshot()).includes(GROUND_ITEM_ID), false)
  assert.equal(command('inventory').result.items[0].canDrop, true)
  const location = [server.player.base.location.x, server.player.base.location.y], revision = server.revision
  const dropped = transferGround(context, 'drop')
  assert.equal(dropped.ok, true)
  assert.equal(server.revision, revision + 1)
  assert.deepEqual(dropped.result, { kind: 'drop', itemId: GROUND_ITEM_ID, ground: groundRow(location),
    inventory: inventoryView([]) })
  assert.equal(entity.ground, true)
  assert.equal(entity.item.parent, null)
  assert.equal(server.map.getTile(...location).Generic[entity.id], entity)
  assert.equal(server.map.getTile(...originalPosition).Generic[entity.id], undefined)
  assert.deepEqual([...entity.base.flags], flags, 'Inventory flags are never mutated on instance or prototype')
  assert.equal(entity.item.invLocation, invLocation)
  assert.equal(prototype.groundTransferSupported, true)
  assert.equal(transferGround(context, 'pickup').ok, true)
  assert.equal(entity.ground, false)
  assert.equal(server.map.getTile(...originalPosition).Generic[entity.id], entity)
  assert.equal(server.map.getTile(...location).Generic[entity.id], undefined)
  assert.deepEqual([...entity.base.flags], flags)
})

test('marked ground Generic can be put and taken from containers with stable private capability but ordinary items and Keys cannot drop', async t => {
  const { start } = await fixture(t)
  const context = await start(), { server, use, transfer, takeKey } = context
  await approachPickup(context)
  use(BOX_ID)
  const put = transfer('put', BOX_ID, GROUND_ITEM_ID)
  assert.equal(put.ok, true)
  assert.deepEqual(put.result.items.find(item => item.id === GROUND_ITEM_ID), ownedRow())
  assert.deepEqual(server.getSnapshot().groundItems, [])
  assert.equal(transfer('take', BOX_ID, GROUND_ITEM_ID).result.inventory.items[0].canDrop, true)
  assert.equal(transfer('take', BOX_ID, TOKEN_ID).ok, true)
  assert.equal(context.command('drop', { itemId: TOKEN_ID, expectedRevision: server.revision }).code, 'UNSUPPORTED_ITEM')
  assert.equal(takeKey().ok, true)
  assert.equal(context.command('drop', { itemId: KEY_ID, expectedRevision: server.revision }).code, 'UNSUPPORTED_ITEM')
  assert.equal(server.getSnapshot().groundItems.length, 0)
})

test('ground commands validate strict intentions, revision, range, replay, pause, busy and observer authorization', async t => {
  const { start } = await fixture(t)
  const context = await start(), { server, command, use, finish } = context
  assert.equal(transferGround(context, 'pickup').code, 'OUT_OF_RANGE')
  for (const extra of [{ location: [4, 4] }, { itemId: GROUND_ITEM_ID }, { expectedRevision: 0.5 }] as const) {
    assert.equal(transferGround(context, 'pickup', extra).code, 'INVALID_COMMAND')
  }
  assert.equal(server.command({ data: { joined: true, role: 'observer' } }, {
    version: 1, id: 100, actorId: '0', type: 'pickup', targetId: GROUND_ITEM_ID, expectedRevision: server.revision,
  }).code, 'FORBIDDEN')
  assert.equal(command('pause').ok, true)
  assert.equal(transferGround(context, 'pickup').code, 'PAUSED')
  assert.equal(command('resume').ok, true)
  const accepted = use(GROUND_ITEM_ID, false)
  assert.equal(accepted.status, 'accepted')
  assert.equal(transferGround(context, 'pickup').code, 'BUSY')
  finish()
  const stale = server.revision - 1
  assert.equal(transferGround(context, 'pickup', { expectedRevision: stale }).code, 'STALE_REVISION')
  const picked = transferGround(context, 'pickup')
  assert.equal(picked.ok, true)
  assert.equal(server.command(context.owner, { version: 1, id: picked.id, actorId: '0', type: 'pickup',
    targetId: GROUND_ITEM_ID, expectedRevision: server.revision }).code, 'REPLAYED_COMMAND')
  assert.equal(transferGround(context, 'pickup').code, 'UNKNOWN_TARGET')
  server.checkpointBusy = true
  assert.equal(transferGround(context, 'drop').code, 'BUSY')
  server.checkpointBusy = false
  assert.equal(command('pause').ok, true)
  assert.equal(transferGround(context, 'drop').code, 'PAUSED')
  assert.equal(command('resume').ok, true)
  assert.equal(transferGround(context, 'drop', { target: [4, 4] }).code, 'INVALID_COMMAND')
  assert.equal(actorContents(server).length, 1)
})

test('drop preflight and rollback preserve both visibility and inventory if parent or tile registration writes fail', async t => {
  for (const field of ['parent', 'ground', 'location', 'tile'] as const) {
    await t.test(field, async sub => {
      const { start } = await fixture(sub)
      const context = await start(), { server } = context
      await approachPickup(context)
      const entity = server.ownership.items.get(GROUND_ITEM_ID).entity
      const location = [server.player.base.location.x, server.player.base.location.y]
      const target = field === 'parent' ? entity.item : field === 'location' ? entity.base : field === 'tile' ? server.map.getTile(...location) : entity
      const key = field === 'tile' ? 'Generic' : field
      const descriptor = Object.getOwnPropertyDescriptor(target, key)
      const before = server.ownership.checkpointStates(), revision = server.revision
      Object.defineProperty(target, key, { value: target[key], writable: false, configurable: true })
      assert.equal(transferGround(context, 'drop').code, 'INVENTORY_UNAVAILABLE')
      if (descriptor) Object.defineProperty(target, key, descriptor)
      else delete target[key]
      assert.deepEqual(server.ownership.checkpointStates(), before)
      assert.equal(server.revision, revision)
      assert.equal(entity.ground, false)
      assert.equal(entity.item.parent, '16086.json')
    })
  }
})

test('pickup preflight cannot partially remove a ground item or change its registration when actor inventory is frozen', async t => {
  const { start } = await fixture(t)
  const context = await start(), { server, use } = context
  use(GROUND_ITEM_ID)
  const before = server.ownership.checkpointStates(), revision = server.revision
  Object.defineProperty(server.player.critter, 'inventoryIndex', { value: 0, writable: false, configurable: true })
  assert.equal(transferGround(context, 'pickup').code, 'INVENTORY_UNAVAILABLE')
  Object.defineProperty(server.player.critter, 'inventoryIndex', { value: 0, writable: true, configurable: true })
  assert.deepEqual(server.ownership.checkpointStates(), before)
  assert.deepEqual(server.getSnapshot().groundItems, [groundRow()])
  assert.equal(server.revision, revision)
})

test('drop rejects a Portal tile even when open, and a tile already occupied by another ground item', async t => {
  const { start } = await fixture(t, async change => {
    // Opt this separate authored fixture in with exactly the reviewed static
    // ground artwork. Production token remains unsupported for Drop.
    await change('Prototypes/Generic/900003.json', data => {
      data.Item.groundTransferSupported = true
      data.Visual = { classes: { current: { type: 'Item', category: 'Workshop', subcat: 'Base', number: 0,
        display: 'Ground', stage: 'North', frame: 0 } }, render: { flags: [] } }
    })
  })
  const context = await start(), { server, use, transfer, command, finish } = context
  await approachPickup(context)
  use(BOX_ID); assert.equal(transfer('take', BOX_ID, TOKEN_ID).ok, true)
  use(DOOR_ID)
  assert.equal(command('move', { target: [8, 4] }).ok, true); finish()
  assert.equal(transferGround(context, 'drop').code, 'BLOCKED')
  assert.equal(command('move', { target: [7, 4] }).ok, true); finish()
  assert.equal(transferGround(context, 'drop').ok, true)
  assert.equal(command('drop', { itemId: TOKEN_ID, expectedRevision: server.revision }).code, 'GROUND_OCCUPIED')
  assert.equal(server.ownership.actorInventory().items[0].id, TOKEN_ID)
  const checkpoint = server.createCheckpoint()
  checkpoint.ownership.items.find(row => row.id === GROUND_ITEM_ID).groundLocation = [8, 4]
  assert.throws(() => server.validateCheckpoint(checkpoint), { code: 'CHECKPOINT_INVALID' })
})

test('ground marker and static artwork are immutable, and malformed initial floor objects never become transferable', async t => {
  const mutations = [data => { delete data.Item.groundTransferSupported }, data => { data.Item.flags = ['NoDrop'] },
    data => { data.Base.flags = [] }, data => { data.Visual.classes.current.type = 'Scenery' },
    data => { data.Visual.classes.current.frame = 1 }, data => { data.Item.invLocation = -1 }]
  for (let index = 0; index < mutations.length; index++) {
    await t.test(`malformed source ${index}`, async sub => {
      const { start } = await fixture(sub, async (change, dataPath) => {
        // This malformed-ground fixture intentionally removes the item from
        // the immutable universe. Remove the unrelated authored quest which
        // correctly requires that item to exist when validating its rules.
        await change('Prototypes/Npc/900008.json', data => { data.Npc.conversationSupported = false })
        await fs.rm(path.join(dataPath, 'rules/Conversations.json'))
        await change('Prototypes/Generic/900007.json', mutations[index])
        if (index === 5) await change(GROUND_ITEM_ID, data => { data.Item.invLocation = -1 })
      })
      const context = await start()
      assert.deepEqual(context.server.getSnapshot().groundItems, [])
      assert.equal(context.use(GROUND_ITEM_ID).code, 'UNKNOWN_TARGET')
    })
  }
  const { start } = await fixture(t)
  const context = await start(), { server } = context
  await approachPickup(context)
  const entity = server.ownership.items.get(GROUND_ITEM_ID).entity
  Object.defineProperty(entity.item, 'groundTransferSupported', { value: false, configurable: true, writable: true })
  assert.equal(transferGround(context, 'drop').code, 'INVENTORY_UNAVAILABLE')
  assert.throws(() => server.createCheckpoint(), { code: 'CHECKPOINT_INVALID' })
  assert.equal(entity.item.parent, '16086.json')
})

test('unknown actor ownership remains unknown with a public ground object and cannot pick up or forge its owner', async t => {
  const { start } = await fixture(t, change => change('16086.json', data => { delete data.Critter.inventory; delete data.Critter.progressionSupported }))
  const context = await start(), { server, use } = context
  assert.deepEqual(server.getSnapshot().groundItems, [groundRow()])
  use(GROUND_ITEM_ID)
  assert.equal(transferGround(context, 'pickup').code, 'INVENTORY_UNAVAILABLE')
  assert.equal(Object.hasOwn(server.player.critter, 'inventory'), false)
  assert.doesNotThrow(() => server.validateCheckpoint(server.createCheckpoint()))
  const changed = server.createCheckpoint()
  changed.ownership.items.find(row => row.id === GROUND_ITEM_ID).groundLocation = [4, 8]
  assert.throws(() => server.validateCheckpoint(changed), { code: 'CHECKPOINT_INVALID' })
})

test('checkpoint schema6 restores ground/held/container ownership, visibility, coordinates and registration across a fresh host', async t => {
  const { start, checkpointPath } = await fixture(t)
  const first = await start()
  await approachPickup(first)
  assert.equal(first.command('move', { target: [5, 5] }).ok, true); first.finish()
  assert.equal(transferGround(first, 'drop').ok, true)
  assert.equal((await first.command('save')).ok, true)
  const bytes = await fs.readFile(checkpointPath, 'utf8'), saved = JSON.parse(bytes)
  assert.equal(saved.version, 6)
  assert.equal(saved.rulesVersion, 'movement-doors-ownership-attributes-weight-v10')
  assert.deepEqual(saved.ownership.items.find(row => row.id === GROUND_ITEM_ID), { id: GROUND_ITEM_ID, parent: null, groundLocation: [5, 5] })
  assert.equal(transferGround(first, 'pickup').ok, true)
  assert.equal((await first.command('load')).ok, true)
  assert.deepEqual(first.server.getSnapshot().groundItems, [groundRow([5, 5])])
  await first.server.stop()
  const second = await start()
  assert.equal((await second.command('load')).ok, true)
  assert.deepEqual(second.server.getSnapshot().groundItems, [groundRow([5, 5])])
  assert.equal(second.server.player.critter.inventoryIndex, 0)
  assert.equal(await fs.readFile(checkpointPath, 'utf8'), bytes)
  assert.equal(transferGround(second, 'pickup').ok, true)
  second.use(BOX_ID)
  assert.equal(second.transfer('put', BOX_ID, GROUND_ITEM_ID).ok, true)
  assert.equal((await second.command('save')).ok, true)
  const containerBytes = await fs.readFile(checkpointPath, 'utf8')
  await second.server.stop()
  const third = await start()
  assert.equal((await third.command('load')).ok, true)
  assert.deepEqual(third.server.getSnapshot().groundItems, [])
  third.use(BOX_ID)
  assert.deepEqual(third.command('inspect', { targetId: BOX_ID }).result.items.find(row => row.id === GROUND_ITEM_ID), ownedRow())
  assert.equal(await fs.readFile(checkpointPath, 'utf8'), containerBytes)
})

test('checkpoint tampering with ground positions, parent/list reciprocity and unmarked item placements is rejected before changing live fields', async t => {
  const { start } = await fixture(t)
  const context = await start(), { server } = context
  const original = server.createCheckpoint(), before = server.ownership.checkpointStates()
  const tamper = [
    row => { row.groundLocation = [-1, 4] }, row => { row.groundLocation = [1000, 4] },
    row => { row.groundLocation = [4.5, 7] }, row => { row.groundLocation = [0, 0] },
    row => { row.groundLocation = [6, 4] }, row => { row.groundLocation = [8, 4] },
    row => { row.groundLocation = null }, row => { row.parent = '16086.json' },
    row => { row.quantity = 5 }, row => { delete row.groundLocation },
  ]
  for (const mutate of tamper) {
    const candidate = structuredClone(original)
    mutate(candidate.ownership.items.find(row => row.id === GROUND_ITEM_ID))
    assert.throws(() => server.validateCheckpoint(candidate), { code: 'CHECKPOINT_INVALID' })
    assert.deepEqual(server.ownership.checkpointStates(), before)
  }
  const ordinary = structuredClone(original)
  ordinary.ownership.owners.find(row => row.id === BOX_ID).items = []
  ordinary.ownership.owners.find(row => row.id === BOX_ID).inventoryIndex = 0
  Object.assign(ordinary.ownership.items.find(row => row.id === TOKEN_ID), { parent: null, groundLocation: [4, 4] })
  assert.throws(() => server.validateCheckpoint(ordinary), { code: 'CHECKPOINT_INVALID' })
  for (const version of [1, 2, 3, 4, 5] as const) {
    const previous = { ...original, version }
    assert.throws(() => server.validateCheckpoint(previous), { code: 'CHECKPOINT_INCOMPATIBLE' })
  }
})

test('ground checkpoint rollback restores tile dictionaries and visibility if a later door write throws', async t => {
  const { start } = await fixture(t)
  const context = await start(), { server } = context
  const original = server.createCheckpoint()
  await approachPickup(context)
  const before = server.ownership.checkpointStates()
  const candidate = server.validateCheckpoint(original)
  const door = server.doors.states.get(DOOR_ID)
  const descriptor = Object.getOwnPropertyDescriptor(door, 'open')
  const proxy = new Proxy(door, { defineProperty() { throw new Error('reject door commit') } })
  server.doors.states.set(DOOR_ID, proxy)
  assert.throws(() => server.applyCheckpoint(candidate), { code: 'CHECKPOINT_INVALID' })
  server.doors.states.set(DOOR_ID, door)
  Object.defineProperty(door, 'open', descriptor)
  assert.deepEqual(server.ownership.checkpointStates(), before)
  assert.deepEqual(server.getSnapshot().groundItems, [])
})
