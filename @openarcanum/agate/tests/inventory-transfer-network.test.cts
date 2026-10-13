const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const { before, test } = require('node:test') as typeof import('node:test')
const fs = require('node:fs/promises') as typeof import('node:fs/promises')
const os = require('node:os') as typeof import('node:os')
const path = require('node:path') as typeof import('node:path')
const Module = require('node:module') as typeof import('node:module')
const { io } = require('socket.io-client') as typeof import('socket.io-client')

const root = path.resolve(__dirname, '../../..')
const source = path.join(root, '@openarcanum/agate/src')
const workshop = path.join(root, 'examples/inventory-workshop/data')
const { MAP_ID, BOX_ID, TOKEN_ID, DOOR_ID, TOKEN_LABEL, KEY_BOX_ID, KEY_ID,
  LOCKED_DOOR_ID, LOCK_KEY_ID, LOCKED_BOX_ID, PRIZE_ID, PRIZE_LABEL } = require('../../../examples/inventory-workshop/generate.cts')
const OWNER_ID = '16086.json'
const itemRow = (slot, id = TOKEN_ID) => ({ id, slot, label: TOKEN_LABEL, type: 'Generic', prototypeId: 900003 })
const keyRow = slot => ({ id: KEY_ID, slot, label: 'Key', type: 'Key', prototypeId: 900005 })
const prizeRow = slot => ({ id: PRIZE_ID, slot, label: PRIZE_LABEL, type: 'Generic', prototypeId: 900006 })
let createAuthorityServer

before(async () => {
  const { build } = await import('esbuild')
  const result = await build({
    absWorkingDir: root,
    stdin: { contents: "export { createAuthorityServer } from './server/authority/AuthorityServer.ts';",
      resolveDir: source, sourcefile: 'inventory-transfer-network-test-entry.js' },
    bundle: true, platform: 'node', format: 'cjs', target: 'node24', write: false,
    external: ['electron', 'workerpool'], loader: { '.glsl': 'text' },
  })
  const compiled = new Module(path.join(__dirname, 'inventory-transfer-network-test-bundle.cjs'), module)
  compiled.filename = path.join(__dirname, 'inventory-transfer-network-test-bundle.cjs')
  compiled.paths = Module._nodeModulePaths(root)
  compiled._compile(result.outputFiles[0].text, compiled.filename)
  createAuthorityServer = compiled.exports.createAuthorityServer
})

async function setup(t: import("node:test").TestContext, mutate?) {
  const dataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'agate-inventory-transfer-network-'))
  await fs.cp(workshop, dataPath, { recursive: true })
  if (mutate) await mutate(dataPath)
  const servers = [], clients = []
  t.after(async () => {
    for (const client of clients) client.socket.disconnect()
    for (const server of servers.reverse()) await server.stop()
    await fs.rm(dataPath, { recursive: true, force: true })
  })
  async function start() {
    const server = createAuthorityServer({ dataPath, mapId: MAP_ID, tickMs: 20 })
    servers.push(server)
    const session = await server.start()
    async function connect(role = 'owner') {
      const socket = io(session.url, { auth: { version: 1, token: role === 'owner' ? session.ownerToken : session.observerToken },
        transports: ['websocket'], autoConnect: false, reconnection: false, forceNew: true, timeout: 2000 })
      const client = { socket, snapshots: [] }
      clients.push(client)
      socket.on('authority:snapshot', snapshot => client.snapshots.push(snapshot))
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', resolve); socket.once('connect_error', reject); socket.connect()
      })
      return client
    }
    return { server, session, connect }
  }
  return { dataPath, start, ...(await start()) }
}

function join(client) { return client.socket.timeout(3000).emitWithAck('authority:join', { version: 1 }) }
function command(client, id, type, data = {}) {
  return client.socket.timeout(3000).emitWithAck('authority:command', { version: 1, id, actorId: '0', type, ...data })
}
function take(client, id, revision, changes = {}) {
  return command(client, id, 'take', { targetId: BOX_ID, itemId: TOKEN_ID, expectedRevision: revision, ...changes })
}
function put(client, id, revision, changes = {}) {
  return command(client, id, 'put', { targetId: BOX_ID, itemId: TOKEN_ID, expectedRevision: revision, ...changes })
}
function takeAll(client, id, revision, changes = {}) {
  return command(client, id, 'take-all', { targetId: BOX_ID, expectedRevision: revision, ...changes })
}
function rejection(response, code: string, id?: number) {
  assert.equal(response.ok, false)
  assert.equal(response.version, 1)
  assert.equal(response.code, code)
  if (id !== undefined) assert.equal(response.id, id)
  assert.ok(Number.isSafeInteger(response.revision))
  assert.equal(typeof response.message, 'string')
}
function actor(snapshot) { return snapshot.actors.find(value => value.id === '0') }
function assertPrivate(snapshot) {
  const value = JSON.stringify(snapshot)
  assert.equal(value.includes(TOKEN_ID), false, 'a public snapshot must never expose the item identity')
  assert.equal(value.includes(KEY_ID), false, 'a public snapshot must never expose the held key identity')
  assert.equal(value.includes(PRIZE_ID), false, 'a public snapshot must never expose the locked container item identity')
  assert.equal(value.includes(TOKEN_LABEL), false, 'a public snapshot must never expose a private item name')
  assert.equal(value.includes(PRIZE_LABEL), false, 'a public snapshot must never expose a locked container item name')
  for (const key of ['items', 'inventory', 'ownership', 'parent', 'quantity', 'itemId', 'itemIds', 'keyId', 'keyID'] as const) {
    assert.equal(value.includes(`"${key}":`), false, `public state exposed ${key}`)
  }
  const hasKeyNumber = value => value === LOCK_KEY_ID || (value && typeof value === 'object' && Object.values(value).some(hasKeyNumber))
  assert.equal(hasKeyNumber(snapshot), false, 'a public snapshot must never expose the matching key number')
}
async function snapshotWhere(client, predicate, timeout = 4000) {
  const found = client.snapshots.find(predicate)
  if (found) return found
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error('Expected committed inventory snapshot did not arrive')) }, timeout)
    const cleanup = () => { clearTimeout(timer); client.socket.off('authority:snapshot', receive) }
    const receive = snapshot => { if (predicate(snapshot)) { cleanup(); resolve(snapshot) } }
    client.socket.on('authority:snapshot', receive)
  })
}
async function approachAndInspect(owner, firstId = 1, items = [itemRow(3)]) {
  const accepted = await command(owner, firstId, 'use', { targetId: BOX_ID })
  assert.equal(accepted.ok, true)
  if (accepted.status === 'accepted') await snapshotWhere(owner, snapshot =>
    actor(snapshot).lastCommand?.id === firstId && actor(snapshot).lastCommand.status === 'completed')
  const inspected = await command(owner, firstId + 1, 'inspect', { targetId: BOX_ID })
  assert.equal(inspected.ok, true)
  assert.deepEqual(inspected.result, { kind: 'container', targetId: BOX_ID, items })
  return inspected
}
async function completedCommand(client, id, type, data) {
  const response = await command(client, id, type, data)
  assert.equal(response.ok, true, response.message)
  if (response.status !== 'accepted') return response
  const committed = await snapshotWhere(client, snapshot =>
    actor(snapshot).lastCommand?.id === id && !actor(snapshot).movement, 15000)
  assert.equal(actor(committed).lastCommand.status, 'completed', actor(committed).lastCommand.message)
  return { ...response, status: 'completed', result: actor(committed).lastCommand.result, revision: committed.revision }
}
async function inspectKeyBox(client, firstId, items = [keyRow(3)]) {
  await completedCommand(client, firstId, 'use', { targetId: KEY_BOX_ID })
  const inspected = await command(client, firstId + 1, 'inspect', { targetId: KEY_BOX_ID })
  assert.equal(inspected.ok, true, inspected.message)
  assert.deepEqual(inspected.result, { kind: 'container', targetId: KEY_BOX_ID, items })
  return inspected
}
function liveOwnership(server) {
  const item = [...server.map.entityManager.entities.values()].find(entity => entity.sourcePath === TOKEN_ID)
  const box = server.containers.states.get(BOX_ID).entity
  return { item, box, snapshot: {
    box: structuredClone(box.container.inventory), boxCount: box.container.inventoryIndex,
    actor: structuredClone(server.player.critter.inventory), actorCount: server.player.critter.inventoryIndex,
    parent: item.item.parent, itemLocation: item.item.invLocation,
  } }
}
async function addSecondOwnedItem(directory, { slot = 4, prototype = 900003 } = {}) {
  // An existing owned archive entry keeps startup catalog enumeration intact;
  // its loose JSON override defines this fixture's second unique item.
  await fs.writeFile(path.join(directory, DOOR_ID), JSON.stringify({
    Base: { prototype, location: [6, 4] }, Item: { parent: BOX_ID, invLocation: 9 },
  }))
  const filename = path.join(directory, BOX_ID)
  const box = JSON.parse(await fs.readFile(filename, 'utf8'))
  box.Container.inventory.push({ id: DOOR_ID, slot })
  box.Container.inventoryIndex = 2
  await fs.writeFile(filename, JSON.stringify(box))
}
function assertBothItemsPrivate(snapshot) {
  assertPrivate(snapshot)
  assert.equal(JSON.stringify(snapshot).includes(DOOR_ID), false, 'the second item identity remains private')
}

