const assert = require('node:assert/strict')
const { before, test } = require('node:test')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')
const { io } = require('socket.io-client')
const { MAP_ID, BOX_ID, TOKEN_ID, TOKEN_LABEL, KEY_ID, PRIZE_ID, PRIZE_LABEL,
  GROUND_ITEM_ID, GROUND_ITEM_LABEL } = require('../../../examples/inventory-workshop/generate.cjs')

const root = path.resolve(__dirname, '../../..')
const source = path.join(root, '@openarcanum/agate/src')
const OWNER_ID = '16086.json'
const ground = location => ({ id: GROUND_ITEM_ID, kind: 'ground', label: GROUND_ITEM_LABEL,
  type: 'Generic', prototypeId: 900007, location })
const pebble = slot => ({ id: GROUND_ITEM_ID, slot, label: GROUND_ITEM_LABEL, type: 'Generic', prototypeId: 900007, canDrop: true })
const token = slot => ({ id: TOKEN_ID, slot, label: TOKEN_LABEL, type: 'Generic', prototypeId: 900003 })
let createAuthorityServer

before(async () => {
  const { build } = await import('esbuild')
  const { transformAsync } = await import('@babel/core')
  const result = await build({
    absWorkingDir: root,
    stdin: { contents: "export { createAuthorityServer } from './server/authority/AuthorityServer.js';",
      resolveDir: source, sourcefile: 'ground-network-test-entry.js' },
    bundle: true, platform: 'node', format: 'cjs', target: 'node24', write: false,
    external: ['electron', 'workerpool'], loader: { '.glsl': 'text' },
    plugins: [{ name: 'ground-socket-flow-source', setup(builder) {
      builder.onLoad({ filter: /\.js$/ }, async ({ path: filename }) => {
        if (!filename.startsWith(source + path.sep)) return
        const transformed = await transformAsync(await fs.readFile(filename, 'utf8'), {
          filename, configFile: false, babelrc: false,
          plugins: [['@babel/plugin-transform-flow-strip-types', { allowDeclareFields: false }]],
        })
        return { contents: transformed.code, loader: 'js', resolveDir: path.dirname(filename) }
      })
    } }],
  })
  const compiled = new Module(path.join(__dirname, 'ground-network-test-bundle.cjs'), module)
  compiled.filename = path.join(__dirname, 'ground-network-test-bundle.cjs')
  compiled.paths = Module._nodeModulePaths(root)
  compiled._compile(result.outputFiles[0].text, compiled.filename)
  createAuthorityServer = compiled.exports.createAuthorityServer
})

async function setup(t, mutate) {
  const dataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'agate-ground-network-'))
  await fs.cp(path.join(root, 'examples/inventory-workshop/data'), dataPath, { recursive: true })
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
      await new Promise((resolve, reject) => {
        socket.once('connect', resolve); socket.once('connect_error', reject); socket.connect()
      })
      return client
    }
    return { server, connect }
  }
  return { dataPath, start, ...(await start()) }
}

const join = client => client.socket.timeout(3000).emitWithAck('authority:join', { version: 1 })
const command = (client, id, type, data = {}) => client.socket.timeout(3000).emitWithAck('authority:command',
  { version: 1, id, actorId: '0', type, ...data })
const pickup = (client, id, revision, changes = {}) => command(client, id, 'pickup',
  { targetId: GROUND_ITEM_ID, expectedRevision: revision, ...changes })
const drop = (client, id, revision, changes = {}) => command(client, id, 'drop',
  { itemId: GROUND_ITEM_ID, expectedRevision: revision, ...changes })
