const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const { before, test } = require('node:test') as typeof import('node:test')
const fs = require('node:fs/promises') as typeof import('node:fs/promises')
const os = require('node:os') as typeof import('node:os')
const path = require('node:path') as typeof import('node:path')
const Module = require('node:module') as typeof import('node:module')
const { generate, MAP_ID, BOX_ID, TOKEN_ID, TOKEN_LABEL, DOOR_ID, LOCKED_DOOR_ID, KEY_BOX_ID, KEY_ID, LOCK_KEY_ID } = require('../../../examples/inventory-workshop/generate.cts')
const root = path.resolve(__dirname, '../../..')
const source = path.join(root, '@openarcanum/agate/src')
let engine

before(async () => {
  const { build } = await import('esbuild')
  const result = await build({
    absWorkingDir: root,
    stdin: { contents: `export { createAuthorityServer } from './server/authority/AuthorityServer.ts';
      export { default as InventoryOwnership, prepareOwnWrites, keyMatchesLock } from './server/authority/InventoryOwnership.ts';`,
    resolveDir: source, sourcefile: 'key-door-tests.js' },
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
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agate-key-door-'))
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

test('matching keys reject zero and malformed IDs, and allow equality or master ID one on either side', () => {
  for (const invalid of [0, -1, 1.5, '7001', undefined, null, NaN, Infinity, 2147483648] as const) {
    assert.equal(engine.keyMatchesLock(invalid, 7001), false)
    assert.equal(engine.keyMatchesLock(7001, invalid), false)
    assert.equal(engine.keyMatchesLock(1, invalid), false)
    assert.equal(engine.keyMatchesLock(invalid, 1), false)
  }
  assert.equal(engine.keyMatchesLock(7001, 7001), true)
  assert.equal(engine.keyMatchesLock(1, 7001), true)
  assert.equal(engine.keyMatchesLock(7001, 1), true)
  assert.equal(engine.keyMatchesLock(2147483647, 2147483647), true)
  assert.equal(engine.keyMatchesLock(7001, 7002), false)
})

test('a reviewed locked door requires a held key, opens without unlocking or consuming it, and keeps private metadata out of snapshots', async t => {
  const { start } = await fixture(t)
  const { server, command, use, takeKey, key, door } = await start()
  const advertised = server.getSnapshot().doors.find(row => row.id === LOCKED_DOOR_ID)
  assert.equal(advertised.locked, true)
  assert.equal(advertised.usable, true, 'public capability does not reveal private possession')
  const revision = server.revision
  assert.equal(use(LOCKED_DOOR_ID).code, 'LOCKED')
  assert.equal(server.movement, null, 'missing key is rejected before walking')
  assert.equal(server.revision, revision)
  const taken = takeKey()
  assert.equal(taken.ok, true)
  assert.deepEqual(taken.result.inventory.items, [{ id: KEY_ID, slot: 0, label: 'Key', type: 'Key', prototypeId: 900005 }])
  const inventory = structuredClone(server.player.critter.inventory)
  const flags = [...door().entity.portal.flags]
  assert.equal(use(LOCKED_DOOR_ID).ok, true)
  assert.equal(server.lastCommand.status, 'completed')
  assert.deepEqual(server.lastCommand.result, { targetId: LOCKED_DOOR_ID, open: true })
  assert.equal(door().entity.portalOpen, true)
  assert.deepEqual([...door().entity.portal.flags], flags)
  assert.equal(server.getSnapshot().doors.find(row => row.id === LOCKED_DOOR_ID).locked, true)
  assert.deepEqual(server.player.critter.inventory, inventory)
  assert.equal(key().item.parent, '16086.json')
  assert.equal(key().item.invLocation, 0)
  assert.deepEqual(command('inventory').result.items, taken.result.inventory.items)
  const publicState = JSON.stringify(server.getSnapshot())
  assert.equal(publicState.includes(KEY_ID), false)
  assert.equal(publicState.includes('keyId'), false)
  assert.equal(publicState.includes('7001'), false)
  assert.equal(server.ownership.canEverUseKey(LOCK_KEY_ID), true)
})

test('whole Key take, put and retake preserve identity, sparse holes, component references and prototypes', async t => {
  const { start } = await fixture(t)
  const { server, transfer, takeKey, key } = await start()
  const entity = key(), component = entity.key, prototype = component._prototype
  const prototypeKeyId = prototype.keyId
  assert.equal(takeKey().ok, true)
  for (let index = 0; index < 3; index++) {
    assert.equal(transfer('put').result.items[0].slot, 0)
    assert.equal(entity.item.parent, KEY_BOX_ID)
    assert.equal(transfer('take').result.inventory.items[0].slot, 0)
    assert.equal(entity, key())
    assert.equal(entity.key, component)
    assert.equal(entity.key.keyId, LOCK_KEY_ID)
    assert.equal(entity.item.invLocation, 0)
    assert.equal(prototype.keyId, prototypeKeyId)
    assert.doesNotThrow(() => server.validateCheckpoint(server.createCheckpoint()))
  }
})

test('Take All includes both supported Generic and Key rows in sparse source order with one atomic commit', async t => {
  const { start } = await fixture(t, async change => {
    await change(BOX_ID, data => { data.Container.inventory = []; data.Container.inventoryIndex = 0 })
    await change(TOKEN_ID, data => { data.Item.parent = KEY_BOX_ID })
    await change(KEY_BOX_ID, data => {
      data.Container.inventory.push({ id: TOKEN_ID, slot: 8 }); data.Container.inventoryIndex = 2
    })
  })
  const { server, use, transfer } = await start()
  use(KEY_BOX_ID)
  const revision = server.revision
  const result = transfer('take-all')
  assert.equal(result.ok, true)
  assert.deepEqual(result.result.itemIds, [KEY_ID, TOKEN_ID])
  assert.deepEqual(result.result.inventory.items.map(row => [row.id, row.slot]), [[KEY_ID, 0], [TOKEN_ID, 1]])
  assert.equal(server.revision, revision + 1)
  assert.equal(server.ownership.hasKey(server.player, LOCK_KEY_ID), true)
  assert.deepEqual(server.lastCommand.result, { kind: 'take-all', targetId: KEY_BOX_ID })
  assert.doesNotThrow(() => server.validateCheckpoint(server.createCheckpoint()))
})

test('unreviewed original-style locked doors cannot acquire key support from omitted script metadata', async t => {
  const { start } = await fixture(t, change => change(LOCKED_DOOR_ID, data => { delete data.Portal.keyUseSupported }))
  const { server, use, takeKey, door, state } = await start()
  assert.equal(takeKey().ok, true)
  const before = state()
  assert.equal(use(LOCKED_DOOR_ID).code, 'LOCKED')
  assert.equal(server.getSnapshot().doors.find(row => row.id === LOCKED_DOOR_ID).usable, false)
  const forged = server.createCheckpoint()
  forged.doors.find(row => row.id === LOCKED_DOOR_ID).open = true
  assert.throws(() => server.validateCheckpoint(forged), { code: 'CHECKPOINT_INVALID' })
  assert.deepEqual(state(), before)
  Object.defineProperty(door().entity.portal, 'keyUseSupported', { value: true, configurable: true, writable: true })
  assert.equal(use(LOCKED_DOOR_ID).code, 'UNSUPPORTED_DOOR', 'changing a missing marker cannot enable authorization')
})

test('matching ordinary and master keys use the same authority path while mismatches remain locked', async t => {
  for (const [keyId, lockId, allowed] of [[1, 7001, true], [7001, 1, true], [7001, 7002, false], [1, 0, false]] as const) {
    await t.test(`${keyId} to ${lockId}`, async sub => {
      const { start } = await fixture(sub, async change => {
        await change('Prototypes/Key/900005.json', data => { data.Key.keyId = keyId })
        await change(LOCKED_DOOR_ID, data => { data.Portal.keyID = lockId })
      })
      const { use, takeKey, door } = await start()
      assert.equal(takeKey().ok, true)
      const result = use(LOCKED_DOOR_ID)
      assert.equal(result.ok, allowed)
      if (!allowed) assert.equal(result.code, 'LOCKED')
      assert.equal(door().open, allowed)
    })
  }
})

test('unknown actor inventory and either keyring spelling forbid standalone key transfer and authorization', async t => {
  for (const type of ['unknown', 'KeyRing', 'Keyring'] as const) {
    await t.test(type, async sub => {
      const { start } = await fixture(sub, async (change, dataPath) => {
        if (type === 'unknown') {
          await change('16086.json', data => { delete data.Critter.inventory })
          return
        }
        // Reuse a catalogued entity/prototype, because the loader discovers
        // entity and prototype paths from the authored ZIP catalogs.
        await change('Prototypes/Generic/900003.json', data => { data.Base.type = type })
        await change(TOKEN_ID, data => { data.Item.parent = '16086.json' })
        await change(BOX_ID, data => { data.Container.inventory = []; data.Container.inventoryIndex = 0 })
        await change('16086.json', data => {
          data.Critter.inventory = [{ id: TOKEN_ID, slot: 4 }]; data.Critter.inventoryIndex = 1
        })
      })
      const { server, use, transfer } = await start()
      use(KEY_BOX_ID)
      const result = transfer('take')
      assert.equal(result.code, type === 'unknown' ? 'INVENTORY_UNAVAILABLE' : 'UNSUPPORTED_ITEM')
      assert.equal(server.ownership.hasKey(server.player, LOCK_KEY_ID), false)
      assert.equal(server.ownership.canEverUseKey(LOCK_KEY_ID), false)
      assert.equal(use(LOCKED_DOOR_ID).code, 'LOCKED')
    })
  }
})

test('malformed keys and nonempty item flags reject entire batches without moving a supported sibling', async t => {
  const mutations = [
    data => { data.Key.keyId = 0 }, data => { data.Key.keyId = '7001' },
    data => { data.Key.keyId = 2147483648 }, data => { data.Key.keyId = 2.5 },
    data => { data.Item.invLocation = -1 }, data => { data.Item.flags = ['Identified'] },
  ]
  for (let index = 0; index < mutations.length; index++) {
    await t.test(`unsupported metadata ${index}`, async sub => {
      const { start } = await fixture(sub, async change => {
        await change('Prototypes/Key/900005.json', mutations[index])
        if (index === 4) await change(KEY_ID, data => { data.Item.invLocation = -1 })
        await change(BOX_ID, data => { data.Container.inventory = []; data.Container.inventoryIndex = 0 })
        await change(TOKEN_ID, data => { data.Item.parent = KEY_BOX_ID })
        await change(KEY_BOX_ID, data => {
          data.Container.inventory.push({ id: TOKEN_ID, slot: 8 }); data.Container.inventoryIndex = 2
        })
      })
      const { server, use, transfer, state } = await start()
      use(KEY_BOX_ID)
      const before = state(), revision = server.revision
      assert.equal(transfer('take-all').code, 'UNSUPPORTED_ITEM')
      assert.deepEqual(state(), before)
      assert.equal(server.revision, revision)
      assert.equal(server.ownership.canEverUseKey(LOCK_KEY_ID), false)
    })
  }
})

test('key metadata changes and equal-valued component replacement invalidate immutable ownership before commit', async t => {
  const { start } = await fixture(t)
  const { server, takeKey, transfer, key, use, door } = await start()
  assert.equal(takeKey().ok, true)
  const entity = key(), component = entity.key
  const inventory = structuredClone(server.player.critter.inventory)
  entity.key = { keyId: LOCK_KEY_ID }
  assert.equal(transfer('put').code, 'INVENTORY_UNAVAILABLE')
  assert.equal(server.ownership.hasKey(server.player, LOCK_KEY_ID), false)
  assert.equal(use(LOCKED_DOOR_ID).code, 'LOCKED')
  assert.deepEqual(server.player.critter.inventory, inventory)
  entity.key = component
  Object.defineProperty(component, 'keyId', { value: LOCK_KEY_ID + 1, writable: true, configurable: true })
  assert.equal(transfer('put').code, 'INVENTORY_UNAVAILABLE')
  assert.equal(door().open, false)
  assert.equal(entity.item.parent, '16086.json')
})

test('approach arrival rechecks held key and immutable door metadata', async t => {
  for (const mutation of ['key', 'lock', 'marker'] as const) {
    await t.test(mutation, async sub => {
      const { start } = await fixture(sub)
      const { server, takeKey, use, finish, key, door } = await start()
      assert.equal(takeKey().ok, true)
      const result = use(LOCKED_DOOR_ID, false)
      assert.equal(result.status, 'accepted')
      if (mutation === 'key') Object.defineProperty(key().key, 'keyId', { value: 7002, configurable: true, writable: true })
      if (mutation === 'lock') Object.defineProperty(door().entity.portal, 'keyID', { value: 7002, configurable: true, writable: true })
      if (mutation === 'marker') Object.defineProperty(door().entity.portal, 'keyUseSupported', { value: false, configurable: true, writable: true })
      finish()
      assert.equal(server.lastCommand.status, 'interrupted')
      assert.equal(server.lastCommand.code, mutation === 'key' ? 'LOCKED' : 'UNSUPPORTED_DOOR')
      assert.equal(door().open, false)
      assert.equal(door().entity.portalOpen, false)
    })
  }
})

test('door pose writes preflight together and an occupied open door cannot close without a key', async t => {
  const { start } = await fixture(t)
  const { server, takeKey, use, command, finish, transfer, door } = await start()
  assert.equal(takeKey().ok, true)
  const entity = door().entity
  Object.defineProperty(entity, 'portalOpen', { value: false, writable: false, configurable: true })
  const result = use(LOCKED_DOOR_ID)
  assert.equal(result.ok, true, 'the approach was accepted')
  assert.equal(server.lastCommand.code, 'UNSUPPORTED_DOOR')
  assert.equal(door().open, false)
  assert.equal(entity.portalOpen, false)
  Object.defineProperty(entity, 'portalOpen', { value: false, writable: true, configurable: true })
  assert.equal(use(LOCKED_DOOR_ID).ok, true)
  assert.equal(door().open, true)
  use(KEY_BOX_ID); assert.equal(transfer('put').ok, true)
  assert.equal(server.ownership.hasKey(server.player, LOCK_KEY_ID), false)
  assert.equal(command('move', { target: [10, 6] }).ok, true); finish()
  assert.equal(use(LOCKED_DOOR_ID).code, 'OCCUPIED')
  assert.equal(door().open, true)
  assert.equal(command('move', { target: [9, 6] }).ok, true); finish()
  assert.equal(use(LOCKED_DOOR_ID).result.open, false, 'closing a supported open lock does not consume or require a key')
  assert.equal(use(LOCKED_DOOR_ID).code, 'LOCKED')
})

test('open locked pose survives save and fresh-host load after putting the attainable key away', async t => {
  const { start, checkpointPath } = await fixture(t)
  const first = await start()
  assert.equal(first.takeKey().ok, true)
  first.use(LOCKED_DOOR_ID)
  assert.equal(first.door().open, true)
  first.use(KEY_BOX_ID); assert.equal(first.transfer('put').ok, true)
  assert.equal(first.server.ownership.hasKey(first.server.player, LOCK_KEY_ID), false)
  assert.equal((await first.command('save')).ok, true)
  const bytes = await fs.readFile(checkpointPath, 'utf8')
  const saved = JSON.parse(bytes)
  assert.equal(saved.rulesVersion, 'movement-doors-ownership-attributes-v9')
  assert.equal(saved.version, 6)
  assert.equal(saved.doors.find(row => row.id === LOCKED_DOOR_ID).open, true)
  assert.equal(saved.ownership.items.find(row => row.id === KEY_ID).parent, KEY_BOX_ID)
  await first.server.stop()
  const second = await start()
  assert.equal((await second.command('load')).ok, true)
  assert.equal(second.door().open, true)
  assert.equal(second.door().entity.portal.flags.has('Locked'), true)
  assert.equal(second.server.player.critter.inventory.length, 0)
  assert.equal(second.key().item.parent, KEY_BOX_ID)
  assert.equal(second.use(LOCKED_DOOR_ID).ok, true)
  assert.equal(second.door().open, false)
  assert.equal(second.use(LOCKED_DOOR_ID).code, 'LOCKED')
  assert.equal(await fs.readFile(checkpointPath, 'utf8'), bytes, 'loading never migrates or overwrites the save')
})

test('keys in unsupported locked sources cannot authorize opening or forged checkpoint poses', async t => {
  const { start } = await fixture(t, change => change(KEY_BOX_ID, data => { data.Container.flags = ['Locked'] }))
  const { server, use, door } = await start()
  assert.equal(server.ownership.canEverUseKey(LOCK_KEY_ID), false)
  assert.equal(use(KEY_BOX_ID).code, 'LOCKED')
  assert.equal(use(LOCKED_DOOR_ID).code, 'LOCKED')
  const forged = server.createCheckpoint()
  forged.doors.find(row => row.id === LOCKED_DOOR_ID).open = true
  assert.throws(() => server.validateCheckpoint(forged), { code: 'CHECKPOINT_INVALID' })
  assert.equal(door().open, false)
  assert.equal(server.player.critter.inventory.length, 0)
})