test('socket transfer commits one whole item with private owner views and a public summary', { timeout: 10000 }, async t => {
  const context = await setup(t)
  const owner = await context.connect(), observer = await context.connect('observer')
  await join(owner)
  assertPrivate((await join(observer)).snapshot)
  const itemBefore = await fs.readFile(path.join(context.dataPath, TOKEN_ID))
  const inspected = await approachAndInspect(owner)
  const revision = context.server.revision
  const publicBefore = actor(context.server.getSnapshot()).lastCommand
  const inventory = await command(owner, 3, 'inventory')
  assert.equal(inventory.ok, true)
  assert.deepEqual(inventory.result, { kind: 'inventory', ownerId: OWNER_ID, items: [] })
  assert.equal(inventory.revision, inspected.revision)
  assert.equal(context.server.revision, revision, 'a private inventory read does not publish')
  assert.deepEqual(actor(context.server.getSnapshot()).lastCommand, publicBefore)
  const taken = await take(owner, 4, inspected.revision)
  assert.equal(taken.ok, true)
  assert.equal(taken.status, 'completed')
  assert.deepEqual(taken.result, { kind: 'take', targetId: BOX_ID, itemId: TOKEN_ID, items: [],
    inventory: { ownerId: OWNER_ID, items: [itemRow(0)] } })
  const committed = await snapshotWhere(observer, snapshot => snapshot.revision === taken.revision)
  assert.deepEqual(await snapshotWhere(owner, snapshot => snapshot.revision === taken.revision), committed)
  assert.deepEqual(actor(committed).lastCommand, { id: 4, type: 'take', targetId: BOX_ID,
    status: 'completed', result: { kind: 'take', targetId: BOX_ID } })
  assertPrivate(committed)
  assert.deepEqual(liveOwnership(context.server).snapshot, { box: [], boxCount: 0,
    actor: [{ id: TOKEN_ID, slot: 0 }], actorCount: 1, parent: OWNER_ID, itemLocation: 7 })
  assert.deepEqual((await command(owner, 5, 'inventory')).result,
    { kind: 'inventory', ownerId: OWNER_ID, items: [itemRow(0)] })
  assert.deepEqual((await command(owner, 6, 'inspect', { targetId: BOX_ID })).result,
    { kind: 'container', targetId: BOX_ID, items: [] })
  rejection(await take(owner, 4, inspected.revision), 'REPLAYED_COMMAND', 4)
  rejection(await take(owner, 7, inspected.revision), 'STALE_REVISION', 7)
  rejection(await take(owner, 8, context.server.revision), 'UNKNOWN_ITEM', 8)
  for (const snapshot of [...owner.snapshots, ...observer.snapshots, (await join(observer)).snapshot] as const) assertPrivate(snapshot)
  assert.deepEqual(await fs.readFile(path.join(context.dataPath, TOKEN_ID)), itemBefore, 'taking never rewrites module assets')
})

test('two authorized owner sockets racing for the same inspected item have exactly one winner', { timeout: 10000 }, async t => {
  const context = await setup(t)
  const first = await context.connect(), second = await context.connect(), observer = await context.connect('observer')
  await join(first); await join(second); await join(observer)
  const inspected = await approachAndInspect(first)
  const results = await Promise.all([take(first, 3, inspected.revision), take(second, 4, inspected.revision)])
  assert.equal(results.filter(value => value.ok).length, 1)
  const loser = results.find(value => !value.ok)
  assert.ok(['STALE_REVISION', 'REPLAYED_COMMAND'].includes(loser.code), loser.code)
  const winner = results.find(value => value.ok)
  const publicState = await snapshotWhere(observer, snapshot => snapshot.revision === winner.revision)
  assertPrivate(publicState)
  assert.deepEqual(liveOwnership(context.server).snapshot, { box: [], boxCount: 0,
    actor: [{ id: TOKEN_ID, slot: 0 }], actorCount: 1, parent: OWNER_ID, itemLocation: 7 })
  assert.deepEqual((await command(second, 5, 'inventory')).result.items, [itemRow(0)])
  rejection(await take(first, winner.id, winner.revision), 'REPLAYED_COMMAND', winner.id)
  assert.equal(liveOwnership(context.server).snapshot.actor.length, 1)
})

test('take and inventory reject unauthorized, malformed, replayed and out-of-range socket intentions', { timeout: 10000 }, async t => {
  const context = await setup(t)
  const owner = await context.connect(), observer = await context.connect('observer')
  rejection(await take(owner, 1, 1), 'NOT_JOINED', 1)
  const initial = await join(owner); await join(observer)
  rejection(await command(observer, 100, 'inventory'), 'FORBIDDEN', 100)
  rejection(await take(observer, 101, initial.snapshot.revision), 'FORBIDDEN', 101)
  rejection(await take(owner, 1, initial.snapshot.revision, { actorId: 'another' }), 'FORBIDDEN', 1)
  rejection(await take(owner, 1, initial.snapshot.revision, { version: 2 }), 'VERSION_MISMATCH', 1)
  for (const changes of [{ itemId: null }, { itemId: '' }, { itemId: 'x'.repeat(1025) }, { targetId: '' },
    { targetId: null }, { targetId: 'x'.repeat(1025) }, { expectedRevision: -1 }, { expectedRevision: null },
    { expectedRevision: 1.5 }, { expectedRevision: Number.MAX_SAFE_INTEGER + 1 }, { expectedRevision: '1' },
    { parent: OWNER_ID }, { quantity: 1 }, { slot: 0 }, { inventory: [] }, { id: 0 }, { id: '1' }] as const) {
    rejection(await take(owner, 1, initial.snapshot.revision, changes), 'INVALID_COMMAND')
  }
  for (const changes of [{ targetId: BOX_ID }, { itemId: TOKEN_ID }, { expectedRevision: 1 }, { items: [] }] as const) {
    rejection(await command(owner, 1, 'inventory', changes), 'INVALID_COMMAND')
  }
  rejection(await take(owner, 1, initial.snapshot.revision), 'OUT_OF_RANGE', 1)
  const inspected = await approachAndInspect(owner, 2)
  rejection(await take(owner, 4, inspected.revision, { itemId: 'missing-item' }), 'UNKNOWN_ITEM', 4)
  rejection(await take(owner, 5, inspected.revision, { targetId: 'missing-container' }), 'UNKNOWN_TARGET', 5)
  assert.equal((await take(owner, 6, inspected.revision)).ok, true)
  rejection(await command(owner, 6, 'inventory'), 'REPLAYED_COMMAND', 6)
  assert.equal((await join(owner)).nextCommandId, 7)
})

test('private inventory reads can observe an idle paused actor while take remains frozen and checkpoint IO remains exclusive', { timeout: 10000 }, async t => {
  const context = await setup(t)
  const owner = await context.connect()
  await join(owner)
  const inspected = await approachAndInspect(owner)
  assert.equal((await command(owner, 3, 'pause')).ok, true)
  const revision = context.server.revision
  const prior = actor(context.server.getSnapshot()).lastCommand
  assert.deepEqual((await command(owner, 4, 'inventory')).result, { kind: 'inventory', ownerId: OWNER_ID, items: [] })
  assert.equal(context.server.revision, revision)
  assert.deepEqual(actor(context.server.getSnapshot()).lastCommand, prior)
  rejection(await take(owner, 5, inspected.revision), 'PAUSED', 5)
  assert.equal((await command(owner, 6, 'resume')).ok, true)
  const refreshed = await command(owner, 7, 'inspect', { targetId: BOX_ID })
  let release
  const gate = new Promise(resolve => { release = resolve })
  const write = context.server.checkpointStore.write.bind(context.server.checkpointStore)
  context.server.checkpointStore.write = async document => { await gate; return write(document) }
  const saving = command(owner, 8, 'save')
  await snapshotWhere(owner, snapshot => snapshot.checkpoint.busy)
  rejection(await take(owner, 9, refreshed.revision), 'BUSY', 9)
  rejection(await command(owner, 10, 'inventory'), 'BUSY', 10)
  release()
  assert.equal((await saving).ok, true)
  assert.deepEqual(liveOwnership(context.server).snapshot.actor, [])
  const latest = await command(owner, 11, 'inspect', { targetId: BOX_ID })
  assert.equal((await take(owner, 12, latest.revision)).ok, true)
})