const actor = snapshot => snapshot.actors.find(value => value.id === '0')
function rejection(result, code, id) {
  assert.equal(result.ok, false)
  assert.equal(result.code, code)
  assert.equal(result.version, 1)
  if (id !== undefined) assert.equal(result.id, id)
  assert.ok(Number.isSafeInteger(result.revision))
  assert.equal(typeof result.message, 'string')
}
function publicState(snapshot) {
  assert.ok(Array.isArray(snapshot.groundItems))
  for (const item of snapshot.groundItems) {
    assert.deepEqual(item, ground(item.location))
    assert.equal(item.location.length, 2)
    assert.ok(item.location.every(Number.isSafeInteger))
  }
  const value = JSON.stringify(snapshot)
  for (const privateValue of [TOKEN_ID, TOKEN_LABEL, KEY_ID, PRIZE_ID, PRIZE_LABEL]) {
    assert.equal(value.includes(privateValue), false, 'held and container item details remain private')
  }
  for (const key of ['items', 'inventory', 'ownership', 'parent', 'slot', 'keyId', 'keyID', 'canDrop']) {
    assert.equal(value.includes(`"${key}":`), false, `public state exposed ${key}`)
  }
  if (!snapshot.groundItems.length) {
    assert.equal(value.includes(GROUND_ITEM_ID), false, 'a held pebble identity is absent even from public completion summaries')
    assert.equal(value.includes(GROUND_ITEM_LABEL), false, 'a held pebble name is absent from public state')
  }
}
async function snapshotWhere(client, predicate, timeout = 8000) {
  const existing = client.snapshots.find(predicate)
  if (existing) return existing
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); client.socket.off('authority:snapshot', receive) }
    const receive = snapshot => { if (predicate(snapshot)) { cleanup(); resolve(snapshot) } }
    const timer = setTimeout(() => { cleanup(); reject(new Error('Expected ground authority snapshot did not arrive')) }, timeout)
    client.socket.on('authority:snapshot', receive)
  })
}
async function complete(client, id, type, data) {
  const result = await command(client, id, type, data)
  assert.equal(result.ok, true, result.message)
  if (result.status !== 'accepted') return result
  const snapshot = await snapshotWhere(client, value => actor(value).lastCommand?.id === id && !actor(value).movement)
  assert.equal(actor(snapshot).lastCommand.status, 'completed', actor(snapshot).lastCommand.message)
  return { ...result, status: 'completed', revision: snapshot.revision, result: actor(snapshot).lastCommand.result }
}

