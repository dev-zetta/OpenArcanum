const assert = require('node:assert/strict')
const { before, test } = require('node:test')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')
const { generate, MAP_ID, BOX_ID, TOKEN_ID, TOKEN_LABEL, DOOR_ID, LOCKED_DOOR_ID, KEY_BOX_ID, KEY_ID, LOCK_KEY_ID, LOCKED_BOX_ID, PRIZE_ID, PRIZE_LABEL } = require('../../../examples/inventory-workshop/generate.cjs')
const root = path.resolve(__dirname, '../../..')
const source = path.join(root, '@openarcanum/agate/src')
let engine

before(async () => {
  const { build } = await import('esbuild')
  const { transformAsync } = await import('@babel/core')
  const result = await build({
    absWorkingDir: root,
    stdin: { contents: `export { createAuthorityServer } from './server/authority/AuthorityServer.js';
      export { default as InventoryOwnership, prepareOwnWrites, keyMatchesLock } from './server/authority/InventoryOwnership.js';`,
    resolveDir: source, sourcefile: 'key-container-tests.js' },
    bundle: true, platform: 'node', format: 'cjs', target: 'node24', write: false,
    external: ['electron', 'workerpool'], loader: { '.glsl': 'text' },
    plugins: [{ name: 'key-container-flow', setup(builder) {
      builder.onLoad({ filter: /\.js$/ }, async ({ path: filename }) => {
        if (!filename.startsWith(source + path.sep)) return
        const result = await transformAsync(await fs.readFile(filename, 'utf8'), {
          filename, configFile: false, babelrc: false,
          plugins: [['@babel/plugin-transform-flow-strip-types', { allowDeclareFields: false }]],
        })
        return { contents: result.code, loader: 'js', resolveDir: path.dirname(filename) }
      })
    } }],
  })
  const compiled = new Module(__filename + '.bundle.cjs', module)
  compiled.filename = __filename + '.bundle.cjs'
  compiled.paths = Module._nodeModulePaths(root)
  compiled._compile(result.outputFiles[0].text, compiled.filename)
  engine = compiled.exports
})

async function fixture(t, modify) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agate-key-container-'))
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

test('authored locked container access requires a held key for use, inspection and every transfer without consuming or unlocking it', async t => {
  const { start } = await fixture(t)
  const { server, use, command, transfer, takeKey, key } = await start()
  const descriptor = server.getSnapshot().containers.find(row => row.id === LOCKED_BOX_ID)
  assert.equal(descriptor.locked, true)
  assert.equal(descriptor.usable, true, 'structural capability never depends on private possession')
  const revision = server.revision
  assert.equal(use(LOCKED_BOX_ID).code, 'LOCKED')
  assert.equal(server.movement, null)
  assert.equal(server.revision, revision)
  assert.equal(command('inspect', { targetId: LOCKED_BOX_ID }).code, 'LOCKED')
  assert.equal(transfer('take', LOCKED_BOX_ID, PRIZE_ID).code, 'LOCKED')
  assert.equal(takeKey().ok, true)
  const keyComponent = key().key, keyFlags = [...key().item.flags]
  assert.equal(use(LOCKED_BOX_ID).ok, true)
  const inspected = command('inspect', { targetId: LOCKED_BOX_ID })
  assert.deepEqual(inspected.result.items, [{ id: PRIZE_ID, slot: 3, label: PRIZE_LABEL, type: 'Generic', prototypeId: 900006 }])
  const taken = transfer('take', LOCKED_BOX_ID, PRIZE_ID)
  assert.equal(taken.ok, true)
  assert.equal(taken.result.inventory.items.find(row => row.id === PRIZE_ID).slot, 1)
  assert.equal(transfer('put', LOCKED_BOX_ID, PRIZE_ID).ok, true)
  assert.equal(transfer('take-all', LOCKED_BOX_ID).ok, true)
  assert.equal(key().key, keyComponent)
  assert.deepEqual([...key().item.flags], keyFlags)
  assert.equal(key().item.parent, '16086.json')
  assert.equal(key().key.keyId, LOCK_KEY_ID)
  assert.equal(server.containers.states.get(LOCKED_BOX_ID).entity.container.flags.has('Locked'), true)
  const publicState = JSON.stringify(server.getSnapshot())
  for (const privateValue of [KEY_ID, PRIZE_ID, PRIZE_LABEL, 'keyId', '7001']) {
    assert.equal(publicState.includes(privateValue), false, privateValue)
  }
})