test('original-style unknown actor ownership never becomes an inferred empty inventory', { timeout: 10000 }, async t => {
  const context = await setup(t, async directory => {
    const filename = path.join(directory, '16086.json')
    const value = JSON.parse(await fs.readFile(filename, 'utf8'))
    delete value.Critter.inventory
    await fs.writeFile(filename, JSON.stringify(value))
  })
  const owner = await context.connect()
  await join(owner)
  rejection(await command(owner, 1, 'inventory'), 'INVENTORY_UNAVAILABLE', 1)
  const inspected = await approachAndInspect(owner, 2)
  rejection(await take(owner, 4, inspected.revision), 'INVENTORY_UNAVAILABLE', 4)
  rejection(await takeAll(owner, 5, inspected.revision), 'INVENTORY_UNAVAILABLE', 5)
  assert.equal(Object.hasOwn(context.server.player.critter, 'inventory'), false)
  assert.equal(liveOwnership(context.server).item.item.parent, BOX_ID)
})

test('unsupported item families and locked containers cannot be bypassed through take', { timeout: 12000 }, async t => {
  await t.test('whole gold stack remains outside the generic transfer subset', async t => {
    const context = await setup(t, async directory => {
      const filename = path.join(directory, 'Prototypes/Generic/900003.json')
      const value = JSON.parse(await fs.readFile(filename, 'utf8'))
      value.Base.type = 'Gold'; value.Gold = { quantity: 62 }
      await fs.writeFile(filename, JSON.stringify(value))
    })
    const owner = await context.connect()
    await join(owner)
    const accepted = await command(owner, 1, 'use', { targetId: BOX_ID })
    assert.equal(accepted.ok, true)
    await snapshotWhere(owner, snapshot => actor(snapshot).lastCommand?.id === 1 && !actor(snapshot).movement)
    const inspected = await command(owner, 2, 'inspect', { targetId: BOX_ID })
    assert.equal(inspected.result.items[0].type, 'Gold')
    assert.equal(inspected.result.items[0].quantity, 62)
    rejection(await take(owner, 3, inspected.revision), 'UNSUPPORTED_ITEM', 3)
    assert.equal(liveOwnership(context.server).item.item.parent, BOX_ID)
  })
  await t.test('locked container retains all original ownership', async t => {
    const context = await setup(t, async directory => {
      const filename = path.join(directory, BOX_ID)
      const value = JSON.parse(await fs.readFile(filename, 'utf8'))
      value.Container.flags = ['Locked']
      await fs.writeFile(filename, JSON.stringify(value))
    })
    const owner = await context.connect()
    const joined = await join(owner)
    rejection(await take(owner, 1, joined.snapshot.revision), 'LOCKED', 1)
    assert.equal(liveOwnership(context.server).item.item.parent, BOX_ID)
    assert.deepEqual(context.server.player.critter.inventory, [])
  })
})

test('a fresh host restores the transferred identity and reciprocal ownership without duplicating it', { timeout: 12000 }, async t => {
  const context = await setup(t)
  const owner = await context.connect(), observer = await context.connect('observer')
  await join(owner); await join(observer)
  const inspected = await approachAndInspect(owner)
  assert.equal((await take(owner, 3, inspected.revision)).ok, true)
  assert.equal((await command(owner, 4, 'save')).ok, true)
  const filename = path.join(context.dataPath, 'saves/local-checkpoint.json')
  const document = JSON.parse(await fs.readFile(filename, 'utf8'))
  assert.equal(document.version, 6)
  assert.ok(JSON.stringify(document).includes(TOKEN_ID), 'versioned checkpoint persists the unique item')
  assert.ok(JSON.stringify(document).includes(OWNER_ID), 'checkpoint persists its current owner')
  await context.server.stop()
  const restarted = await context.start()
  const newOwner = await restarted.connect(), newObserver = await restarted.connect('observer')
  const initial = await join(newOwner); await join(newObserver)
  assert.deepEqual(actor(initial.snapshot).location, [4, 4], 'fresh startup does not auto-load')
  assert.deepEqual((await command(newOwner, 1, 'inventory')).result.items, [])
  assert.equal(liveOwnership(restarted.server).item.item.parent, BOX_ID)
  const loaded = await command(newOwner, 2, 'load')
  assert.equal(loaded.ok, true)
  const restored = await snapshotWhere(newObserver, snapshot => snapshot.revision === loaded.revision)
  assertPrivate(restored)
  assert.deepEqual(actor(restored).location, [5, 4])
  assert.deepEqual(liveOwnership(restarted.server).snapshot, { box: [], boxCount: 0,
    actor: [{ id: TOKEN_ID, slot: 0 }], actorCount: 1, parent: OWNER_ID, itemLocation: 7 })
  assert.deepEqual((await command(newOwner, 3, 'inventory')).result.items, [itemRow(0)])
  assert.deepEqual((await command(newOwner, 4, 'inspect', { targetId: BOX_ID })).result.items, [])
  assert.equal((await command(newOwner, 5, 'load')).ok, true)
  assert.deepEqual((await command(newOwner, 6, 'inventory')).result.items, [itemRow(0)])
  rejection(await take(newOwner, 7, restarted.server.revision), 'UNKNOWN_ITEM', 7)
  for (const snapshot of [...newOwner.snapshots, ...newObserver.snapshots, (await join(newObserver)).snapshot] as const) assertPrivate(snapshot)
})

test('socket take-put-take roundtrip preserves one identity and exposes put contents only in its private acknowledgement', { timeout: 10000 }, async t => {
  const context = await setup(t)
  const owner = await context.connect(), observer = await context.connect('observer')
  await join(owner); await join(observer)
  const initialFile = await fs.readFile(path.join(context.dataPath, TOKEN_ID))
  const inspected = await approachAndInspect(owner)
  const item = liveOwnership(context.server).item
  const taken = await take(owner, 3, inspected.revision)
  assert.equal(taken.ok, true)
  const returned = await put(owner, 4, taken.revision)
  assert.equal(returned.ok, true)
  assert.equal(returned.status, 'completed')
  assert.deepEqual(returned.result, { kind: 'put', targetId: BOX_ID, itemId: TOKEN_ID, items: [itemRow(0)],
    inventory: { ownerId: OWNER_ID, items: [] } })
  const committed = await snapshotWhere(observer, snapshot => snapshot.revision === returned.revision)
  assert.deepEqual(actor(committed).lastCommand, { id: 4, type: 'put', targetId: BOX_ID,
    status: 'completed', result: { kind: 'put', targetId: BOX_ID } })
  assertPrivate(committed)
  assert.deepEqual(liveOwnership(context.server).snapshot, { box: [{ id: TOKEN_ID, slot: 0 }], boxCount: 1,
    actor: [], actorCount: 0, parent: BOX_ID, itemLocation: 7 })
  const inventory = await command(owner, 5, 'inventory')
  assert.equal(inventory.revision, returned.revision)
  assert.deepEqual(inventory.result, { kind: 'inventory', ownerId: OWNER_ID, items: [] })
  const reinspection = await command(owner, 6, 'inspect', { targetId: BOX_ID })
  assert.deepEqual(reinspection.result.items, [itemRow(0)])
  const retaken = await take(owner, 7, reinspection.revision)
  assert.equal(retaken.ok, true)
  assert.deepEqual(retaken.result.inventory.items, [itemRow(0)])
  assert.equal(liveOwnership(context.server).item, item, 'roundtrip moves the same instance rather than recreating it')
  assert.equal([...context.server.map.entityManager.entities.values()].filter(entity => entity.sourcePath === TOKEN_ID).length, 1)
  assert.deepEqual(liveOwnership(context.server).snapshot, { box: [], boxCount: 0,
    actor: [{ id: TOKEN_ID, slot: 0 }], actorCount: 1, parent: OWNER_ID, itemLocation: 7 })
  for (const snapshot of [...owner.snapshots, ...observer.snapshots, (await join(observer)).snapshot] as const) assertPrivate(snapshot)
  assert.deepEqual(await fs.readFile(path.join(context.dataPath, TOKEN_ID)), initialFile, 'put never rewrites module assets')
})

test('two authorized owner sockets racing to put the same item have exactly one winner', { timeout: 10000 }, async t => {
  const context = await setup(t)
  const first = await context.connect(), second = await context.connect(), observer = await context.connect('observer')
  await join(first); await join(second); await join(observer)
  const inspected = await approachAndInspect(first)
  const taken = await take(first, 3, inspected.revision)
  assert.equal(taken.ok, true)
  const results = await Promise.all([put(first, 4, taken.revision), put(second, 5, taken.revision)])
  assert.equal(results.filter(value => value.ok).length, 1)
  const loser = results.find(value => !value.ok), winner = results.find(value => value.ok)
  assert.ok(['STALE_REVISION', 'REPLAYED_COMMAND'].includes(loser.code), loser.code)
  assert.deepEqual(winner.result.items, [itemRow(0)])
  assert.deepEqual(winner.result.inventory, { ownerId: OWNER_ID, items: [] })
  assertPrivate(await snapshotWhere(observer, snapshot => snapshot.revision === winner.revision))
  assert.deepEqual((await command(second, 6, 'inventory')).result.items, [])
  rejection(await put(first, winner.id, winner.revision), 'REPLAYED_COMMAND', winner.id)
  assert.deepEqual(liveOwnership(context.server).snapshot, { box: [{ id: TOKEN_ID, slot: 0 }], boxCount: 1,
    actor: [], actorCount: 0, parent: BOX_ID, itemLocation: 7 })
})