test('socket ground pickup and drop conserve one identity across public floors, private owners, containers and a fresh checkpoint host',
  { timeout: 22000 }, async t => {
    const context = await setup(t)
    const owner = await context.connect(), observer = await context.connect('observer')
    const first = await join(owner); await join(observer)
    assert.deepEqual(first.snapshot.groundItems, [ground([4, 7])])
    publicState(first.snapshot)
    const bytes = await fs.readFile(path.join(context.dataPath, GROUND_ITEM_ID))
    assert.deepEqual((await command(owner, 1, 'inventory')).result.items, [])
    rejection(await pickup(owner, 2, context.server.revision), 'OUT_OF_RANGE', 2)
    const approached = await complete(owner, 3, 'use', { targetId: GROUND_ITEM_ID })
    assert.deepEqual(approached.result, { kind: 'ground', targetId: GROUND_ITEM_ID })
    const picked = await pickup(owner, 4, approached.revision)
    assert.equal(picked.ok, true, picked.message)
    assert.deepEqual(picked.result, { kind: 'pickup', targetId: GROUND_ITEM_ID,
      inventory: { ownerId: OWNER_ID, items: [pebble(0)] } })
    const held = await snapshotWhere(observer, snapshot => snapshot.revision === picked.revision)
    assert.deepEqual(held.groundItems, [])
    assert.deepEqual(actor(held).lastCommand, { id: 4, type: 'pickup', status: 'completed', result: { kind: 'pickup' } })
    publicState(held)
    const lateObserver = await context.connect('observer')
    publicState((await join(lateObserver)).snapshot)
    const dropped = await drop(owner, 5, picked.revision)
    assert.equal(dropped.ok, true, dropped.message)
    const droppedLocation = actor(context.server.getSnapshot()).location
    assert.deepEqual(dropped.result, { kind: 'drop', itemId: GROUND_ITEM_ID, ground: ground(droppedLocation),
      inventory: { ownerId: OWNER_ID, items: [] } })
    assert.deepEqual((await snapshotWhere(observer, snapshot => snapshot.revision === dropped.revision)).groundItems,
      [ground(droppedLocation)])
    rejection(await drop(owner, 5, picked.revision), 'REPLAYED_COMMAND', 5)
    rejection(await drop(owner, 6, dropped.revision), 'UNKNOWN_ITEM', 6)
    const retaken = await pickup(owner, 7, dropped.revision)
    assert.equal(retaken.ok, true, retaken.message)
    await complete(owner, 8, 'use', { targetId: BOX_ID })
    const inspected = await command(owner, 9, 'inspect', { targetId: BOX_ID })
    assert.deepEqual(inspected.result.items, [token(3)])
    const put = await command(owner, 10, 'put', { targetId: BOX_ID, itemId: GROUND_ITEM_ID, expectedRevision: inspected.revision })
    assert.equal(put.ok, true, put.message)
    assert.deepEqual(put.result.items, [pebble(0), token(3)], 'Drop capability survives private container ownership')
    const refreshed = await command(owner, 11, 'inspect', { targetId: BOX_ID })
    assert.deepEqual(refreshed.result.items, [pebble(0), token(3)])
    const all = await command(owner, 12, 'take-all', { targetId: BOX_ID, expectedRevision: refreshed.revision })
    assert.equal(all.ok, true, all.message)
    assert.deepEqual(all.result.inventory.items, [pebble(0), token(1)])
    rejection(await drop(owner, 13, all.revision, { itemId: TOKEN_ID }), 'UNSUPPORTED_ITEM', 13)
    const savedDrop = await drop(owner, 14, all.revision)
    assert.equal(savedDrop.ok, true, savedDrop.message)
    assert.deepEqual(savedDrop.result.inventory.items, [token(1)])
    const savedLocation = actor(context.server.getSnapshot()).location
    assert.equal((await command(owner, 15, 'save')).ok, true)
    const saved = JSON.parse(await fs.readFile(path.join(context.dataPath, 'saves/local-checkpoint.json'), 'utf8'))
    assert.equal(saved.version, 5)
    assert.equal(saved.rulesVersion, 'movement-doors-ownership-progression-v8')
    assert.deepEqual(saved.ownership.items.find(item => item.id === GROUND_ITEM_ID),
      { id: GROUND_ITEM_ID, parent: null, groundLocation: savedLocation })
    assert.deepEqual(await fs.readFile(path.join(context.dataPath, GROUND_ITEM_ID)), bytes, 'world transfers do not rewrite authored assets')
    for (const snapshot of [...owner.snapshots, ...observer.snapshots, ...lateObserver.snapshots]) publicState(snapshot)
    await context.server.stop()
    const restarted = await context.start()
    const newOwner = await restarted.connect(), newObserver = await restarted.connect('observer')
    await join(newOwner); await join(newObserver)
    const loaded = await command(newOwner, 1, 'load')
    assert.equal(loaded.ok, true, loaded.message)
    assert.deepEqual((await command(newOwner, 2, 'inventory')).result.items, [token(1)])
    assert.deepEqual(restarted.server.getSnapshot().groundItems, [ground(savedLocation)])
    const restoredPickup = await pickup(newOwner, 3, loaded.revision)
    assert.equal(restoredPickup.ok, true, restoredPickup.message)
    assert.deepEqual(restoredPickup.result.inventory.items, [pebble(0), token(1)])
    assert.equal([...restarted.server.map.entityManager.entities.values()].filter(entity => entity.sourcePath === GROUND_ITEM_ID).length, 1)
    for (const snapshot of [...newOwner.snapshots, ...newObserver.snapshots, (await join(newObserver)).snapshot]) publicState(snapshot)
  })

test('two owner sockets racing to pick up the same public ground item have exactly one winner', { timeout: 10000 }, async t => {
  const context = await setup(t)
  const first = await context.connect(), second = await context.connect(), observer = await context.connect('observer')
  await join(first); await join(second); await join(observer)
  const approached = await complete(first, 1, 'use', { targetId: GROUND_ITEM_ID })
  const results = await Promise.all([pickup(first, 2, approached.revision), pickup(second, 3, approached.revision)])
  assert.equal(results.filter(result => result.ok).length, 1)
  const loser = results.find(result => !result.ok), winner = results.find(result => result.ok)
  assert.ok(['STALE_REVISION', 'REPLAYED_COMMAND'].includes(loser.code), loser.code)
  assert.deepEqual(winner.result.inventory.items, [pebble(0)])
  assert.deepEqual((await command(second, 4, 'inventory')).result.items, [pebble(0)])
  assert.equal(context.server.player.critter.inventoryIndex, 1)
  publicState(await snapshotWhere(observer, snapshot => snapshot.revision === winner.revision))
  const dropped = await drop(first, 5, winner.revision)
  assert.equal(dropped.ok, true, dropped.message)
  const again = await Promise.all([pickup(first, 6, dropped.revision), pickup(second, 7, dropped.revision)])
  assert.equal(again.filter(result => result.ok).length, 1)
  assert.deepEqual((await command(first, 8, 'inventory')).result.items, [pebble(0)])
  for (const snapshot of [...first.snapshots, ...second.snapshots, ...observer.snapshots, (await join(observer)).snapshot]) publicState(snapshot)
})