test('putting the authorizing key inside the locked container loses access immediately but leaves valid savable ownership', async t => {
  const { start, checkpointPath } = await fixture(t)
  const first = await start()
  assert.equal(first.takeKey().ok, true)
  first.use(LOCKED_BOX_ID)
  assert.equal(first.transfer('take', LOCKED_BOX_ID, PRIZE_ID).ok, true)
  const put = first.transfer('put', LOCKED_BOX_ID, KEY_ID)
  assert.equal(put.ok, true)
  assert.equal(put.result.items.find(row => row.id === KEY_ID).slot, 0)
  assert.equal(first.key().item.parent, LOCKED_BOX_ID)
  assert.equal(first.server.ownership.hasKey(first.server.player, LOCK_KEY_ID), false)
  assert.equal(first.server.ownership.canEverUseKey(LOCK_KEY_ID), true, 'initial attainability is independent of current possession')
  const before = first.server.ownership.checkpointStates(), revision = first.server.revision
  assert.equal(first.command('inspect', { targetId: LOCKED_BOX_ID }).code, 'LOCKED')
  for (const kind of ['take', 'put', 'take-all']) {
    assert.equal(first.transfer(kind, LOCKED_BOX_ID, kind === 'put' ? PRIZE_ID : KEY_ID).code, 'LOCKED')
  }
  assert.equal(first.use(LOCKED_BOX_ID).code, 'LOCKED')
  assert.equal(first.server.ownership.take(first.server.containers.states.get(LOCKED_BOX_ID).entity, KEY_ID).code, 'LOCKED', 'direct authority transfer repeats access validation')
  assert.equal(first.server.revision, revision)
  assert.deepEqual(first.server.ownership.checkpointStates(), before)
  assert.equal((await first.command('save')).ok, true)
  const bytes = await fs.readFile(checkpointPath, 'utf8')
  assert.equal(JSON.parse(bytes).rulesVersion, 'movement-doors-ownership-attributes-v9')
  await first.server.stop()
  const second = await start()
  assert.equal((await second.command('load')).ok, true)
  assert.equal(second.key().item.parent, LOCKED_BOX_ID)
  assert.equal(second.server.ownership.actorInventory().items[0].id, PRIZE_ID)
  assert.equal(second.command('inspect', { targetId: LOCKED_BOX_ID }).code, 'LOCKED')
  assert.equal(second.transfer('put', LOCKED_BOX_ID, PRIZE_ID).code, 'LOCKED')
  assert.doesNotThrow(() => second.server.validateCheckpoint(second.server.createCheckpoint()))
  assert.equal(await fs.readFile(checkpointPath, 'utf8'), bytes)
})

test('a key put away in an ordinary box revokes stale private access while structural eligibility and checkpoint validation remain stable', async t => {
  const { start } = await fixture(t)
  const { server, use, takeKey, transfer, command } = await start()
  assert.equal(takeKey().ok, true)
  use(LOCKED_BOX_ID)
  assert.equal(command('inspect', { targetId: LOCKED_BOX_ID }).ok, true)
  assert.equal(transfer('take', LOCKED_BOX_ID, PRIZE_ID).ok, true)
  use(KEY_BOX_ID); assert.equal(transfer('put').ok, true)
  assert.equal(use(LOCKED_BOX_ID).code, 'LOCKED', 'prior inspection grants no continuing access')
  assert.equal(server.ownership.owners.get(LOCKED_BOX_ID).usableContainer, true)
  assert.doesNotThrow(() => server.validateCheckpoint(server.createCheckpoint()))
  assert.equal(takeKey().ok, true)
  use(LOCKED_BOX_ID)
  assert.equal(transfer('put', LOCKED_BOX_ID, PRIZE_ID).ok, true)
})

test('arrival rechecks key ownership and immutable container marker/key metadata', async t => {
  for (const mutation of ['key', 'marker', 'lock']) {
    await t.test(mutation, async sub => {
      const { start } = await fixture(sub)
      const { server, takeKey, use, finish, key } = await start()
      takeKey()
      assert.equal(use(LOCKED_BOX_ID, false).status, 'accepted')
      const container = server.containers.states.get(LOCKED_BOX_ID).entity.container
      if (mutation === 'key') Object.defineProperty(key().key, 'keyId', { value: 7002, configurable: true, writable: true })
      if (mutation === 'marker') Object.defineProperty(container, 'keyUseSupported', { value: false, configurable: true, writable: true })
      if (mutation === 'lock') Object.defineProperty(container, 'keyId', { value: 7002, configurable: true, writable: true })
      finish()
      assert.equal(server.lastCommand.status, 'interrupted')
      assert.equal(server.lastCommand.code, mutation === 'key' ? 'LOCKED' : 'UNSUPPORTED_CONTAINER')
      assert.equal(server.ownership.items.get(PRIZE_ID).entity.item.parent, LOCKED_BOX_ID)
    })
  }
})