test('put socket intentions enforce schema, authority, revision, access, pause, movement and checkpoint guards', { timeout: 15000 }, async t => {
  const context = await setup(t)
  const owner = await context.connect(), observer = await context.connect('observer')
  rejection(await put(owner, 1, 1), 'NOT_JOINED', 1)
  const initial = await join(owner); await join(observer)
  rejection(await put(observer, 100, initial.snapshot.revision), 'FORBIDDEN', 100)
  rejection(await put(owner, 1, initial.snapshot.revision, { actorId: 'another' }), 'FORBIDDEN', 1)
  rejection(await put(owner, 1, initial.snapshot.revision, { version: 2 }), 'VERSION_MISMATCH', 1)
  for (const changes of [{ itemId: null }, { itemId: '' }, { itemId: 'x'.repeat(1025) }, { targetId: '' },
    { targetId: null }, { targetId: 'x'.repeat(1025) }, { expectedRevision: -1 }, { expectedRevision: null },
    { expectedRevision: 1.5 }, { expectedRevision: Number.MAX_SAFE_INTEGER + 1 }, { expectedRevision: '1' },
    { parent: BOX_ID }, { quantity: 1 }, { slot: 0 }, { inventory: [] }, { id: 0 }, { id: '1' }] as const) {
    rejection(await put(owner, 1, initial.snapshot.revision, changes), 'INVALID_COMMAND')
  }
  const inspected = await approachAndInspect(owner)
  const taken = await take(owner, 3, inspected.revision)
  assert.equal(taken.ok, true)
  rejection(await put(owner, 4, taken.revision, { itemId: 'missing-item' }), 'UNKNOWN_ITEM', 4)
  rejection(await put(owner, 5, taken.revision, { targetId: 'missing-container' }), 'UNKNOWN_TARGET', 5)
  rejection(await put(owner, 6, inspected.revision), 'STALE_REVISION', 6)
  const flags = context.server.containers.states.get(BOX_ID).entity.container.flags
  flags.set(['Locked'])
  rejection(await put(owner, 7, taken.revision), 'LOCKED', 7)
  flags.set(['NeverLocked'])
  assert.equal((await command(owner, 8, 'pause')).ok, true)
  rejection(await put(owner, 9, context.server.revision), 'PAUSED', 9)
  assert.equal((await command(owner, 10, 'resume')).ok, true)
  const moving = await command(owner, 11, 'move', { target: [4, 4] })
  assert.equal(moving.ok, true)
  assert.equal(moving.status, 'accepted')
  rejection(await put(owner, 12, context.server.revision), 'BUSY', 12)
  await snapshotWhere(owner, snapshot => actor(snapshot).lastCommand?.id === 11 && !actor(snapshot).movement)
  rejection(await put(owner, 13, context.server.revision), 'OUT_OF_RANGE', 13)
  const refreshed = await approachAndInspect(owner, 14, [])
  let release
  const gate = new Promise(resolve => { release = resolve })
  const write = context.server.checkpointStore.write.bind(context.server.checkpointStore)
  context.server.checkpointStore.write = async document => { await gate; return write(document) }
  const saving = command(owner, 16, 'save')
  await snapshotWhere(owner, snapshot => snapshot.checkpoint.busy)
  rejection(await put(owner, 17, refreshed.revision), 'BUSY', 17)
  release()
  assert.equal((await saving).ok, true)
  assert.deepEqual(liveOwnership(context.server).snapshot.actor, [{ id: TOKEN_ID, slot: 0 }])
  rejection(await put(owner, 18, refreshed.revision), 'STALE_REVISION', 18)
  const current = await command(owner, 19, 'inspect', { targetId: BOX_ID })
  assert.equal((await put(owner, 20, current.revision)).ok, true)
  rejection(await put(owner, 20, current.revision), 'REPLAYED_COMMAND', 20)
  rejection(await put(owner, 21, context.server.revision), 'UNKNOWN_ITEM', 21)
  for (const snapshot of [...owner.snapshots, ...observer.snapshots] as const) assertPrivate(snapshot)
})

test('a fresh host restores a saved put with an actor sparse hole and permits further transfers', { timeout: 15000 }, async t => {
  const context = await setup(t, addSecondOwnedItem)
  const owner = await context.connect(), observer = await context.connect('observer')
  await join(owner); await join(observer)
  const inspected = await approachAndInspect(owner, 1, [itemRow(3), itemRow(4, DOOR_ID)])
  const first = await take(owner, 3, inspected.revision)
  assert.equal(first.ok, true)
  const second = await take(owner, 4, first.revision, { itemId: DOOR_ID })
  assert.equal(second.ok, true)
  assert.deepEqual(second.result.inventory.items, [itemRow(0), itemRow(1, DOOR_ID)])
  const returned = await put(owner, 5, second.revision)
  assert.equal(returned.ok, true)
  assert.deepEqual(returned.result, { kind: 'put', targetId: BOX_ID, itemId: TOKEN_ID, items: [itemRow(0)],
    inventory: { ownerId: OWNER_ID, items: [itemRow(1, DOOR_ID)] } })
  assert.equal((await command(owner, 6, 'save')).ok, true)
  const saved = JSON.parse(await fs.readFile(path.join(context.dataPath, 'saves/local-checkpoint.json'), 'utf8'))
  assert.equal(saved.version, 6)
  assert.deepEqual(saved.ownership.owners.find(value => value.id === OWNER_ID).items, [{ id: DOOR_ID, slot: 1 }])
  assert.deepEqual(saved.ownership.owners.find(value => value.id === BOX_ID).items, [{ id: TOKEN_ID, slot: 0 }])
  await context.server.stop()
  const restarted = await context.start()
  const newOwner = await restarted.connect(), newObserver = await restarted.connect('observer')
  await join(newOwner); await join(newObserver)
  assert.deepEqual((await command(newOwner, 1, 'inventory')).result.items, [])
  const loaded = await command(newOwner, 2, 'load')
  assert.equal(loaded.ok, true)
  const publicState = await snapshotWhere(newObserver, snapshot => snapshot.revision === loaded.revision)
  assertPrivate(publicState)
  assert.equal(JSON.stringify(publicState).includes(DOOR_ID), false, 'the second item identity remains private')
  assert.deepEqual((await command(newOwner, 3, 'inventory')).result.items, [itemRow(1, DOOR_ID)])
  const reinspection = await command(newOwner, 4, 'inspect', { targetId: BOX_ID })
  assert.deepEqual(reinspection.result.items, [itemRow(0)])
  const retaken = await take(newOwner, 5, reinspection.revision)
  assert.equal(retaken.ok, true)
  assert.deepEqual(retaken.result.inventory.items, [itemRow(0), itemRow(1, DOOR_ID)])
  const otherReturned = await put(newOwner, 6, retaken.revision, { itemId: DOOR_ID })
  assert.equal(otherReturned.ok, true)
  assert.deepEqual(otherReturned.result.items, [itemRow(0, DOOR_ID)])
  assert.deepEqual(otherReturned.result.inventory.items, [itemRow(0)])
  const other = [...restarted.server.map.entityManager.entities.values()].find(entity => entity.sourcePath === DOOR_ID)
  assert.equal(other.item.parent, BOX_ID)
  assert.equal(other.item.invLocation, 9)
  assert.equal([...restarted.server.map.entityManager.entities.values()].filter(entity => entity.sourcePath === DOOR_ID).length, 1)
  for (const snapshot of [...newOwner.snapshots, ...newObserver.snapshots, (await join(newObserver)).snapshot] as const) {
    assertPrivate(snapshot)
    assert.equal(JSON.stringify(snapshot).includes(DOOR_ID), false)
  }
})