test('ground intentions enforce exact envelopes, owner authorization, revision, replay, pause and busy guards',
  { timeout: 12000 }, async t => {
    const context = await setup(t)
    const owner = await context.connect(), observer = await context.connect('observer')
    rejection(await pickup(owner, 1, 0), 'NOT_JOINED', 1)
    const first = await join(owner); await join(observer)
    rejection(await pickup(observer, 100, first.snapshot.revision), 'FORBIDDEN', 100)
    rejection(await drop(observer, 101, first.snapshot.revision), 'FORBIDDEN', 101)
    rejection(await pickup(owner, 1, first.snapshot.revision, { version: 2 }), 'VERSION_MISMATCH', 1)
    rejection(await pickup(owner, 1, first.snapshot.revision, { actorId: 'another' }), 'FORBIDDEN', 1)
    for (const changes of [{ targetId: '' }, { targetId: null }, { targetId: 'x'.repeat(1025) },
      { expectedRevision: -1 }, { expectedRevision: null }, { expectedRevision: 0.5 }, { expectedRevision: '1' },
      { itemId: GROUND_ITEM_ID }, { quantity: 1 }, { target: [4, 7] }, { slot: 0 }, { id: 0 }]) {
      rejection(await pickup(owner, 1, first.snapshot.revision, changes), 'INVALID_COMMAND')
    }
    for (const changes of [{ itemId: '' }, { itemId: null }, { itemId: 'x'.repeat(1025) },
      { expectedRevision: -1 }, { expectedRevision: Number.MAX_SAFE_INTEGER + 1 }, { expectedRevision: '1' },
      { targetId: GROUND_ITEM_ID }, { location: [4, 7] }, { parent: null }, { quantity: 1 }, { keyId: 7001 }]) {
      rejection(await drop(owner, 1, first.snapshot.revision, changes), 'INVALID_COMMAND')
    }
    rejection(await pickup(owner, 1, first.snapshot.revision), 'OUT_OF_RANGE', 1)
    assert.equal((await command(owner, 2, 'pause')).ok, true)
    rejection(await pickup(owner, 3, context.server.revision), 'PAUSED', 3)
    rejection(await drop(owner, 4, context.server.revision), 'PAUSED', 4)
    assert.equal((await command(owner, 5, 'resume')).ok, true)
    assert.equal((await command(owner, 6, 'use', { targetId: GROUND_ITEM_ID })).status, 'accepted')
    rejection(await pickup(owner, 7, context.server.revision), 'BUSY', 7)
    rejection(await drop(owner, 8, context.server.revision), 'BUSY', 8)
    await snapshotWhere(owner, snapshot => actor(snapshot).lastCommand?.id === 6 && !actor(snapshot).movement)
    rejection(await pickup(owner, 9, first.snapshot.revision), 'STALE_REVISION', 9)
    const picked = await pickup(owner, 10, context.server.revision)
    assert.equal(picked.ok, true, picked.message)
    rejection(await pickup(owner, 10, picked.revision), 'REPLAYED_COMMAND', 10)
    rejection(await drop(owner, 11, first.snapshot.revision), 'STALE_REVISION', 11)
    const dropped = await drop(owner, 12, picked.revision)
    assert.equal(dropped.ok, true, dropped.message)
    let release
    const gate = new Promise(resolve => { release = resolve })
    const write = context.server.checkpointStore.write.bind(context.server.checkpointStore)
    context.server.checkpointStore.write = async document => { await gate; return write(document) }
    const saving = command(owner, 13, 'save')
    await snapshotWhere(owner, snapshot => snapshot.checkpoint.busy)
    rejection(await pickup(owner, 14, context.server.revision), 'BUSY', 14)
    release()
    const saved = await saving
    assert.equal(saved.ok, true, saved.message)
    assert.equal((await pickup(owner, 15, saved.revision)).ok, true)
    rejection(await pickup(owner, 16, context.server.revision, { targetId: 'missing-ground-item' }), 'UNKNOWN_TARGET', 16)
    for (const snapshot of [...owner.snapshots, ...observer.snapshots, (await join(observer)).snapshot]) publicState(snapshot)
  })