test('unreviewed and unsupported locks remain inaccessible and cannot be enabled by changing live metadata', async t => {
  for (const mode of ['unmarked', 'Jammed', 'MagicallyHeld', 'AlwaysLocked', 'LockedDay', 'Sticky']) {
    await t.test(mode, async sub => {
      const { start } = await fixture(sub, change => change(LOCKED_BOX_ID, data => {
        if (mode === 'unmarked') delete data.Container.keyUseSupported
        else data.Container.flags.push(mode)
      }))
      const { server, takeKey, use } = await start()
      takeKey()
      const state = server.containers.states.get(LOCKED_BOX_ID)
      assert.equal(use(LOCKED_BOX_ID).code, mode === 'unmarked' ? 'LOCKED' : 'UNSUPPORTED_CONTAINER')
      assert.equal(server.ownership.items.get(PRIZE_ID).movable, false)
      if (mode === 'unmarked') {
        Object.defineProperty(state.entity.container, 'keyUseSupported', { value: true, writable: true, configurable: true })
        assert.equal(use(LOCKED_BOX_ID).code, 'UNSUPPORTED_CONTAINER')
      }
    })
  }
})

test('locked-container transfer preflight leaves key, both owners and every parent unchanged on failure', async t => {
  const { start } = await fixture(t)
  const { server, takeKey, use, transfer, key } = await start()
  takeKey(); use(LOCKED_BOX_ID)
  const before = server.ownership.checkpointStates(), revision = server.revision
  const parent = server.ownership.items.get(PRIZE_ID).entity.item
  Object.defineProperty(parent, 'parent', { value: LOCKED_BOX_ID, writable: false, configurable: true })
  assert.equal(transfer('take-all', LOCKED_BOX_ID).code, 'INVENTORY_UNAVAILABLE')
  Object.defineProperty(parent, 'parent', { value: LOCKED_BOX_ID, writable: true, configurable: true })
  assert.deepEqual(server.ownership.checkpointStates(), before)
  assert.equal(key().item.parent, '16086.json')
  assert.equal(server.revision, revision)
})

function closureFixture(definitions, actorEntries = []) {
  const map = { entityManager: { entities: new Map() } }, owners = new Map(), items = new Map()
  const flags = values => { const set = new Set(values); set.hasAny = values => values.some(value => set.has(value)); return set }
  const all = [{ id: '16086.json', type: 'Pc', entries: actorEntries }, ...definitions]
  for (const definition of all) {
    const { id, type = 'Container', entries = [] } = definition
    const component = { inventory: entries.map(({ id, slot }) => ({ id, slot })), inventoryIndex: entries.length, inventorySource: 0 }
    const owner = { id, sourcePath: id, map, policy: definition.policy || { locked: false }, base: { type, flags: flags([]) },
      [type === 'Container' ? 'container' : 'critter']: component }
    owners.set(id, owner); map.entityManager.entities.set(id, owner)
    for (const entry of entries) {
      const itemType = entry.type || (entry.keyId === undefined ? 'Generic' : 'Key')
      const item = { id: entry.id, sourcePath: entry.id, map,
        base: { type: itemType, prototype: 900003, flags: flags(['Inventory']) },
        item: { parent: id, invLocation: 7, flags: flags(entry.flags || []) },
        ...(itemType === 'Key' ? { key: { keyId: entry.keyId } } : {}) }
      items.set(item.id, item); map.entityManager.entities.set(item.id, item)
    }
  }
  const actor = owners.get('16086.json')
  let ownership
  const create = () => ownership = new engine.InventoryOwnership(map, actor, {
    containerPolicy: owner => owner.policy,
    canAccessContainer: (owner, currentActor) => owner.policy.locked && !ownership.hasKey(currentActor, owner.policy.keyId) ?
      { code: 'LOCKED', message: 'Matching key required' } : owner.policy,
  })
  return { actor, owners, items, create }
}