test('take-all commits the server-ordered whole set privately in one revision and restores both identities after restart', { timeout: 15000 }, async t => {
  const context = await setup(t, directory => addSecondOwnedItem(directory, { slot: 1 }))
  const owner = await context.connect(), observer = await context.connect('observer')
  await join(owner); await join(observer)
  const inspected = await approachAndInspect(owner, 1, [itemRow(1, DOOR_ID), itemRow(3)])
  const first = context.server.ownership.items.get(DOOR_ID).entity
  const second = context.server.ownership.items.get(TOKEN_ID).entity
  const taken = await takeAll(owner, 3, inspected.revision)
  assert.equal(taken.ok, true)
  assert.equal(taken.status, 'completed')
  assert.equal(taken.revision, inspected.revision + 1, 'the entire batch publishes exactly once')
  assert.deepEqual(taken.result, { kind: 'take-all', targetId: BOX_ID, itemIds: [DOOR_ID, TOKEN_ID], items: [],
    inventory: { ownerId: OWNER_ID, items: [itemRow(0, DOOR_ID), itemRow(1)] } })
  const publicState = await snapshotWhere(observer, snapshot => snapshot.revision === taken.revision)
  assert.deepEqual(actor(publicState).lastCommand, { id: 3, type: 'take-all', targetId: BOX_ID,
    status: 'completed', result: { kind: 'take-all', targetId: BOX_ID } })
  assertBothItemsPrivate(publicState)
  assert.equal(context.server.containers.states.get(BOX_ID).entity.container.inventoryIndex, 0)
  assert.equal(context.server.player.critter.inventoryIndex, 2)
  assert.equal(first.item.parent, OWNER_ID)
  assert.equal(second.item.parent, OWNER_ID)
  assert.equal(first.item.invLocation, 9)
  assert.equal(second.item.invLocation, 7)
  assert.equal(context.server.ownership.items.get(DOOR_ID).entity, first)
  assert.equal(context.server.ownership.items.get(TOKEN_ID).entity, second)
  assert.equal((await command(owner, 4, 'save')).ok, true)
  const saved = JSON.parse(await fs.readFile(path.join(context.dataPath, 'saves/local-checkpoint.json'), 'utf8'))
  assert.equal(saved.version, 6)
  assert.equal(saved.rulesVersion, 'movement-doors-ownership-attributes-v9')
  assert.deepEqual(saved.ownership.owners.find(value => value.id === OWNER_ID).items,
    [{ id: DOOR_ID, slot: 0 }, { id: TOKEN_ID, slot: 1 }])
  await context.server.stop()
  const restarted = await context.start()
  const newOwner = await restarted.connect(), newObserver = await restarted.connect('observer')
  await join(newOwner); await join(newObserver)
  assert.deepEqual((await command(newOwner, 1, 'inventory')).result.items, [])
  const loaded = await command(newOwner, 2, 'load')
  assert.equal(loaded.ok, true)
  assertBothItemsPrivate(await snapshotWhere(newObserver, snapshot => snapshot.revision === loaded.revision))
  assert.deepEqual((await command(newOwner, 3, 'inventory')).result.items, [itemRow(0, DOOR_ID), itemRow(1)])
  const empty = await command(newOwner, 4, 'inspect', { targetId: BOX_ID })
  assert.deepEqual(empty.result.items, [])
  rejection(await takeAll(newOwner, 5, empty.revision), 'EMPTY_CONTAINER', 5)
  const records = [...restarted.server.map.entityManager.entities.values()]
  for (const id of [TOKEN_ID, DOOR_ID] as const) {
    assert.equal(records.filter(entity => entity.sourcePath === id).length, 1)
    assert.equal(records.find(entity => entity.sourcePath === id).item.parent, OWNER_ID)
  }
  for (const snapshot of [...owner.snapshots, ...observer.snapshots, ...newOwner.snapshots, ...newObserver.snapshots,
    (await join(newObserver)).snapshot] as const) assertBothItemsPrivate(snapshot)
})

test('racing take-all against a single take has one winner and never duplicates or drops either item', { timeout: 10000 }, async t => {
  const context = await setup(t, addSecondOwnedItem)
  const batchOwner = await context.connect(), singleOwner = await context.connect(), observer = await context.connect('observer')
  await join(batchOwner); await join(singleOwner); await join(observer)
  const inspected = await approachAndInspect(batchOwner, 1, [itemRow(3), itemRow(4, DOOR_ID)])
  const results = await Promise.all([takeAll(batchOwner, 3, inspected.revision), take(singleOwner, 4, inspected.revision)])
  assert.equal(results.filter(value => value.ok).length, 1)
  const winner = results.find(value => value.ok), loser = results.find(value => !value.ok)
  assert.ok(['STALE_REVISION', 'REPLAYED_COMMAND'].includes(loser.code), loser.code)
  assert.equal(winner.revision, inspected.revision + 1)
  const box = context.server.containers.states.get(BOX_ID).entity.container
  const actorInventory = context.server.player.critter.inventory
  const ownedIds = [...box.inventory, ...actorInventory].map(entry => entry.id)
  assert.deepEqual([...new Set(ownedIds)].sort(), [TOKEN_ID, DOOR_ID].sort())
  assert.equal(ownedIds.length, 2)
  if (winner.result.kind === 'take-all') {
    assert.deepEqual(winner.result.itemIds, [TOKEN_ID, DOOR_ID])
    assert.deepEqual(box.inventory, [])
    assert.deepEqual(actorInventory, [{ id: TOKEN_ID, slot: 0 }, { id: DOOR_ID, slot: 1 }])
  } else {
    assert.equal(winner.result.kind, 'take')
    assert.deepEqual(box.inventory, [{ id: DOOR_ID, slot: 4 }])
    assert.deepEqual(actorInventory, [{ id: TOKEN_ID, slot: 0 }])
  }
  assertBothItemsPrivate(await snapshotWhere(observer, snapshot => snapshot.revision === winner.revision))
  rejection(await takeAll(batchOwner, winner.id, winner.revision), 'REPLAYED_COMMAND', winner.id)
  await command(batchOwner, 5, 'inventory')
  const current = await command(batchOwner, 6, 'inspect', { targetId: BOX_ID })
  const remainder = await takeAll(batchOwner, 7, current.revision)
  if (winner.result.kind === 'take-all') rejection(remainder, 'EMPTY_CONTAINER', 7)
  else {
    assert.equal(remainder.ok, true)
    assert.deepEqual(remainder.result.itemIds, [DOOR_ID])
  }
  assert.deepEqual((await command(batchOwner, 8, 'inventory')).result.items, [itemRow(0), itemRow(1, DOOR_ID)])
  assert.equal(context.server.player.critter.inventoryIndex, 2)
  assert.equal(box.inventoryIndex, 0)
  for (const snapshot of [...batchOwner.snapshots, ...singleOwner.snapshots, ...observer.snapshots] as const) assertBothItemsPrivate(snapshot)
})

test('take-all socket intentions enforce exact envelopes, ownership, access, replay and host busy states', { timeout: 15000 }, async t => {
  const context = await setup(t)
  const owner = await context.connect(), observer = await context.connect('observer')
  rejection(await takeAll(owner, 1, 1), 'NOT_JOINED', 1)
  const initial = await join(owner); await join(observer)
  rejection(await takeAll(observer, 100, initial.snapshot.revision), 'FORBIDDEN', 100)
  rejection(await takeAll(owner, 1, initial.snapshot.revision, { actorId: 'another' }), 'FORBIDDEN', 1)
  rejection(await takeAll(owner, 1, initial.snapshot.revision, { version: 2 }), 'VERSION_MISMATCH', 1)
  for (const changes of [{ targetId: '' }, { targetId: null }, { targetId: 'x'.repeat(1025) },
    { expectedRevision: -1 }, { expectedRevision: null }, { expectedRevision: 1.5 },
    { expectedRevision: Number.MAX_SAFE_INTEGER + 1 }, { expectedRevision: '1' },
    { itemId: TOKEN_ID }, { itemIds: [TOKEN_ID] }, { itemIds: [] }, { quantity: 1 }, { slot: 0 },
    { parent: OWNER_ID }, { inventory: [] }, { id: 0 }, { id: '1' }] as const) {
    rejection(await takeAll(owner, 1, initial.snapshot.revision, changes), 'INVALID_COMMAND')
  }
  rejection(await takeAll(owner, 1, initial.snapshot.revision), 'OUT_OF_RANGE', 1)
  const inspected = await approachAndInspect(owner, 2)
  rejection(await takeAll(owner, 4, inspected.revision, { targetId: 'missing-container' }), 'UNKNOWN_TARGET', 4)
  rejection(await takeAll(owner, 5, initial.snapshot.revision), 'STALE_REVISION', 5)
  const flags = context.server.containers.states.get(BOX_ID).entity.container.flags
  flags.set(['Locked'])
  rejection(await takeAll(owner, 6, inspected.revision), 'LOCKED', 6)
  flags.set(['NeverLocked'])
  assert.equal((await command(owner, 7, 'pause')).ok, true)
  rejection(await takeAll(owner, 8, context.server.revision), 'PAUSED', 8)
  assert.equal((await command(owner, 9, 'resume')).ok, true)
  assert.equal((await command(owner, 10, 'move', { target: [4, 4] })).status, 'accepted')
  rejection(await takeAll(owner, 11, context.server.revision), 'BUSY', 11)
  await snapshotWhere(owner, snapshot => actor(snapshot).lastCommand?.id === 10 && !actor(snapshot).movement)
  rejection(await takeAll(owner, 12, context.server.revision), 'OUT_OF_RANGE', 12)
  const refreshed = await approachAndInspect(owner, 13)
  let release
  const gate = new Promise(resolve => { release = resolve })
  const write = context.server.checkpointStore.write.bind(context.server.checkpointStore)
  context.server.checkpointStore.write = async document => { await gate; return write(document) }
  const saving = command(owner, 15, 'save')
  await snapshotWhere(owner, snapshot => snapshot.checkpoint.busy)
  rejection(await takeAll(owner, 16, refreshed.revision), 'BUSY', 16)
  release()
  assert.equal((await saving).ok, true)
  const current = await command(owner, 17, 'inspect', { targetId: BOX_ID })
  const taken = await takeAll(owner, 18, current.revision)
  assert.equal(taken.ok, true)
  assert.deepEqual(taken.result.itemIds, [TOKEN_ID])
  rejection(await takeAll(owner, 18, current.revision), 'REPLAYED_COMMAND', 18)
  rejection(await takeAll(owner, 19, taken.revision), 'EMPTY_CONTAINER', 19)
  assert.deepEqual(context.server.player.critter.inventory, [{ id: TOKEN_ID, slot: 0 }])
  for (const snapshot of [...owner.snapshots, ...observer.snapshots] as const) assertPrivate(snapshot)
})

test('take-all rejects mixed Generic and Gold contents without a partial transfer', { timeout: 10000 }, async t => {
  const context = await setup(t, async directory => {
    const prototype = JSON.parse(await fs.readFile(path.join(directory, 'Prototypes/Generic/900003.json'), 'utf8'))
    prototype.Base.prototype = 900004
    prototype.Base.type = 'Gold'
    delete prototype.Base.descIndex
    prototype.Gold = { quantity: 62 }
    await fs.writeFile(path.join(directory, 'Prototypes/Portal/900004.json'), JSON.stringify(prototype))
    // This prototype is also used by the owned locked door. Remove that
    // fixture's Portal instance fields when replacing the prototype with Gold.
    await fs.writeFile(path.join(directory, LOCKED_DOOR_ID), JSON.stringify({ Base: { prototype: 900004, location: [10, 6] } }))
    await addSecondOwnedItem(directory, { prototype: 900004 })
  })
  const owner = await context.connect(), observer = await context.connect('observer')
  await join(owner); await join(observer)
  const gold = { id: DOOR_ID, slot: 4, label: 'Gold', type: 'Gold', prototypeId: 900004, quantity: 62 }
  const inspected = await approachAndInspect(owner, 1, [itemRow(3), gold])
  const box = context.server.containers.states.get(BOX_ID).entity.container
  const before = box.inventory
  const previous = actor(context.server.getSnapshot()).lastCommand
  rejection(await takeAll(owner, 3, inspected.revision), 'UNSUPPORTED_ITEM', 3)
  assert.equal(context.server.revision, inspected.revision)
  assert.equal(box.inventory, before, 'unsupported batches never replace the source array')
  assert.equal(box.inventoryIndex, 2)
  assert.deepEqual(context.server.player.critter.inventory, [])
  assert.equal(context.server.player.critter.inventoryIndex, 0)
  assert.deepEqual(actor(context.server.getSnapshot()).lastCommand, previous)
  assert.equal(context.server.ownership.items.get(TOKEN_ID).entity.item.parent, BOX_ID)
  assert.equal(context.server.ownership.items.get(DOOR_ID).entity.item.parent, BOX_ID)
  const single = await take(owner, 4, inspected.revision)
  assert.equal(single.ok, true, 'the Generic remains available after the failed batch')
  assert.deepEqual(single.result.items, [gold])
  rejection(await takeAll(owner, 5, single.revision), 'UNSUPPORTED_ITEM', 5)
  assert.deepEqual((await command(owner, 6, 'inventory')).result.items, [itemRow(0)])
  assert.equal(context.server.ownership.items.get(DOOR_ID).entity.gold.quantity, 62)
  for (const snapshot of [...owner.snapshots, ...observer.snapshots, (await join(observer)).snapshot] as const) assertBothItemsPrivate(snapshot)
})

test('descriptive item names stay private through inspection, inventory, transfers and a text-only restart', { timeout: 15000 }, async t => {
  const context = await setup(t)
  const owner = await context.connect(), observer = await context.connect('observer')
  await join(owner); await join(observer)
  assert.equal(TOKEN_LABEL, 'Workshop token')
  const initialIdentity = context.server.contentIdentity
  const inspected = await approachAndInspect(owner)
  assert.equal(inspected.result.items[0].label, TOKEN_LABEL)
  const taken = await take(owner, 3, inspected.revision)
  assert.equal(taken.ok, true)
  assert.equal(taken.result.inventory.items[0].label, TOKEN_LABEL)
  const inventory = await command(owner, 4, 'inventory')
  assert.deepEqual(inventory.result.items, [itemRow(0)])
  const returned = await put(owner, 5, inventory.revision)
  assert.equal(returned.ok, true)
  assert.deepEqual(returned.result.items, [itemRow(0)])
  const reinspected = await command(owner, 6, 'inspect', { targetId: BOX_ID })
  assert.equal(reinspected.result.items[0].label, TOKEN_LABEL)
  const batch = await takeAll(owner, 7, reinspected.revision)
  assert.equal(batch.ok, true)
  assert.deepEqual(batch.result.itemIds, [TOKEN_ID])
  assert.deepEqual(batch.result.inventory.items, [itemRow(0)])
  assert.deepEqual((await command(owner, 8, 'inventory')).result.items, [itemRow(0)])
  for (const snapshot of [...owner.snapshots, ...observer.snapshots, (await join(observer)).snapshot] as const) assertPrivate(snapshot)
  assert.equal((await command(owner, 9, 'save')).ok, true)
  const checkpoint = await fs.readFile(path.join(context.dataPath, 'saves/local-checkpoint.json'))
  await context.server.stop()
  const renamed = 'Renamed workshop token'
  await fs.writeFile(path.join(context.dataPath, 'mes/Description.json'), JSON.stringify({
    Description: { 7: { id: '9003', text: renamed } },
  }))
  const restarted = await context.start()
  const newOwner = await restarted.connect(), newObserver = await restarted.connect('observer')
  const fresh = await join(newOwner); await join(newObserver)
  assert.equal(restarted.server.contentIdentity, initialIdentity, 'presentation text never changes the simulation identity')
  const loaded = await command(newOwner, 1, 'load')
  assert.equal(loaded.ok, true, 'a text-only update remains compatible with the unchanged saved simulation')
  assert.deepEqual(await fs.readFile(path.join(context.dataPath, 'saves/local-checkpoint.json')), checkpoint,
    'loading updated presentation text does not rewrite the checkpoint')
  const namedRow = { ...itemRow(0), label: renamed }
  assert.deepEqual((await command(newOwner, 2, 'inventory')).result.items, [namedRow])
  const empty = await command(newOwner, 3, 'inspect', { targetId: BOX_ID })
  assert.deepEqual(empty.result.items, [])
  const renamedPut = await put(newOwner, 4, empty.revision)
  assert.equal(renamedPut.ok, true)
  assert.deepEqual(renamedPut.result.items, [namedRow])
  const renamedBatch = await takeAll(newOwner, 5, renamedPut.revision)
  assert.equal(renamedBatch.ok, true)
  assert.deepEqual(renamedBatch.result.inventory.items, [namedRow])
  for (const snapshot of [fresh.snapshot, ...newOwner.snapshots, ...newObserver.snapshots, (await join(newObserver)).snapshot] as const) {
    assertPrivate(snapshot)
    assert.equal(JSON.stringify(snapshot).includes(renamed), false, 'the updated descriptive name remains private')
  }
})