test('initial attainable-key closure admits multistep chains but excludes self locks, cycles, wrong keys and unsupported sources', () => {
  const fixture = closureFixture([
    { id: 'seed', entries: [{ id: 'key-11', slot: 3, keyId: 11 }] },
    { id: 'chain-a', policy: { locked: true, keyId: 11 }, entries: [{ id: 'key-22', slot: 8, keyId: 22 }] },
    { id: 'chain-b', policy: { locked: true, keyId: 22 }, entries: [{ id: 'prize', slot: 6 }] },
    { id: 'cycle-a', policy: { locked: true, keyId: 33 }, entries: [{ id: 'key-44', slot: 3, keyId: 44 }] },
    { id: 'cycle-b', policy: { locked: true, keyId: 44 }, entries: [{ id: 'key-33', slot: 3, keyId: 33 }] },
    { id: 'self', policy: { locked: true, keyId: 55 }, entries: [{ id: 'key-55', slot: 3, keyId: 55 }] },
    { id: 'wrong', policy: { locked: true, keyId: 66 }, entries: [{ id: 'key-77', slot: 3, keyId: 77 }] },
    { id: 'unmarked', policy: { locked: true, keyId: 11, code: 'LOCKED' }, entries: [{ id: 'key-88', slot: 3, keyId: 88 }] },
    { id: 'jammed', policy: { locked: true, keyId: 11, code: 'UNSUPPORTED_CONTAINER' }, entries: [{ id: 'key-99', slot: 3, keyId: 99 }] },
  ])
  const ownership = fixture.create()
  for (const id of ['seed', 'chain-a', 'chain-b']) assert.equal(ownership.owners.get(id).usableContainer, true, id)
  for (const id of ['cycle-a', 'cycle-b', 'self', 'wrong', 'unmarked', 'jammed']) assert.equal(ownership.owners.get(id).usableContainer, false, id)
  assert.equal(ownership.canEverUseKey(22), true)
  for (const keyId of [33, 44, 55, 66, 77, 88, 99]) assert.equal(ownership.canEverUseKey(keyId), false, String(keyId))
  assert.equal(ownership.take(fixture.owners.get('chain-a'), 'key-22').code, 'LOCKED')
  assert.ok(ownership.take(fixture.owners.get('seed'), 'key-11').result)
  assert.ok(ownership.take(fixture.owners.get('chain-a'), 'key-22').result)
  assert.ok(ownership.take(fixture.owners.get('chain-b'), 'prize').result)
  assert.equal(ownership.items.get('prize').entity.item.parent, '16086.json')
  const saved = ownership.checkpointStates()
  for (const blockedId of ['key-33', 'key-55', 'key-88', 'key-99']) {
    const tamper = structuredClone(saved)
    const source = tamper.owners.find(owner => owner.items.some(entry => entry.id === blockedId))
    const entry = source.items.splice(source.items.findIndex(entry => entry.id === blockedId), 1)[0]
    source.inventoryIndex--
    const actor = tamper.owners.find(owner => owner.id === '16086.json')
    actor.items.push({ id: entry.id, slot: 10 }); actor.inventoryIndex++
    tamper.items.find(item => item.id === entry.id).parent = actor.id
    assert.throws(() => ownership.validateCheckpoint(tamper), /Immovable item changed/)
  }
  assert.deepEqual(ownership.checkpointStates(), saved)
})

test('an initially held master key seeds closure, while malformed keys and unknown actor inventory cannot bootstrap it', () => {
  for (const [keyId, supported] of [[1, true], [11, true], [0, false], ['11', false], [99, false]]) {
    const fixture = closureFixture([{ id: 'box', policy: { locked: true, keyId: 11 }, entries: [{ id: 'prize', slot: 3 }] }],
      [{ id: 'held-key', slot: 7, keyId }])
    const ownership = fixture.create()
    assert.equal(ownership.owners.get('box').usableContainer, supported, String(keyId))
    assert.equal(ownership.items.get('prize').movable, supported)
  }
  const fixture = closureFixture([
    { id: 'seed', entries: [{ id: 'key', slot: 3, keyId: 11 }] },
    { id: 'locked', policy: { locked: true, keyId: 11 }, entries: [{ id: 'prize', slot: 3 }] },
  ])
  delete fixture.actor.critter.inventory
  const ownership = fixture.create()
  assert.equal(ownership.owners.get('locked').usableContainer, false)
  assert.equal(ownership.items.get('key').movable, false)
  assert.equal(ownership.items.get('prize').movable, false)
})

test('transfer access is checked again immediately before commit without recursively depending on possession for content validation', () => {
  const fixture = closureFixture([{ id: 'seed', entries: [{ id: 'key', slot: 3, keyId: 11 }] },
    { id: 'locked', policy: { locked: true, keyId: 11 }, entries: [{ id: 'prize', slot: 3 }] }])
  const ownership = fixture.create()
  ownership.take(fixture.owners.get('seed'), 'key')
  const before = ownership.checkpointStates()
  let checks = 0
  ownership.canAccessContainer = () => ++checks === 1 ? {} : { code: 'LOCKED', message: 'Access changed' }
  assert.equal(ownership.take(fixture.owners.get('locked'), 'prize').code, 'LOCKED')
  assert.equal(checks, 2)
  assert.deepEqual(ownership.checkpointStates(), before)
})