test('a private held Key opens a reviewed locked door without unlocking or consuming it and saved open poses survive putting it away',
  { timeout: 65000 }, async t => {
    const context = await setup(t)
    const owner = await context.connect(), observer = await context.connect('observer')
    const joined = await join(owner); await join(observer)
    const door = snapshot => snapshot.doors.find(value => value.id === LOCKED_DOOR_ID)
    assert.equal(door(joined.snapshot).locked, true)
    assert.equal(door(joined.snapshot).usable, true, 'public support does not reveal whether this actor holds a key')
    assert.equal(door(joined.snapshot).open, false)
    const keyBefore = await fs.readFile(path.join(context.dataPath, KEY_ID))
    const keyEntity = context.server.ownership.items.get(KEY_ID).entity
    const location = actor(joined.snapshot).location
    rejection(await command(owner, 1, 'use', { targetId: LOCKED_DOOR_ID }), 'LOCKED', 1)
    assert.deepEqual(actor(context.server.getSnapshot()).location, location, 'missing-key denial occurs before walking')
    assert.equal(actor(context.server.getSnapshot()).movement, null)
    rejection(await command(owner, 2, 'use', { targetId: LOCKED_DOOR_ID, keyId: LOCK_KEY_ID }), 'INVALID_COMMAND', 2)
    rejection(await command(observer, 100, 'use', { targetId: LOCKED_DOOR_ID }), 'FORBIDDEN', 100)
    rejection(await take(owner, 2, context.server.revision, { targetId: KEY_BOX_ID, itemId: KEY_ID }), 'OUT_OF_RANGE', 2)
    const initial = await inspectKeyBox(owner, 3)
    rejection(await take(observer, 101, initial.revision, { targetId: KEY_BOX_ID, itemId: KEY_ID }), 'FORBIDDEN', 101)
    assert.equal((await command(owner, 5, 'pause')).ok, true)
    rejection(await take(owner, 6, context.server.revision, { targetId: KEY_BOX_ID, itemId: KEY_ID }), 'PAUSED', 6)
    assert.equal((await command(owner, 7, 'resume')).ok, true)
    const refreshed = await command(owner, 8, 'inspect', { targetId: KEY_BOX_ID })
    const taken = await take(owner, 9, refreshed.revision, { targetId: KEY_BOX_ID, itemId: KEY_ID })
    assert.equal(taken.ok, true, taken.message)
    assert.deepEqual(taken.result, { kind: 'take', targetId: KEY_BOX_ID, itemId: KEY_ID, items: [],
      inventory: { ownerId: OWNER_ID, items: [keyRow(0)] } })
    rejection(await take(owner, 9, refreshed.revision, { targetId: KEY_BOX_ID, itemId: KEY_ID }), 'REPLAYED_COMMAND', 9)
    assert.deepEqual((await command(owner, 10, 'inventory')).result.items, [keyRow(0)])
    const opened = await completedCommand(owner, 11, 'use', { targetId: LOCKED_DOOR_ID })
    assert.deepEqual(opened.result, { targetId: LOCKED_DOOR_ID, open: true })
    assert.equal(door(context.server.getSnapshot()).locked, true, 'using a key never clears the Locked flag')
    assert.deepEqual((await command(owner, 12, 'inventory')).result.items, [keyRow(0)], 'opening does not consume a key')
    await completedCommand(owner, 13, 'move', { target: [10, 6] })
    assert.deepEqual(actor(context.server.getSnapshot()).location, [10, 6], 'the opened locked door can be traversed')
    rejection(await command(owner, 14, 'use', { targetId: LOCKED_DOOR_ID }), 'OCCUPIED', 14)
    await completedCommand(owner, 15, 'move', { target: [11, 6] })
    assert.deepEqual((await completedCommand(owner, 16, 'use', { targetId: LOCKED_DOOR_ID })).result,
      { targetId: LOCKED_DOOR_ID, open: false })
    await completedCommand(owner, 17, 'use', { targetId: LOCKED_DOOR_ID })
    const empty = await inspectKeyBox(owner, 18, [])
    const returned = await put(owner, 20, empty.revision, { targetId: KEY_BOX_ID, itemId: KEY_ID })
    assert.equal(returned.ok, true, returned.message)
    assert.deepEqual(returned.result, { kind: 'put', targetId: KEY_BOX_ID, itemId: KEY_ID, items: [keyRow(0)],
      inventory: { ownerId: OWNER_ID, items: [] } })
    assert.equal(keyEntity.item.parent, KEY_BOX_ID)
    assert.equal(keyEntity.key.keyId, LOCK_KEY_ID)
    assert.equal(keyEntity.item.invLocation, 0)
    assert.equal((await command(owner, 21, 'save')).ok, true, 'an already open door remains savable after putting away its key')
    const saved = JSON.parse(await fs.readFile(path.join(context.dataPath, 'saves/local-checkpoint.json'), 'utf8'))
    assert.equal(saved.rulesVersion, 'movement-doors-ownership-attributes-v9')
    assert.deepEqual(saved.doors.find(value => value.id === LOCKED_DOOR_ID), { id: LOCKED_DOOR_ID, open: true })
    assert.deepEqual(saved.ownership.owners.find(value => value.id === OWNER_ID).items, [])
    assert.deepEqual(saved.ownership.owners.find(value => value.id === KEY_BOX_ID).items, [{ id: KEY_ID, slot: 0 }])
    const closedWithoutKey = await completedCommand(owner, 22, 'use', { targetId: LOCKED_DOOR_ID })
    assert.deepEqual(closedWithoutKey.result, { targetId: LOCKED_DOOR_ID, open: false })
    rejection(await command(owner, 23, 'use', { targetId: LOCKED_DOOR_ID }), 'LOCKED', 23)
    assert.equal(door(context.server.getSnapshot()).locked, true)
    assert.deepEqual(await fs.readFile(path.join(context.dataPath, KEY_ID)), keyBefore, 'key use and ownership never rewrite module data')
    for (const snapshot of [...owner.snapshots, ...observer.snapshots, (await join(observer)).snapshot] as const) assertPrivate(snapshot)
    await context.server.stop()
    const restarted = await context.start()
    const newOwner = await restarted.connect(), newObserver = await restarted.connect('observer')
    await join(newOwner); await join(newObserver)
    const loaded = await command(newOwner, 1, 'load')
    assert.equal(loaded.ok, true, loaded.message)
    assert.equal(door(restarted.server.getSnapshot()).open, true)
    assert.equal(door(restarted.server.getSnapshot()).locked, true)
    assert.deepEqual((await command(newOwner, 2, 'inventory')).result.items, [])
    assert.deepEqual((await command(newOwner, 3, 'inspect', { targetId: KEY_BOX_ID })).result.items, [keyRow(0)])
    assert.deepEqual((await completedCommand(newOwner, 4, 'use', { targetId: LOCKED_DOOR_ID })).result,
      { targetId: LOCKED_DOOR_ID, open: false }, 'restored open locked doors close without holding a key')
    rejection(await command(newOwner, 5, 'use', { targetId: LOCKED_DOOR_ID }), 'LOCKED', 5)
    for (const snapshot of [...newOwner.snapshots, ...newObserver.snapshots, (await join(newObserver)).snapshot] as const) assertPrivate(snapshot)
  })

test('whole standalone Key Take All races have one winner and preserve private identity through Put and replay guards',
  { timeout: 15000 }, async t => {
    const context = await setup(t)
    const first = await context.connect(), second = await context.connect(), observer = await context.connect('observer')
    await join(first); await join(second); await join(observer)
    const inspected = await inspectKeyBox(first, 1)
    const results = await Promise.all([
      takeAll(first, 3, inspected.revision, { targetId: KEY_BOX_ID }),
      take(second, 4, inspected.revision, { targetId: KEY_BOX_ID, itemId: KEY_ID }),
    ])
    assert.equal(results.filter(value => value.ok).length, 1)
    const winner = results.find(value => value.ok), loser = results.find(value => !value.ok)
    assert.ok(['STALE_REVISION', 'REPLAYED_COMMAND'].includes(loser.code), loser.code)
    assert.deepEqual(winner.result.inventory.items, [keyRow(0)])
    assert.deepEqual((await command(first, 5, 'inventory')).result.items, [keyRow(0)])
    const returned = await put(first, 6, context.server.revision, { targetId: KEY_BOX_ID, itemId: KEY_ID })
    assert.equal(returned.ok, true, returned.message)
    assert.deepEqual(returned.result.items, [keyRow(0)])
    const batch = await takeAll(first, 7, returned.revision, { targetId: KEY_BOX_ID })
    assert.equal(batch.ok, true, batch.message)
    assert.deepEqual(batch.result, { kind: 'take-all', targetId: KEY_BOX_ID, itemIds: [KEY_ID], items: [],
      inventory: { ownerId: OWNER_ID, items: [keyRow(0)] } })
    rejection(await takeAll(first, 7, returned.revision, { targetId: KEY_BOX_ID }), 'REPLAYED_COMMAND', 7)
    rejection(await put(first, 8, returned.revision, { targetId: KEY_BOX_ID, itemId: KEY_ID }), 'STALE_REVISION', 8)
    rejection(await put(first, 9, batch.revision, { targetId: KEY_BOX_ID, itemId: KEY_ID, keyId: LOCK_KEY_ID }), 'INVALID_COMMAND', 9)
    const putAgain = await put(first, 9, batch.revision, { targetId: KEY_BOX_ID, itemId: KEY_ID })
    assert.equal(putAgain.ok, true, putAgain.message)
    assert.equal((await command(first, 10, 'pause')).ok, true)
    rejection(await takeAll(first, 11, context.server.revision, { targetId: KEY_BOX_ID }), 'PAUSED', 11)
    assert.equal((await command(first, 12, 'resume')).ok, true)
    const refreshed = await command(first, 13, 'inspect', { targetId: KEY_BOX_ID })
    const retaken = await takeAll(first, 14, refreshed.revision, { targetId: KEY_BOX_ID })
    assert.equal(retaken.ok, true, retaken.message)
    assert.deepEqual((await command(first, 15, 'inventory')).result.items, [keyRow(0)])
    assert.equal(context.server.ownership.items.get(KEY_ID).entity.item.parent, OWNER_ID)
    assert.equal(context.server.player.critter.inventoryIndex, 1)
    assert.equal(context.server.containers.states.get(KEY_BOX_ID).entity.container.inventoryIndex, 0)
    const publicState = await snapshotWhere(observer, snapshot => snapshot.revision === retaken.revision)
    assert.deepEqual(actor(publicState).lastCommand.result, { kind: 'take-all', targetId: KEY_BOX_ID })
    for (const snapshot of [...first.snapshots, ...second.snapshots, ...observer.snapshots, (await join(observer)).snapshot] as const) assertPrivate(snapshot)
  })

test('reviewed locked container access requires a currently held Key for inspection and every transfer, including after restart',
  { timeout: 20000 }, async t => {
    const context = await setup(t)
    const owner = await context.connect(), observer = await context.connect('observer')
    const joined = await join(owner); await join(observer)
    const box = snapshot => snapshot.containers.find(value => value.id === LOCKED_BOX_ID)
    assert.equal(box(joined.snapshot).locked, true)
    assert.equal(box(joined.snapshot).usable, true, 'public support is independent of private key possession')
    const initialPosition = actor(joined.snapshot).location
    rejection(await command(owner, 1, 'use', { targetId: LOCKED_BOX_ID }), 'LOCKED', 1)
    assert.deepEqual(actor(context.server.getSnapshot()).location, initialPosition)
    assert.equal(actor(context.server.getSnapshot()).movement, null, 'missing-key use is rejected before any approach')
    rejection(await command(owner, 2, 'inspect', { targetId: LOCKED_BOX_ID }), 'LOCKED', 2)
    rejection(await take(owner, 3, context.server.revision, { targetId: LOCKED_BOX_ID, itemId: PRIZE_ID }), 'LOCKED', 3)
    const keyBox = await inspectKeyBox(owner, 4)
    const held = await take(owner, 6, keyBox.revision, { targetId: KEY_BOX_ID, itemId: KEY_ID })
    assert.equal(held.ok, true, held.message)
    await completedCommand(owner, 7, 'use', { targetId: LOCKED_BOX_ID })
    const inspected = await command(owner, 8, 'inspect', { targetId: LOCKED_BOX_ID })
    assert.equal(inspected.ok, true, inspected.message)
    assert.deepEqual(inspected.result, { kind: 'container', targetId: LOCKED_BOX_ID, items: [prizeRow(3)] })
    assert.equal(box(context.server.getSnapshot()).locked, true, 'inspection never clears the lock')
    const taken = await take(owner, 9, inspected.revision, { targetId: LOCKED_BOX_ID, itemId: PRIZE_ID })
    assert.equal(taken.ok, true, taken.message)
    assert.deepEqual(taken.result.inventory.items, [keyRow(0), prizeRow(1)])
    const returned = await put(owner, 10, taken.revision, { targetId: LOCKED_BOX_ID, itemId: PRIZE_ID })
    assert.equal(returned.ok, true, returned.message)
    assert.deepEqual(returned.result.items, [prizeRow(0)])
    assert.deepEqual(returned.result.inventory.items, [keyRow(0)])
    const batch = await takeAll(owner, 11, returned.revision, { targetId: LOCKED_BOX_ID })
    assert.equal(batch.ok, true, batch.message)
    assert.deepEqual(batch.result.itemIds, [PRIZE_ID])
    assert.deepEqual(batch.result.inventory.items, [keyRow(0), prizeRow(1)])
    assert.equal((await put(owner, 12, batch.revision, { targetId: LOCKED_BOX_ID, itemId: PRIZE_ID })).ok, true)
    rejection(await command(observer, 100, 'inspect', { targetId: LOCKED_BOX_ID }), 'FORBIDDEN', 100)
    const forbiddenInventory = await command(observer, 101, 'inventory')
    rejection(forbiddenInventory, 'FORBIDDEN', 101)
    assert.equal(Object.hasOwn(forbiddenInventory, 'result'), false, 'an observer receives no private actor inventory')
    assert.equal((await command(owner, 13, 'pause')).ok, true)
    rejection(await command(owner, 14, 'inspect', { targetId: LOCKED_BOX_ID }), 'PAUSED', 14)
    assert.equal((await command(owner, 15, 'resume')).ok, true)
    const refreshed = await command(owner, 16, 'inspect', { targetId: LOCKED_BOX_ID })
    assert.deepEqual(refreshed.result.items, [prizeRow(0)])
    const keyAway = await put(owner, 17, refreshed.revision, { targetId: LOCKED_BOX_ID, itemId: KEY_ID })
    assert.equal(keyAway.ok, true, keyAway.message)
    assert.deepEqual(keyAway.result, { kind: 'put', targetId: LOCKED_BOX_ID, itemId: KEY_ID,
      items: [prizeRow(0), keyRow(1)], inventory: { ownerId: OWNER_ID, items: [] } })
    rejection(await put(owner, 17, refreshed.revision, { targetId: LOCKED_BOX_ID, itemId: KEY_ID }), 'REPLAYED_COMMAND', 17)
    rejection(await take(owner, 18, refreshed.revision, { targetId: LOCKED_BOX_ID, itemId: PRIZE_ID }), 'STALE_REVISION', 18)
    rejection(await command(owner, 19, 'inspect', { targetId: LOCKED_BOX_ID }), 'LOCKED', 19)
    const lockedPosition = actor(context.server.getSnapshot()).location
    rejection(await command(owner, 20, 'use', { targetId: LOCKED_BOX_ID }), 'LOCKED', 20)
    assert.deepEqual(actor(context.server.getSnapshot()).location, lockedPosition)
    assert.equal(actor(context.server.getSnapshot()).movement, null)
    rejection(await take(owner, 21, keyAway.revision, { targetId: LOCKED_BOX_ID, itemId: PRIZE_ID }), 'LOCKED', 21)
    rejection(await put(owner, 22, keyAway.revision, { targetId: LOCKED_BOX_ID, itemId: TOKEN_ID }), 'LOCKED', 22)
    rejection(await takeAll(owner, 23, keyAway.revision, { targetId: LOCKED_BOX_ID }), 'LOCKED', 23)
    assert.equal(box(context.server.getSnapshot()).usable, true, 'denial never publishes the private key state')
    assert.equal(box(context.server.getSnapshot()).locked, true)
    const keyEntity = context.server.ownership.items.get(KEY_ID).entity
    assert.equal(keyEntity.item.parent, LOCKED_BOX_ID)
    assert.equal(keyEntity.key.keyId, LOCK_KEY_ID)
    assert.equal(context.server.ownership.items.get(PRIZE_ID).entity.item.parent, LOCKED_BOX_ID)
    assert.equal((await command(owner, 24, 'save')).ok, true, 'static eligibility preserves ownership after the authorizing key is put away')
    const saved = JSON.parse(await fs.readFile(path.join(context.dataPath, 'saves/local-checkpoint.json'), 'utf8'))
    assert.equal(saved.rulesVersion, 'movement-doors-ownership-attributes-v9')
    assert.deepEqual(saved.ownership.owners.find(value => value.id === LOCKED_BOX_ID).items,
      [{ id: PRIZE_ID, slot: 0 }, { id: KEY_ID, slot: 1 }])
    assert.deepEqual(saved.ownership.owners.find(value => value.id === OWNER_ID).items, [])
    for (const snapshot of [...owner.snapshots, ...observer.snapshots, (await join(observer)).snapshot] as const) assertPrivate(snapshot)
    await context.server.stop()
    const restarted = await context.start()
    const newOwner = await restarted.connect(), newObserver = await restarted.connect('observer')
    await join(newOwner); await join(newObserver)
    const loaded = await command(newOwner, 1, 'load')
    assert.equal(loaded.ok, true, loaded.message)
    assert.deepEqual((await command(newOwner, 2, 'inventory')).result.items, [])
    rejection(await command(newOwner, 3, 'inspect', { targetId: LOCKED_BOX_ID }), 'LOCKED', 3)
    rejection(await command(newOwner, 4, 'use', { targetId: LOCKED_BOX_ID }), 'LOCKED', 4)
    rejection(await take(newOwner, 5, loaded.revision, { targetId: LOCKED_BOX_ID, itemId: PRIZE_ID }), 'LOCKED', 5)
    assert.equal(restarted.server.ownership.items.get(KEY_ID).entity.item.parent, LOCKED_BOX_ID)
    assert.equal(restarted.server.ownership.items.get(PRIZE_ID).entity.item.parent, LOCKED_BOX_ID)
    assert.deepEqual(restarted.server.containers.states.get(LOCKED_BOX_ID).entity.container.inventory,
      [{ id: PRIZE_ID, slot: 0 }, { id: KEY_ID, slot: 1 }])
    for (const snapshot of [...newOwner.snapshots, ...newObserver.snapshots, (await join(newObserver)).snapshot] as const) assertPrivate(snapshot)
  })
