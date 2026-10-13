const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const { before, test } = require('node:test') as typeof import('node:test')
const fs = require('node:fs/promises') as typeof import('node:fs/promises')
const os = require('node:os') as typeof import('node:os')
const path = require('node:path') as typeof import('node:path')
const net = require('node:net') as typeof import('node:net')
const Module = require('node:module') as typeof import('node:module')
const { io } = require('socket.io-client') as typeof import('socket.io-client')

const root = path.resolve(__dirname, '../../..')
const source = path.join(root, '@openarcanum/agate/src')
const mapId = 'Synthetic authority map'
const start = [92, 99]
let createAuthorityServer

before(async () => {
  const { build } = await import('esbuild')
  const result = await build({
    absWorkingDir: root,
    stdin: {
      contents: "export { createAuthorityServer } from './server/authority/AuthorityServer.ts';",
      resolveDir: source,
      sourcefile: 'authority-network-test-entry.js',
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node24',
    write: false,
    external: ['electron', 'workerpool'],
    loader: { '.glsl': 'text' },
  })
  const compiled = new Module(path.join(__dirname, 'authority-network-test-bundle.cjs'), module)
  compiled.filename = path.join(__dirname, 'authority-network-test-bundle.cjs')
  compiled.paths = Module._nodeModulePaths(root)
  compiled._compile(result.outputFiles[0].text, compiled.filename)
  createAuthorityServer = compiled.exports.createAuthorityServer
})

// Small stored ZIP writer keeps these fixtures independent of external tools,
// existing bundles, the user's local-data directory, and proprietary artwork.
function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function storedZip(entries) {
  const bodies = [], directory = []
  let offset = 0
  for (const [filename, value] of entries) {
    const name = Buffer.from(filename)
    const bytes = Buffer.from(JSON.stringify(value))
    const checksum = crc32(bytes)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x800, 6)
    local.writeUInt16LE(0x21, 12)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(bytes.length, 18)
    local.writeUInt32LE(bytes.length, 22)
    local.writeUInt16LE(name.length, 26)
    bodies.push(local, name, bytes)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x800, 8)
    central.writeUInt16LE(0x21, 14)
    central.writeUInt32LE(checksum, 16)
    central.writeUInt32LE(bytes.length, 20)
    central.writeUInt32LE(bytes.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(offset, 42)
    directory.push(central, name)
    offset += local.length + name.length + bytes.length
  }
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(directory.reduce((size, part) => size + part.length, 0), 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...bodies, ...directory, end])
}

const doorId = name => `${mapId}/Sector/1/1/Portal/${name}.json`
const containerId = name => `${mapId}/Sector/1/1/Container/${name}.json`
const itemId = name => `${mapId}/Sector/1/1/Gold/${name}.json`

async function fixture({ doors = [], containers = [], items = [], npcInventories = [] } = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agate-authority-network-'))
  await fs.mkdir(path.join(directory, 'archives'))
  const entries: [string, unknown][] = [[`${mapId}/Map.json`, { width: 3, height: 2 }]]
  const sectors = new Map()
  for (let runtimeX = 0; runtimeX < 2; runtimeX++) {
    for (let runtimeY = 0; runtimeY < 3; runtimeY++) {
      // SEC grids keep original y/x order; the runtime uses reversed entity axes.
      const tiles = Array.from({ length: 64 }, () => Array.from({ length: 64 }, () => ({})))
      const sector = { tiles, lights: [], roof: [] }
      sectors.set(`${runtimeX}/${runtimeY}`, sector)
      entries.push([`${mapId}/Sector/${runtimeX}/${runtimeY}/Sector.json`, sector])
    }
  }
  const tile = (x, y, properties = {}) => {
    sectors.get(`${Math.floor(x / 64)}/${Math.floor(y / 64)}`).tiles[x % 64][y % 64] =
      { type: 'Tile', resource: 'synthetic-floor', ...properties }
  }
  for (let x = 92; x <= 96; x++) tile(x, 99)
  tile(93, 100, { blocked: true })
  tile(92, 100) // Occupied by a solid wall rather than a tile-blocking flag.
  tile(97, 99, { blocked: true })
  tile(98, 99) // Walkable destination with no route across the blocked corridor.
  tile(92, 191) // In bounds only if source sector dimensions were transposed.
  entries.push([`${mapId}/Sector/1/1/Wall/solid-wall.json`, {
    Base: { prototype: 2200, location: [92, 100] },
  }])
  for (const door of doors) {
    tile(door.location[0], door.location[1])
    entries.push([doorId(door.name), {
      Base: { prototype: 2028, location: door.location, ...(door.baseFlags ? { flags: door.baseFlags } : {}) },
      ...(door.flags ? { Portal: { flags: door.flags } } : {}),
      ...(door.visual ? { Visual: { classes: { current: door.visual } } } : {}),
    }])
  }
  for (const container of containers) {
    tile(container.location[0], container.location[1])
    const inventory = container.inventory || []
    entries.push([containerId(container.name), {
      Base: { prototype: 3044, location: container.location, ...(container.baseFlags ? { flags: container.baseFlags } : {}) },
      Container: { ...(!container.missing ? { inventory, inventoryIndex: inventory.length } : {}),
        ...(container.flags ? { flags: container.flags } : {}), ...container.data },
    }])
  }
  for (const item of items) {
    entries.push([itemId(item.name), {
      Base: { prototype: 9076, location: [90, 99], flags: ['Inventory', 'NoBlock'], ...item.base },
      Item: { parent: item.parent, invLocation: item.slot ?? 0, ...item.data },
      Gold: { quantity: item.quantity ?? 62 },
    }])
  }
  for (const npc of npcInventories) entries.push([`${mapId}/Sector/1/1/Npc/${npc.name}.json`, {
    Base: { prototype: 16087, location: [90, 95] }, Critter: { inventory: npc.inventory },
  }])
  await fs.writeFile(path.join(directory, 'archives', `${mapId}.zip`), storedZip(entries))
  await fs.writeFile(path.join(directory, 'archives', 'Prototypes.zip'), storedZip([
    ['Prototypes/Npc/16086.json', { Base: { type: 'Pc', prototype: 16086, location: start, flags: [] } }],
    ['Prototypes/Wall/2200.json', { Base: { type: 'Wall', prototype: 2200, location: [0, 0], flags: [] } }],
    ['Prototypes/Portal/2028.json', {
      Base: { type: 'Portal', prototype: 2028, location: [0, 0], flags: [] },
      Portal: { flags: ['Locked', 'NeverLocked'], keyID: 0, lockDifficulty: 0 },
      Visual: { classes: { current: { type: 'Portal', category: 'Door', side: 6 } } },
    }],
    ['Prototypes/Container/3044.json', {
      Base: { type: 'Container', prototype: 3044, location: [0, 0], flags: [] },
      Container: { flags: ['Locked', 'NeverLocked'], inventoryIndex: 0, inventorySource: 0 },
    }],
    ['Prototypes/Gold/9076.json', {
      Base: { type: 'Gold', prototype: 9076, location: [0, 0], flags: ['NoBlock'] },
      Item: { invLocation: 0 }, Gold: { quantity: 1 },
    }],
    ['Prototypes/Npc/16087.json', {
      Base: { type: 'Npc', prototype: 16087, location: [0, 0], flags: ['NoBlock'] },
      Critter: { inventoryIndex: 0, inventorySource: 0 },
    }],
  ]))
  await fs.writeFile(path.join(directory, '16086.json'), JSON.stringify({ Base: { prototype: 16086, location: start } }))
  return directory
}

async function setup(t: import("node:test").TestContext, options: {serverOptions?: object; doors?: object[]; containers?: object[]; items?: object[]; npcInventories?: object[]} = {}) {
  const dataPath = await fixture(options)
  const sockets = []
  const server = createAuthorityServer({ dataPath, mapId, tickMs: 20, ...options.serverOptions })
  t.after(async () => {
    for (const client of sockets) client.socket.disconnect()
    await server.stop()
    await fs.rm(dataPath, { recursive: true, force: true })
  })
  const connection = await server.start()
  assert.equal(connection.host, '127.0.0.1')
  assert.equal(connection.version, 2)
  assert.equal(connection.mapId, mapId)
  assert.ok(Number.isInteger(connection.port) && connection.port > 0)
  assert.notEqual(connection.ownerToken, connection.observerToken)
  async function connect(auth, url = connection.url) {
    const socket = io(url, {
      auth, autoConnect: false, reconnection: false, forceNew: true,
      transports: ['websocket'], timeout: 2000,
    })
    const client = { socket, snapshots: [] }
    sockets.push(client)
    socket.on('authority:snapshot', snapshot => client.snapshots.push(snapshot))
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve)
      socket.once('connect_error', reject)
      socket.connect()
    })
    return client
  }
  return { dataPath, server, connection, connect }
}

function join(client, version = 2) {
  return client.socket.timeout(2000).emitWithAck('authority:join', { version })
}

function command(client, id, target, changes = {}) {
  return client.socket.timeout(2000).emitWithAck('authority:command', {
    version: 2, id, actorId: '0', type: 'move', target, ...changes,
  })
}

function use(client, id, name, changes = {}) {
  return client.socket.timeout(2000).emitWithAck('authority:command', {
    version: 2, id, actorId: '0', type: 'use', targetId: doorId(name), ...changes,
  })
}

function checkpoint(client, id, type, changes = {}) {
  return client.socket.timeout(2000).emitWithAck('authority:command', {
    version: 2, id, actorId: '0', type, ...changes,
  })
}

function useContainer(client, id, name, changes = {}) {
  return use(client, id, name, { targetId: containerId(name), ...changes })
}

function inspect(client, id, name, changes = {}) {
  return checkpoint(client, id, 'inspect', { targetId: containerId(name), ...changes })
}

function actor(snapshot) {
  assert.equal(snapshot.version, 2)
  assert.equal(snapshot.mapId, mapId)
  assert.ok(Number.isInteger(snapshot.revision) && snapshot.revision >= 0)
  assert.ok(Number.isFinite(snapshot.serverTime))
  assert.equal(snapshot.actors.length, 1)
  assert.equal(snapshot.actors[0].id, '0')
  return snapshot.actors[0]
}

async function snapshotWhere(client, predicate, timeout = 4500) {
  const existing = client.snapshots.find(predicate)
  if (existing) return existing
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`No matching authority snapshot in ${timeout}ms; last=${JSON.stringify(client.snapshots.at(-1))}`))
    }, timeout)
    function cleanup() {
      clearTimeout(timer)
      client.socket.off('authority:snapshot', receive)
    }
    function receive(snapshot) {
      if (!predicate(snapshot)) return
      cleanup()
      resolve(snapshot)
    }
    client.socket.on('authority:snapshot', receive)
  })
}

function rejection(response, code: string, id?: number) {
  assert.equal(response.ok, false)
  assert.equal(response.version, 2)
  assert.equal(response.code, code)
  if (id !== undefined) assert.equal(response.id, id)
  assert.equal(typeof response.reason, 'string')
  assert.ok(response.reason.length > 0)
  assert.ok(Number.isInteger(response.revision))
}

test('authority handshake rejects unknown tokens and incompatible protocol versions', { timeout: 10000 }, async t => {
  assert.equal(typeof globalThis.window, 'undefined')
  const context = await setup(t)
  await assert.rejects(context.connect({ version: 2, token: 'not-a-session-token' }), (error: import("./fixture-types.cjs").FixtureError) => {
    assert.equal(error.data.code, 'UNAUTHORIZED')
    return true
  })
  await assert.rejects(context.connect({ version: 3, token: context.connection.ownerToken }), (error: import("./fixture-types.cjs").FixtureError) => {
    assert.equal(error.data.code, 'VERSION_MISMATCH')
    return true
  })
  const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
  rejection(await command(owner, 1, [93, 99]), 'NOT_JOINED', 1)
  rejection(await join(owner, 3), 'VERSION_MISMATCH')
  const joined = await join(owner)
  assert.equal(joined.ok, true)
  assert.equal(joined.role, 'owner')
  assert.equal(joined.actorId, '0')
  assert.deepEqual(actor(joined.snapshot).location, start)
})

test('real sockets observe autonomous movement and identical revisioned state without any renderer', { timeout: 10000 }, async t => {
  const context = await setup(t)
  const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
  const observer = await context.connect({ version: 2, token: context.connection.observerToken })
  const ownerJoin = await join(owner), observerJoin = await join(observer)
  assert.equal(observerJoin.role, 'observer')
  assert.deepEqual(actor(ownerJoin.snapshot).location, start)
  assert.deepEqual(actor(observerJoin.snapshot).location, start)
  const accepted = await command(owner, 1, [93, 99])
  assert.equal(accepted.ok, true)
  assert.equal(accepted.status, 'accepted')
  assert.deepEqual(accepted.path, [[92, 99], [93, 99]])
  const progressing = await snapshotWhere(observer, snapshot => {
    const state = actor(snapshot)
    return state.movement?.commandId === 1 && state.movement.progress > 0 && state.movement.progress < 1
  })
  const walking = actor(progressing)
  assert.deepEqual(walking.location, start, 'fractional presentation must not replace the last crossed tile')
  assert.equal(walking.movement.index, 0)
  assert.equal(walking.movement.durationMs, 1000)
  assert.ok(walking.movement.elapsedMs > 0 && walking.movement.elapsedMs < 1000)
  const sameRevision = await snapshotWhere(owner, snapshot => snapshot.revision === progressing.revision)
  assert.deepEqual(sameRevision, progressing)
  const complete = snapshot => actor(snapshot).lastCommand?.id === 1 && actor(snapshot).lastCommand.status === 'completed'
  const ownerComplete = await snapshotWhere(owner, complete)
  const observerComplete = await snapshotWhere(observer, complete)
  assert.deepEqual(observerComplete, ownerComplete)
  assert.deepEqual(actor(ownerComplete).location, [93, 99])
  assert.equal(actor(ownerComplete).movement, null)
  assert.ok(ownerComplete.revision > progressing.revision)
  assert.deepEqual(actor(context.server.getSnapshot()).location, [93, 99])
  assert.equal(typeof globalThis.window, 'undefined')
})

test('authority rejects malformed, blocked, void, unreachable and unauthorized movement without mutating actors', { timeout: 10000 }, async t => {
  const context = await setup(t)
  const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
  const observer = await context.connect({ version: 2, token: context.connection.observerToken })
  await join(owner)
  await join(observer)
  const before = actor(context.server.getSnapshot())
  rejection(await command(observer, 100, [93, 99]), 'FORBIDDEN', 100)
  rejection(await command(owner, 100, [93, 99], { actorId: 'someone-else' }), 'FORBIDDEN', 100)
  rejection(await command(owner, 100, [93, 99], { version: 3 }), 'VERSION_MISMATCH', 100)
  const malformed = [
    { id: 0 }, { id: -1 }, { id: 1.5 }, { id: '1' },
    { id: Number.MAX_SAFE_INTEGER + 1 },
    { type: 'teleport' }, { target: [93.5, 99] }, { target: [93, 99.5] },
    { target: ['93', 99] }, { target: [93] }, { target: [93, 99, 0] }, { target: null },
    { target: [Number.MAX_SAFE_INTEGER + 1, 99] }, { target: { x: 93, y: 99 } },
    { location: [93, 99] },
  ]
  for (const changes of malformed) {
    rejection(await command(owner, 1, [93, 99], changes), 'INVALID_COMMAND')
  }
  let id = 1
  const destinations = [
    [[-1, 99], 'OUT_OF_BOUNDS'], [[128, 99], 'OUT_OF_BOUNDS'], [[92, 192], 'OUT_OF_BOUNDS'],
    [[93, 100], 'BLOCKED'], [[92, 100], 'BLOCKED'], [[94, 100], 'BLOCKED'],
    [[98, 99], 'NO_PATH'], [[92, 191], 'NO_PATH'],
  ] as const
  for (const [target, code] of destinations) {
    rejection(await command(owner, id, target), code, id)
    assert.deepEqual(actor(context.server.getSnapshot()), before, `rejection at ${target} mutated authoritative state`)
    id++
  }
  const completed = await command(owner, id, start)
  assert.equal(completed.ok, true)
  assert.equal(completed.status, 'completed')
  assert.deepEqual(completed.path, [start])
  assert.deepEqual(actor(context.server.getSnapshot()).location, start)
})

test('command IDs cannot execute again while moving, after completion, or after owner reconnect', { timeout: 10000 }, async t => {
  const context = await setup(t)
  const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
  await join(owner)
  assert.equal((await command(owner, 1, [93, 99])).ok, true)
  rejection(await command(owner, 1, [94, 99]), 'REPLAYED_COMMAND', 1)
  rejection(await command(owner, 2, [94, 99]), 'BUSY', 2)
  await snapshotWhere(owner, snapshot => actor(snapshot).lastCommand?.status === 'completed')
  const completed = actor(context.server.getSnapshot())
  rejection(await command(owner, 1, [94, 99]), 'REPLAYED_COMMAND', 1)
  assert.deepEqual(actor(context.server.getSnapshot()), completed)
  owner.socket.disconnect()
  const reconnected = await context.connect({ version: 2, token: context.connection.ownerToken })
  const joined = await join(reconnected)
  assert.equal(joined.nextCommandId, 3, 'a rejected BUSY command still consumes its well-formed ID')
  rejection(await command(reconnected, 2, [94, 99]), 'REPLAYED_COMMAND', 2)
  assert.deepEqual(actor(context.server.getSnapshot()), completed)
  assert.equal((await command(reconnected, 3, [94, 99])).ok, true)
  await snapshotWhere(reconnected, snapshot => actor(snapshot).lastCommand?.id === 3 && actor(snapshot).lastCommand.status === 'completed')
  assert.deepEqual(actor(context.server.getSnapshot()).location, [94, 99])
})

test('owner disconnect does not stop server movement observed by another authenticated client', { timeout: 10000 }, async t => {
  const context = await setup(t)
  const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
  const observer = await context.connect({ version: 2, token: context.connection.observerToken })
  await join(owner)
  await join(observer)
  assert.equal((await command(owner, 1, [94, 99])).ok, true)
  await snapshotWhere(observer, snapshot => actor(snapshot).movement?.progress > 0)
  owner.socket.disconnect()
  const complete = await snapshotWhere(observer, snapshot => actor(snapshot).lastCommand?.status === 'completed')
  assert.deepEqual(actor(complete).location, [94, 99])
  assert.equal(actor(complete).movement, null)
  const reconnected = await context.connect({ version: 2, token: context.connection.ownerToken })
  assert.deepEqual(actor((await join(reconnected)).snapshot).location, [94, 99])
})

async function openFixtureArchives(directory) {
  if (process.platform !== 'linux') return []
  const descriptors = await fs.readdir('/proc/self/fd')
  const links = await Promise.all(descriptors.map(async fd => {
    try { return await fs.readlink(`/proc/self/fd/${fd}`) } catch { return '' }
  }))
  return links.filter(filename => filename.startsWith(directory + path.sep) && filename.endsWith('.zip'))
}

test('stop disconnects sockets, releases the loopback listener and ZIP handles, and cancels the movement clock', { timeout: 10000 }, async t => {
  const context = await setup(t)
  const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
  const observer = await context.connect({ version: 2, token: context.connection.observerToken })
  await join(owner)
  await join(observer)
  assert.equal((await command(owner, 1, [96, 99])).ok, true)
  await snapshotWhere(observer, snapshot => actor(snapshot).movement?.progress > 0)
  const disconnected = [owner, observer].map(client => new Promise(resolve => client.socket.once('disconnect', resolve)))
  await context.server.stop()
  await Promise.all(disconnected)
  assert.equal(context.server.stopped, true)
  assert.equal(context.server.timer, null)
  assert.equal(owner.socket.connected, false)
  assert.equal(observer.socket.connected, false)
  const stoppedActor = actor(context.server.getSnapshot())
  await new Promise(resolve => setTimeout(resolve, 120))
  assert.deepEqual(actor(context.server.getSnapshot()), stoppedActor)
  assert.deepEqual(await openFixtureArchives(context.dataPath), [])
  const probe = net.createServer()
  await new Promise<void>((resolve, reject) => {
    probe.once('error', reject)
    probe.listen(context.connection.port, '127.0.0.1', resolve)
  })
  await new Promise<void>((resolve, reject) => probe.close(error => error ? reject(error) : resolve()))
  await context.server.stop() // Shutdown remains safe when called by teardown again.
})

test('failed startup closes opened archives and restores process-global path adapters', { timeout: 10000 }, async t => {
  for (const failure of ['missing actor', 'corrupt map archive'] as const) {
    await t.test(failure, async t => {
      const dataPath = await fixture()
      const previous = { AGate: globalThis.AGate, lll: globalThis.lll, lle: globalThis.lle }
      if (failure === 'missing actor') await fs.unlink(path.join(dataPath, '16086.json'))
      else await fs.writeFile(path.join(dataPath, 'archives', `${mapId}.zip`), 'not a ZIP archive')
      const server = createAuthorityServer({ dataPath, mapId, tickMs: 20 })
      t.after(async () => {
        await server.stop()
        await fs.rm(dataPath, { recursive: true, force: true })
      })
      await assert.rejects(server.start(), failure === 'missing actor' ? /Missing converted actor: 16086/ : /zip|archive|header/i)
      assert.equal(server.stopped, true)
      assert.equal(server.timer, null)
      assert.deepEqual(await openFixtureArchives(dataPath), [])
      assert.equal(globalThis.AGate, previous.AGate)
      assert.equal(globalThis.lll, previous.lll)
      assert.equal(globalThis.lle, previous.lle)
    })
  }
})

test('owner approaches a door on the server clock, observers agree, and prototype flags remain untouched', { timeout: 12000 }, async t => {
  const context = await setup(t, { doors: [
    { name: 'front', location: [94, 99] }, { name: 'other', location: [96, 99] },
  ] })
  const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
  const observer = await context.connect({ version: 2, token: context.connection.observerToken })
  const initial = (await join(owner)).snapshot
  await join(observer)
  const initialDoor = initial.doors.find(door => door.id === doorId('front'))
  assert.deepEqual(initialDoor, { id: doorId('front'), kind: 'door', label: 'Door', location: [94, 99],
    open: false, locked: false, usable: true, closedFrame: 0, openFrame: 6 })
  assert.equal(context.server.map.isTileBlocked(94, 99), true)
  const states = context.server.doors.states
  const front = states.get(doorId('front')).entity, other = states.get(doorId('other')).entity
  // Normal ECS components now isolate inherited mutable values. Deliberately
  // alias the prototype flags here to retain the adversarial collision fixture.
  const inheritedFlags = Reflect.get(front.portal, '_prototype').flags
  for (const portal of [front.portal, other.portal]) Object.defineProperty(portal, 'flags', {
    value: inheritedFlags, configurable: true, writable: true, enumerable: true
  })
  assert.equal(front.portal.flags === other.portal.flags, true, 'fixture really shares inherited flags')
  const originalFlags = front.portal.flags.toPlainObject()
  const accepted = await use(owner, 1, 'front')
  assert.equal(accepted.status, 'accepted')
  assert.deepEqual(accepted.path, [[92, 99], [93, 99]])
  assert.equal(accepted.targetId, doorId('front'))
  rejection(await use(owner, 1, 'front'), 'REPLAYED_COMMAND', 1)
  rejection(await use(owner, 2, 'other'), 'BUSY', 2)
  rejection(await use(observer, 100, 'front'), 'FORBIDDEN', 100)
  const walking = await snapshotWhere(observer, snapshot => actor(snapshot).movement?.progress > 0)
  assert.equal(walking.doors.find(door => door.id === doorId('front')).open, false)
  const completed = await snapshotWhere(observer, snapshot => actor(snapshot).lastCommand?.id === 1 &&
    actor(snapshot).lastCommand.status === 'completed')
  assert.deepEqual(await snapshotWhere(owner, snapshot => snapshot.revision === completed.revision), completed)
  assert.deepEqual(actor(completed).location, [93, 99])
  assert.deepEqual(actor(completed).lastCommand, { id: 1, type: 'use', targetId: doorId('front'),
    status: 'completed', result: { targetId: doorId('front'), open: true } })
  assert.equal(context.server.map.isTileBlocked(94, 99), false)
  assert.equal(other.portalOpen, false)
  assert.deepEqual(front.portal.flags.toPlainObject(), originalFlags)
  assert.deepEqual(other.portal.flags.toPlainObject(), originalFlags)
  rejection(await use(owner, 1, 'front'), 'REPLAYED_COMMAND', 1)
  assert.equal(front.portalOpen, true, 'replay did not toggle twice')
  assert.equal((await command(owner, 3, [94, 99])).status, 'accepted')
  await snapshotWhere(owner, snapshot => actor(snapshot).lastCommand?.id === 3 && actor(snapshot).lastCommand.status === 'completed')
  rejection(await use(owner, 4, 'front'), 'OCCUPIED', 4)
  assert.equal(front.portalOpen, true)
  assert.equal((await command(owner, 5, [93, 99])).status, 'accepted')
  await snapshotWhere(owner, snapshot => actor(snapshot).lastCommand?.id === 5 && actor(snapshot).lastCommand.status === 'completed')
  const closed = await use(owner, 6, 'front')
  assert.equal(closed.status, 'completed')
  assert.deepEqual(closed.path, [[93, 99]])
  assert.deepEqual(closed.result, { targetId: doorId('front'), open: false })
  assert.equal(context.server.map.isTileBlocked(94, 99), true)
  assert.deepEqual(front.portal.flags.toPlainObject(), originalFlags)
})

test('use validates exact object identity, shape and unsupported lock policies before walking', { timeout: 10000 }, async t => {
  const context = await setup(t, { doors: [
    { name: 'locked', location: [92, 102], flags: ['Locked'] },
    { name: 'always-locked', location: [100, 102], flags: ['Locked', 'AlwaysLocked'] },
    { name: 'jammed', location: [93, 102], flags: ['Jammed'] },
    { name: 'magic', location: [94, 102], flags: ['MagicallyHeld'] },
    { name: 'timed', location: [95, 102], flags: ['Locked', 'LockedDay'] },
    { name: 'window', location: [96, 102], visual: { category: 'Window' } },
    { name: 'hidden', location: [97, 102], baseFlags: ['DontDraw'] },
    { name: 'unknown-art', location: [98, 102], visual: { side: -1 } },
    { name: 'never-timed', location: [99, 102], flags: ['Locked', 'NeverLocked', 'LockedNight'] },
  ] })
  const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
  const joined = await join(owner)
  assert.equal(joined.snapshot.doors.length, 7)
  const neverTimed = joined.snapshot.doors.find(door => door.id === doorId('never-timed'))
  assert.equal(neverTimed.locked, false)
  assert.equal(neverTimed.usable, true, 'NeverLocked takes precedence before time-dependent locks')
  const badArt = joined.snapshot.doors.find(door => door.id === doorId('unknown-art'))
  assert.equal(badArt.usable, false)
  assert.equal(badArt.openFrame, undefined)
  assert.equal(badArt.closedFrame, undefined)
  const malformed = [{ targetId: null }, { targetId: '' }, { targetId: 5 }, { targetId: 'x'.repeat(1025) },
    { target: [93, 99] }, { location: [93, 99] }, { id: 1.5 }]
  for (const changes of malformed) rejection(await use(owner, 1, 'locked', changes), 'INVALID_COMMAND')
  rejection(await use(owner, 1, 'locked', { actorId: 'another' }), 'FORBIDDEN', 1)
  const cases = [['locked', 'LOCKED'], ['always-locked', 'UNSUPPORTED_DOOR'], ['jammed', 'UNSUPPORTED_DOOR'], ['magic', 'UNSUPPORTED_DOOR'],
    ['timed', 'UNSUPPORTED_DOOR'], ['window', 'UNKNOWN_TARGET'], ['hidden', 'UNKNOWN_TARGET'],
    ['missing', 'UNKNOWN_TARGET'], ['unknown-art', 'UNSUPPORTED_DOOR']] as const
  for (let index = 0; index < cases.length; index++) {
    rejection(await use(owner, index + 1, cases[index][0]), cases[index][1], index + 1)
    assert.deepEqual(actor(context.server.getSnapshot()).location, start)
    assert.equal(actor(context.server.getSnapshot()).movement, null)
  }
})

test('unreachable door cannot make the destination or diagonal adjacency walkable', { timeout: 10000 }, async t => {
  const context = await setup(t, { doors: [
    { name: 'isolated', location: [98, 99] }, { name: 'diagonal', location: [93, 100] },
  ] })
  const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
  await join(owner)
  const approach = await use(owner, 1, 'diagonal')
  assert.equal(approach.status, 'accepted', 'diagonal proximity is not an immediate interaction')
  assert.deepEqual(approach.path, [[92, 99], [93, 99]])
  await snapshotWhere(owner, snapshot => actor(snapshot).lastCommand?.id === 1 && actor(snapshot).lastCommand.status === 'completed')
  rejection(await use(owner, 2, 'isolated'), 'NO_PATH', 2)
  assert.equal(context.server.doors.states.get(doorId('isolated')).entity.portalOpen, false)
  assert.deepEqual(actor(context.server.getSnapshot()).location, [93, 99])
})

test('initial nonzero converted frame opens collision before spawn and orientation selects terminal frame', { timeout: 10000 }, async t => {
  const context = await setup(t, { doors: [{ name: 'initial-open', location: start,
    baseFlags: ['NoBlock'], visual: { side: 3, stage: 'SouthEast' } }] })
  const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
  const descriptor = (await join(owner)).snapshot.doors[0]
  assert.equal(descriptor.open, true)
  assert.equal(descriptor.openFrame, 3)
  const door = context.server.doors.states.get(doorId('initial-open')).entity
  assert.equal(door.portalOpen, true)
  const originalFlags = door.base.flags.toPlainObject()
  assert.deepEqual(originalFlags, ['NoBlock'])
  rejection(await use(owner, 1, 'initial-open'), 'OCCUPIED', 1)
  assert.equal((await command(owner, 2, [93, 99])).status, 'accepted')
  await snapshotWhere(owner, snapshot => actor(snapshot).lastCommand?.id === 2 && actor(snapshot).lastCommand.status === 'completed')
  const closed = await use(owner, 3, 'initial-open')
  assert.equal(closed.status, 'completed')
  assert.deepEqual(closed.result, { targetId: doorId('initial-open'), open: false })
  assert.equal(door.portalOpen, false)
  assert.equal(context.server.map.isTileBlocked(...start), true, 'authoritative closed state overrides converted NoBlock')
  assert.deepEqual(door.base.flags.toPlainObject(), originalFlags, 'closing does not mutate converted/prototype flags')
})

test('approach revalidates changed targets, locks and newly blocked routes without applying a second toggle', { timeout: 12000 }, async t => {
  for (const scenario of ['removed', 'moved', 'locked', 'blocked', 'state changed'] as const) {
    await t.test(scenario, async t => {
      const context = await setup(t, { doors: [{ name: 'front', location: [94, 99] }] })
      const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
      await join(owner)
      assert.equal((await use(owner, 1, 'front')).status, 'accepted')
      const state = context.server.doors.states.get(doorId('front'))
      if (scenario === 'removed') context.server.world.entityManager.entities.delete(state.entity.id)
      if (scenario === 'moved') state.entity.base.location.set([94, 98])
      if (scenario === 'locked') {
        // Fixture supplies its own flags here: do not mutate an inherited object.
        const Flags = state.entity.portal.flags.constructor
        const replacement = new Flags()
        replacement.set(['Locked'])
        Object.defineProperty(state.entity.portal, 'flags', { value: replacement, configurable: true, writable: true })
      }
      if (scenario === 'blocked') context.server.map.getTile(93, 99).blocked = true
      if (scenario === 'state changed') { state.open = true; state.entity.portalOpen = true }
      const interrupted = await snapshotWhere(owner, snapshot => actor(snapshot).lastCommand?.status === 'interrupted')
      const result = actor(interrupted).lastCommand
      assert.equal(result.type, 'use')
      assert.equal(result.targetId, doorId('front'))
      assert.equal(result.code, scenario === 'blocked' ? 'BLOCKED' : scenario === 'locked' ? 'LOCKED' : 'TARGET_CHANGED')
      assert.equal(typeof result.message, 'string')
      assert.equal(actor(interrupted).movement, null)
      assert.equal(state.open, scenario === 'state changed')
      assert.equal(state.entity.portalOpen, scenario === 'state changed')
      rejection(await use(owner, 1, 'front'), 'REPLAYED_COMMAND', 1)
    })
  }
})

test('owner saves and restores actor occupancy and open door collision while observers receive the same committed state', { timeout: 14000 }, async t => {
  const context = await setup(t, { doors: [{ name: 'front', location: [94, 99] }] })
  const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
  const observer = await context.connect({ version: 2, token: context.connection.observerToken })
  assert.deepEqual((await join(owner)).snapshot.checkpoint, { supported: true, busy: false })
  await join(observer)
  assert.equal((await use(owner, 1, 'front')).status, 'accepted')
  await snapshotWhere(owner, snapshot => actor(snapshot).lastCommand?.id === 1 && !actor(snapshot).movement)
  assert.equal((await command(owner, 2, [94, 99])).status, 'accepted')
  await snapshotWhere(owner, snapshot => actor(snapshot).lastCommand?.id === 2 && !actor(snapshot).movement)
  const saved = await checkpoint(owner, 3, 'save')
  assert.equal(saved.ok, true)
  assert.equal(saved.status, 'completed')
  assert.equal(saved.result.kind, 'save')
  const filename = path.join(context.dataPath, 'saves', 'local-checkpoint.json')
  const bytes = await fs.readFile(filename, 'utf8')
  const document = JSON.parse(bytes)
  assert.equal(document.format, 'openarcanum-local-checkpoint')
  assert.equal(document.version, 7)
  assert.equal(document.rulesVersion, 'movement-doors-ownership-attributes-weight-scripts-v11')
  assert.match(document.contentIdentity, /^[a-f0-9]{64}$/)
  assert.deepEqual(document.actor, { id: '0', location: [94, 99] })
  assert.deepEqual(document.doors, [{ id: doorId('front'), open: true }])
  assert.equal(bytes.includes(context.connection.ownerToken), false)
  assert.equal(bytes.includes(context.connection.observerToken), false)
  assert.equal(bytes.includes(context.dataPath), false)
  assert.equal((await command(owner, 4, [93, 99])).status, 'accepted')
  await snapshotWhere(owner, snapshot => actor(snapshot).lastCommand?.id === 4 && !actor(snapshot).movement)
  assert.equal((await use(owner, 5, 'front')).result.open, false)
  const beforeRevision = context.server.revision
  const loaded = await checkpoint(owner, 6, 'load')
  assert.equal(loaded.ok, true)
  assert.deepEqual(loaded.result, { kind: 'load', savedAt: saved.result.savedAt })
  assert.ok(loaded.revision > beforeRevision)
  const restored = await snapshotWhere(owner, snapshot => actor(snapshot).lastCommand?.id === 6)
  assert.deepEqual(await snapshotWhere(observer, snapshot => snapshot.revision === restored.revision), restored)
  assert.deepEqual(actor(restored).location, [94, 99])
  assert.deepEqual(actor(restored).lastCommand, { id: 6, type: 'load', status: 'completed', result: loaded.result })
  assert.equal(restored.doors[0].open, true)
  assert.equal(context.server.map.isTileBlocked(94, 99), true, 'restored player occupies the open doorway')
  const openDoor = context.server.doors.states.get(doorId('front'))
  assert.equal(openDoor.entity.portalOpen, true)
  assert.equal(context.server.map.getTile(93, 99).Pc?.['0'], undefined, 'old occupancy was removed')
  assert.equal(context.server.map.getTile(94, 99).Pc?.['0'], context.server.player)
  assert.deepEqual(openDoor.entity.portal.flags.toPlainObject(), ['Locked', 'NeverLocked'])
  assert.deepEqual(restored.checkpoint, { supported: true, busy: false, lastAction: 'load', savedAt: saved.result.savedAt })
  rejection(await checkpoint(owner, 3, 'save'), 'REPLAYED_COMMAND', 3)
  rejection(await checkpoint(owner, 6, 'load'), 'REPLAYED_COMMAND', 6)
  assert.equal((await join(owner)).nextCommandId, 7, 'loading an older save never rewinds live command IDs')
})

test('explicit load restores a checkpoint after server restart without auto-loading or reusing old credentials', { timeout: 12000 }, async t => {
  const context = await setup(t)
  const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
  await join(owner)
  await command(owner, 1, [93, 99])
  await snapshotWhere(owner, snapshot => actor(snapshot).lastCommand?.id === 1 && !actor(snapshot).movement)
  assert.equal((await checkpoint(owner, 2, 'save')).ok, true)
  await context.server.stop()
  const restarted = createAuthorityServer({ dataPath: context.dataPath, mapId, tickMs: 20 })
  t.after(() => restarted.stop())
  const session = await restarted.start()
  assert.notEqual(session.ownerToken, context.connection.ownerToken)
  const newOwner = await context.connect({ version: 2, token: session.ownerToken }, session.url)
  const initial = (await join(newOwner)).snapshot
  assert.deepEqual(actor(initial).location, start, 'startup remains an explicit fresh development session')
  assert.deepEqual(initial.checkpoint, { supported: true, busy: false })
  assert.equal((await checkpoint(newOwner, 1, 'load')).ok, true)
  assert.deepEqual(actor(restarted.getSnapshot()).location, [93, 99])
  assert.equal((await join(newOwner)).nextCommandId, 2)
})

test('save/load uses strict owner command schemas and cannot interrupt movement or a pending door approach', { timeout: 10000 }, async t => {
  const context = await setup(t, { doors: [{ name: 'front', location: [94, 99] }] })
  const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
  const observer = await context.connect({ version: 2, token: context.connection.observerToken })
  await join(owner)
  await join(observer)
  rejection(await checkpoint(observer, 100, 'save'), 'FORBIDDEN', 100)
  rejection(await checkpoint(observer, 101, 'load'), 'FORBIDDEN', 101)
  rejection(await checkpoint(owner, 1, 'save', { actorId: 'another' }), 'FORBIDDEN', 1)
  for (const changes of [{ target: start }, { targetId: doorId('front') }, { slot: '../../escape' },
    { document: {} }, { id: 0 }, { id: '1' }] as const) {
    rejection(await checkpoint(owner, 1, 'save', changes), 'INVALID_COMMAND')
  }
  assert.equal((await use(owner, 1, 'front')).status, 'accepted')
  rejection(await checkpoint(owner, 2, 'save'), 'BUSY', 2)
  rejection(await checkpoint(owner, 3, 'load'), 'BUSY', 3)
  await snapshotWhere(owner, snapshot => actor(snapshot).lastCommand?.id === 1 && !actor(snapshot).movement)
  assert.equal(context.server.doors.states.get(doorId('front')).open, true)
  await command(owner, 4, start)
  rejection(await checkpoint(owner, 5, 'save'), 'BUSY', 5)
  await snapshotWhere(owner, snapshot => actor(snapshot).lastCommand?.id === 4 && !actor(snapshot).movement)
  assert.equal((await join(owner)).nextCommandId, 6)
})

test('checkpoint load rejects malformed, incomplete, incompatible and blocked candidate worlds without partial restoration', { timeout: 14000 }, async t => {
  const context = await setup(t, { doors: [
    { name: 'front', location: [94, 99] },
    { name: 'unsupported', location: [96, 102], visual: { side: -1 } },
    { name: 'locked', location: [97, 102], flags: ['Locked'] },
  ] })
  const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
  await join(owner)
  rejection(await checkpoint(owner, 1, 'load'), 'CHECKPOINT_NOT_FOUND', 1)
  assert.equal((await checkpoint(owner, 2, 'save')).ok, true)
  const filename = path.join(context.dataPath, 'saves', 'local-checkpoint.json')
  const saved = JSON.parse(await fs.readFile(filename, 'utf8'))
  const cases = [
    ['extra document field', value => { value.token = 'untrusted' }],
    ['missing actor field', value => { delete value.actor.id }],
    ['extra actor field', value => { value.actor.hp = 500 }],
    ['fractional position', value => { value.actor.location = [92.5, 99] }],
    ['out of bounds', value => { value.actor.location = [-1, 99] }],
    ['void position', value => { value.actor.location = [94, 100] }],
    ['blocked terrain', value => { value.actor.location = [93, 100] }],
    ['solid wall', value => { value.actor.location = [92, 100] }],
    ['closed door', value => { value.actor.location = [94, 99] }],
    ['invalid timestamp', value => { value.savedAt = 'yesterday' }],
    ['missing door', value => { value.doors.pop() }],
    ['unknown door', value => { value.doors[0].id = 'unknown' }],
    ['duplicate door', value => { value.doors[1] = { ...value.doors[0] } }],
    ['string state', value => { value.doors[0].open = 'true' }],
    ['extra door field', value => { value.doors[0].locked = false }],
    ['unsupported pose', value => { value.doors.find(door => door.id === doorId('unsupported')).open = true }],
    ['locked pose bypass', value => { value.doors.find(door => door.id === doorId('locked')).open = true }],
    ['content mismatch', value => { value.contentIdentity = 'a'.repeat(64) }, 'CHECKPOINT_INCOMPATIBLE'],
    ['map mismatch', value => { value.mapId = 'Another map' }, 'CHECKPOINT_INCOMPATIBLE'],
    ['rules mismatch', value => { value.rulesVersion = 'future-rules' }, 'CHECKPOINT_INCOMPATIBLE'],
    ['version mismatch', value => { value.version = 8 }, 'CHECKPOINT_INCOMPATIBLE'],
  ] as const
  let id = 3
  for (const [name, change, code = 'CHECKPOINT_INVALID'] of cases) {
    const value = structuredClone(saved)
    change(value)
    // Open a usable door in every rejected candidate too, proving that an
    // invalid actor/other door never leaves earlier door changes committed.
    const front = value.doors.find(door => door.id === doorId('front'))
    if (name !== 'closed door' && front?.open === false) front.open = true
    await fs.writeFile(filename, JSON.stringify(value))
    const before = context.server.getSnapshot()
    rejection(await checkpoint(owner, id, 'load'), code, id)
    const after = context.server.getSnapshot()
    assert.deepEqual(after.actors, before.actors, name)
    assert.deepEqual(after.doors, before.doors, name)
    assert.equal(after.checkpoint.busy, false)
    assert.equal(after.checkpoint.error.code, code)
    assert.equal(JSON.stringify(after.checkpoint).includes(context.dataPath), false)
    id++
  }
  await fs.writeFile(filename, '{not valid JSON')
  rejection(await checkpoint(owner, id, 'load'), 'CHECKPOINT_INVALID', id)
})

test('checkpoint IO serializes all mutations, publishes coherent busy state, and preserves the previous save on write failure', { timeout: 10000 }, async t => {
  const context = await setup(t, { doors: [{ name: 'front', location: [94, 99] }] })
  const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
  const observer = await context.connect({ version: 2, token: context.connection.observerToken })
  await join(owner)
  await join(observer)
  await checkpoint(owner, 1, 'save')
  const filename = path.join(context.dataPath, 'saves', 'local-checkpoint.json')
  const original = await fs.readFile(filename, 'utf8')
  const write = context.server.checkpointStore.write.bind(context.server.checkpointStore)
  let release
  const gate = new Promise(resolve => { release = resolve })
  context.server.checkpointStore.write = async document => { await gate; return write(document) }
  const pending = checkpoint(owner, 2, 'save')
  const busy = await snapshotWhere(observer, snapshot => snapshot.checkpoint.busy && snapshot.checkpoint.lastAction === 'save')
  assert.deepEqual(await snapshotWhere(owner, snapshot => snapshot.revision === busy.revision), busy)
  rejection(await command(owner, 3, [93, 99]), 'BUSY', 3)
  rejection(await use(owner, 4, 'front'), 'BUSY', 4)
  rejection(await checkpoint(owner, 5, 'load'), 'BUSY', 5)
  release()
  assert.equal((await pending).ok, true)
  assert.equal(context.server.checkpointBusy, false)
  assert.deepEqual(actor(context.server.getSnapshot()).location, start)
  const previous = await fs.readFile(filename, 'utf8')
  context.server.checkpointStore.write = async () => {
    throw Object.assign(new Error(`private failure at ${context.dataPath}`), { code: 'EACCES' })
  }
  const failed = await checkpoint(owner, 6, 'save')
  rejection(failed, 'CHECKPOINT_IO_ERROR', 6)
  assert.equal(JSON.stringify(failed).includes(context.dataPath), false)
  assert.equal(await fs.readFile(filename, 'utf8'), previous)
  assert.notEqual(previous, '', 'the previous complete checkpoint remains available')
  assert.notEqual(original, '')
  assert.deepEqual(actor(context.server.getSnapshot()).location, start)
  context.server.checkpointStore.write = write
  assert.equal((await checkpoint(owner, 7, 'load')).ok, true, 'normal errors leave the authority usable')
})

test('load refuses symlink checkpoints and late IO completion cannot mutate a stopped authority', { timeout: 10000 }, async t => {
  const context = await setup(t)
  const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
  await join(owner)
  await checkpoint(owner, 1, 'save')
  const filename = path.join(context.dataPath, 'saves', 'local-checkpoint.json')
  const bytes = await fs.readFile(filename, 'utf8')
  const outside = path.join(context.dataPath, 'unrelated.json')
  await fs.writeFile(outside, bytes)
  await fs.unlink(filename)
  await fs.symlink(outside, filename)
  rejection(await checkpoint(owner, 2, 'load'), 'CHECKPOINT_IO_ERROR', 2)
  rejection(await checkpoint(owner, 3, 'save'), 'CHECKPOINT_IO_ERROR', 3)
  assert.equal(await fs.readFile(outside, 'utf8'), bytes)
  await fs.unlink(filename)
  await fs.writeFile(filename, bytes)
  let release
  const gate = new Promise(resolve => { release = resolve })
  const candidate = JSON.parse(bytes)
  candidate.actor.location = [93, 99]
  context.server.checkpointStore.read = async () => { await gate; return candidate }
  const pending = context.server.command({ data: { joined: true, role: 'owner' } },
    { version: 2, id: 4, actorId: '0', type: 'load' })
  assert.equal(context.server.checkpointBusy, true)
  await context.server.stop()
  const revision = context.server.revision
  const stopped = actor(context.server.getSnapshot())
  release()
  rejection(await pending, 'SERVER_STOPPED', 4)
  assert.deepEqual(actor(context.server.getSnapshot()), stopped)
  assert.equal(context.server.revision, revision)
})

test('checkpoint placement preflight and synchronous movement failure leave actor occupancy and doors unchanged', { timeout: 10000 }, async t => {
  const context = await setup(t, { doors: [{ name: 'front', location: [94, 99] }] })
  const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
  await join(owner)
  await checkpoint(owner, 1, 'save')
  const filename = path.join(context.dataPath, 'saves', 'local-checkpoint.json')
  const document = JSON.parse(await fs.readFile(filename, 'utf8'))
  document.actor.location = [93, 99]
  document.doors[0].open = true
  await fs.writeFile(filename, JSON.stringify(document))
  const source = context.server.map.getTile(...start)
  const target = context.server.map.getTile(93, 99)
  const original = context.server.getSnapshot()
  delete source.Pc['0']
  rejection(await checkpoint(owner, 2, 'load'), 'CHECKPOINT_INVALID', 2)
  assert.deepEqual(context.server.getSnapshot().doors, original.doors)
  assert.deepEqual(actor(context.server.getSnapshot()), actor(original))
  assert.equal(target.Pc?.['0'], undefined)
  source.Pc['0'] = context.server.player
  const move = context.server.map.moveEntity.bind(context.server.map)
  context.server.map.moveEntity = (...args) => {
    move(...args)
    throw new Error('A movement hook failed after changing occupancy')
  }
  rejection(await checkpoint(owner, 3, 'load'), 'CHECKPOINT_INVALID', 3)
  assert.deepEqual(context.server.getSnapshot().doors, original.doors)
  assert.deepEqual(actor(context.server.getSnapshot()), actor(original))
  assert.equal(source.Pc['0'], context.server.player)
  assert.equal(target.Pc?.['0'], undefined)
  context.server.map.moveEntity = move
  assert.equal((await checkpoint(owner, 4, 'load')).ok, true, 'the same valid checkpoint loads after the failed hook is removed')
  assert.equal(source.Pc['0'], undefined)
  assert.equal(target.Pc['0'], context.server.player)
  assert.equal(context.server.doors.states.get(doorId('front')).open, true)
})

test('container use approaches on the server clock and private inspection never broadcasts item records', { timeout: 10000 }, async t => {
  const entry = { id: itemId('private-gold'), slot: 0 }
  const context = await setup(t, { containers: [{ name: 'box', location: [94, 99], inventory: [entry] }],
    items: [{ name: 'private-gold', parent: containerId('box'), quantity: 62 }] })
  const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
  const observer = await context.connect({ version: 2, token: context.connection.observerToken })
  const initial = (await join(owner)).snapshot
  await join(observer)
  assert.deepEqual(initial.containers, [{ id: containerId('box'), kind: 'container', label: 'Container',
    location: [94, 99], locked: false, usable: true }])
  const state = context.server.containers.states.get(containerId('box'))
  const originalFlags = state.entity.container.flags.toPlainObject()
  rejection(await inspect(owner, 1, 'box'), 'OUT_OF_RANGE', 1)
  const accepted = await useContainer(owner, 2, 'box')
  assert.equal(accepted.status, 'accepted')
  assert.deepEqual(accepted.path, [[92, 99], [93, 99]])
  rejection(await inspect(owner, 3, 'box'), 'BUSY', 3)
  const completed = await snapshotWhere(owner, snapshot => actor(snapshot).lastCommand?.id === 2 && !actor(snapshot).movement)
  assert.deepEqual(actor(completed).lastCommand.result, { kind: 'container', targetId: containerId('box') })
  assert.deepEqual(await snapshotWhere(observer, snapshot => snapshot.revision === completed.revision), completed)
  const inspected = await inspect(owner, 4, 'box')
  assert.equal(inspected.status, 'completed')
  assert.equal(inspected.targetId, containerId('box'))
  assert.deepEqual(inspected.result, { kind: 'container', targetId: containerId('box'), items: [
    { id: entry.id, slot: 0, label: 'Gold', type: 'Gold', prototypeId: 9076, quantity: 62 },
  ] })
  const summary = await snapshotWhere(observer, snapshot => actor(snapshot).lastCommand?.id === 4)
  assert.deepEqual(actor(summary).lastCommand, { id: 4, type: 'inspect', targetId: containerId('box'), status: 'completed',
    result: { kind: 'container', targetId: containerId('box') } })
  for (const snapshot of [...owner.snapshots, ...observer.snapshots, (await join(observer)).snapshot] as const) {
    const serialized = JSON.stringify(snapshot)
    assert.equal(serialized.includes(entry.id), false, 'private item identity was not broadcast')
    assert.equal(serialized.includes('"items"'), false)
    assert.equal(serialized.includes('"quantity"'), false)
    assert.equal(serialized.includes('9076'), false)
  }
  rejection(await inspect(observer, 100, 'box'), 'FORBIDDEN', 100)
  rejection(await inspect(owner, 4, 'box'), 'REPLAYED_COMMAND', 4)
  assert.deepEqual(state.entity.container.flags.toPlainObject(), originalFlags)
  assert.deepEqual(state.entity.container.inventory, [entry])
  const item = [...context.server.map.entityManager.entities.values()].find(entity => entity.sourcePath === entry.id)
  assert.equal(item.item.parent, containerId('box'))
  assert.equal(item.base.flags.has('Inventory'), true)
  assert.equal(context.server.map.isTileBlocked(94, 99), true, 'inspection never opens container collision')
})

test('verified empty container returns an empty private view while missing metadata and locked contents remain inaccessible', { timeout: 10000 }, async t => {
  const context = await setup(t, { containers: [
    { name: 'empty', location: [93, 99] }, { name: 'missing', location: [94, 99], missing: true },
    { name: 'locked', location: [95, 99], flags: ['Locked'], inventory: [{ id: itemId('locked-gold'), slot: 0 }] },
    { name: 'hidden', location: [96, 99], baseFlags: ['DontDraw'] },
    { name: 'jammed', location: [92, 102], flags: ['Jammed'] },
    { name: 'timed', location: [93, 102], flags: ['Locked', 'LockedDay'] },
    { name: 'spawned', location: [94, 102], data: { inventorySource: 3 } },
  ], items: [{ name: 'locked-gold', parent: containerId('locked') }] })
  const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
  const initial = (await join(owner)).snapshot
  assert.equal(initial.containers.length, 6)
  assert.equal(initial.containers.find(container => container.id === containerId('empty')).usable, true)
  assert.equal((await useContainer(owner, 1, 'empty')).status, 'completed')
  assert.deepEqual((await inspect(owner, 2, 'empty')).result, { kind: 'container', targetId: containerId('empty'), items: [] })
  let id = 3
  for (const [name, code] of [['missing', 'UNSUPPORTED_CONTAINER'], ['locked', 'LOCKED'], ['hidden', 'UNKNOWN_TARGET'],
    ['jammed', 'UNSUPPORTED_CONTAINER'], ['timed', 'UNSUPPORTED_CONTAINER'], ['spawned', 'UNSUPPORTED_CONTAINER']] as const) {
    const before = actor(context.server.getSnapshot())
    rejection(await useContainer(owner, id++, name), code)
    rejection(await inspect(owner, id++, name), code)
    assert.deepEqual(actor(context.server.getSnapshot()), before)
  }
  assert.deepEqual(actor(context.server.getSnapshot()).location, start)
})

test('private inspection validates schema, actor ownership and range without choosing a route', { timeout: 10000 }, async t => {
  const context = await setup(t, { containers: [{ name: 'box', location: [94, 99] }] })
  const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
  await join(owner)
  for (const changes of [{ targetId: null }, { targetId: '' }, { targetId: 4 }, { targetId: 'x'.repeat(1025) },
    { target: [93, 99] }, { items: [] }, { slot: 0 }, { id: 0 }, { id: '1' }] as const) {
    rejection(await inspect(owner, 1, 'box', changes), 'INVALID_COMMAND')
  }
  rejection(await inspect(owner, 1, 'box', { actorId: 'another' }), 'FORBIDDEN', 1)
  rejection(await inspect(owner, 1, 'box'), 'OUT_OF_RANGE', 1)
  rejection(await inspect(owner, 2, 'missing'), 'UNKNOWN_TARGET', 2)
  rejection(await inspect(owner, 3, 'box', { targetId: doorId('unknown') }), 'UNKNOWN_TARGET', 3)
  assert.deepEqual(actor(context.server.getSnapshot()).location, start)
  assert.equal(actor(context.server.getSnapshot()).movement, null)
})

test('container ownership requires complete reciprocal parents, unique slots, inventory flags and live item types', { timeout: 15000 }, async t => {
  const cases = [
    ['missing parent', value => { delete value.items[0].parent }],
    ['wrong parent', value => { value.items[0].parent = containerId('elsewhere') }],
    ['not inventory', value => { value.items[0].base = { flags: ['NoBlock'] } }],
    ['wrong type', value => { value.items[0].base = { type: 'Scenery' } }],
    ['destroyed item', value => { value.items[0].base = { flags: ['Inventory', 'Destroyed'] } }],
    ['duplicate item', value => { value.containers[0].inventory.push({ id: itemId('gold'), slot: 1 }) }],
    ['duplicate slot', value => {
      value.containers[0].inventory.push({ id: itemId('other'), slot: 0 })
      value.items.push({ name: 'other', parent: containerId('box'), slot: 0 })
    }],
    ['missing entry', value => { value.containers[0].inventory = [] }],
    ['missing item', value => { value.items = [] }],
    ['bad entry field', value => { value.containers[0].inventory[0].quantity = 100 }],
    ['bad slot', value => { value.containers[0].inventory[0].slot = -1 }],
    ['bad count', value => { value.containers[0].data = { inventoryIndex: 2 } }],
    ['bad quantity', value => { value.items[0].quantity = 0 }],
    ['other container claim', value => {
      value.containers.push({ name: 'other-owner', location: [96, 99], inventory: [{ id: itemId('gold'), slot: 0 }] })
    }],
    ['NPC claim', value => { value.npcInventories = [{ name: 'other-owner', inventory: [{ id: itemId('gold'), slot: 0 }] }] }],
  ] as const
  for (const [name, change] of cases) await t.test(name, async t => {
    const value = { containers: [{ name: 'box', location: [93, 99], inventory: [{ id: itemId('gold'), slot: 0 }] }],
      items: [{ name: 'gold', parent: containerId('box'), slot: 0 }] }
    change(value)
    const context = await setup(t, value)
    const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
    const initial = (await join(owner)).snapshot
    assert.equal(initial.containers.find(container => container.id === containerId('box')).usable, false)
    rejection(await useContainer(owner, 1, 'box'), 'UNSUPPORTED_CONTAINER', 1)
    rejection(await inspect(owner, 2, 'box'), 'UNSUPPORTED_CONTAINER', 2)
    assert.deepEqual(actor(context.server.getSnapshot()).location, start)
  })
})

test('recovered owner array slots are independent of an item inventory or equipment location', { timeout: 10000 }, async t => {
  const context = await setup(t, { containers: [{ name: 'box', location: [93, 99], inventory: [{ id: itemId('gold'), slot: 1 }] }],
    items: [{ name: 'gold', parent: containerId('box'), slot: 2 }] })
  const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
  await join(owner)
  const result = await inspect(owner, 1, 'box')
  assert.equal(result.ok, true)
  assert.equal(result.result.items[0].slot, 1, 'view retains the sparse owner array index')
  const item = [...context.server.map.entityManager.entities.values()].find(entity => entity.sourcePath === itemId('gold'))
  assert.equal(item.item.invLocation, 2, 'original inventory placement remains independent and untouched')
})

test('container approaches reject stale location, lock and recovered content changes before inspection', { timeout: 15000 }, async t => {
  for (const scenario of ['removed', 'moved', 'locked', 'contents changed', 'route blocked'] as const) await t.test(scenario, async t => {
    const context = await setup(t, { containers: [{ name: 'box', location: [94, 99], inventory: [{ id: itemId('gold'), slot: 0 }] }],
      items: [{ name: 'gold', parent: containerId('box') }] })
    const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
    await join(owner)
    assert.equal((await useContainer(owner, 1, 'box')).status, 'accepted')
    const state = context.server.containers.states.get(containerId('box'))
    if (scenario === 'removed') context.server.world.entityManager.entities.delete(state.entity.id)
    if (scenario === 'moved') state.entity.base.location.set([94, 98])
    if (scenario === 'locked') {
      const flags = new state.entity.container.flags.constructor()
      flags.set(['Locked'])
      Object.defineProperty(state.entity.container, 'flags', { value: flags, configurable: true, writable: true })
    }
    if (scenario === 'contents changed') {
      const item = [...context.server.map.entityManager.entities.values()].find(entity => entity.sourcePath === itemId('gold'))
      Object.defineProperty(item.gold, 'quantity', { value: 63, configurable: true, writable: true })
    }
    if (scenario === 'route blocked') context.server.map.getTile(93, 99).blocked = true
    const interrupted = await snapshotWhere(owner, snapshot => actor(snapshot).lastCommand?.status === 'interrupted')
    assert.equal(actor(interrupted).lastCommand.code, scenario === 'locked' ? 'LOCKED' : scenario === 'route blocked' ? 'BLOCKED' : 'TARGET_CHANGED')
    assert.equal(actor(interrupted).lastCommand.result, undefined)
    assert.equal(JSON.stringify(interrupted).includes('"items"'), false)
  })
})

test('container use and inspection remain busy throughout checkpoint IO while verified ownership is saved privately', { timeout: 10000 }, async t => {
  const context = await setup(t, { containers: [{ name: 'box', location: [93, 99], inventory: [] }] })
  const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
  await join(owner)
  let release
  const gate = new Promise(resolve => { release = resolve })
  const write = context.server.checkpointStore.write.bind(context.server.checkpointStore)
  context.server.checkpointStore.write = async document => { await gate; return write(document) }
  const pending = checkpoint(owner, 1, 'save')
  await snapshotWhere(owner, snapshot => snapshot.checkpoint.busy)
  rejection(await useContainer(owner, 2, 'box'), 'BUSY', 2)
  rejection(await inspect(owner, 3, 'box'), 'BUSY', 3)
  release()
  assert.equal((await pending).ok, true)
  assert.equal((await inspect(owner, 4, 'box')).ok, true)
  const document = JSON.parse(await fs.readFile(path.join(context.dataPath, 'saves', 'local-checkpoint.json'), 'utf8'))
  assert.equal(Object.hasOwn(document, 'containers'), false)
  assert.deepEqual(document.ownership, { owners: [{ id: containerId('box'), inventoryIndex: 0, items: [] }], items: [] })
  assert.equal(JSON.stringify(context.server.getSnapshot()).includes('"items"'), false)
})

test('local pause freezes autonomous movement mid-step, preserves its command and resumes without catching up', { timeout: 10000 }, async t => {
  const context = await setup(t)
  const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
  const observer = await context.connect({ version: 2, token: context.connection.observerToken })
  assert.deepEqual((await join(owner)).snapshot.pause, { supported: true, paused: false })
  await join(observer)
  assert.equal((await command(owner, 1, [93, 99])).status, 'accepted')
  await snapshotWhere(observer, snapshot => actor(snapshot).movement?.progress >= 0.15)
  const paused = await checkpoint(owner, 2, 'pause')
  assert.deepEqual(paused.result, { kind: 'pause', paused: true })
  const frozen = await snapshotWhere(observer, snapshot => snapshot.revision === paused.revision)
  assert.deepEqual(await snapshotWhere(owner, snapshot => snapshot.revision === frozen.revision), frozen)
  assert.deepEqual(frozen.pause, { supported: true, paused: true })
  assert.deepEqual(actor(frozen).lastCommand, { id: 1, status: 'accepted' })
  assert.equal(actor(frozen).movement.commandId, 1)
  assert.ok(actor(frozen).movement.elapsedMs >= 150 && actor(frozen).movement.elapsedMs < 700)
  assert.deepEqual(actor(frozen).location, start)
  const revision = context.server.revision
  const count = observer.snapshots.length
  const initialWallTime = frozen.serverTime
  const pauseInstant = context.server.pausedAt
  await new Promise(resolve => setTimeout(resolve, 450))
  assert.equal((await checkpoint(owner, 3, 'pause')).ok, true)
  assert.equal(context.server.pausedAt, pauseInstant, 'repeated pause must not reset its timing origin')
  await new Promise(resolve => setTimeout(resolve, 700))
  context.server.advanceMovement(performance.now() + 100000)
  assert.equal(context.server.revision, revision, 'neither autonomous nor manual ticks publish while paused')
  assert.equal(observer.snapshots.length, count)
  assert.deepEqual(actor(context.server.getSnapshot()), actor(frozen))
  assert.ok(context.server.getSnapshot().serverTime > initialWallTime, 'wall time remains a wall clock')
  const reconnect = await context.connect({ version: 2, token: context.connection.ownerToken })
  const joined = await join(reconnect)
  assert.deepEqual(joined.snapshot.pause, frozen.pause)
  assert.deepEqual(actor(joined.snapshot), actor(frozen))
  assert.equal(joined.nextCommandId, 4)
  const resumed = await checkpoint(reconnect, 4, 'resume')
  assert.deepEqual(resumed.result, { kind: 'resume', paused: false })
  const resumeSnapshot = await snapshotWhere(observer, snapshot => snapshot.revision === resumed.revision)
  assert.deepEqual(actor(resumeSnapshot), actor(frozen), 'resume does not advance the frozen fractional step')
  await new Promise(resolve => setTimeout(resolve, 100))
  const continuing = actor(context.server.getSnapshot())
  assert.deepEqual(continuing.location, start, 'paused wall time cannot complete the route')
  assert.ok(continuing.movement.elapsedMs - actor(frozen).movement.elapsedMs < 300,
    'only resumed wall time advances the fractional step')
  const complete = await snapshotWhere(observer, snapshot => actor(snapshot).lastCommand?.id === 1 && !actor(snapshot).movement)
  assert.deepEqual(actor(complete).location, [93, 99])
  assert.deepEqual(actor(complete).lastCommand, { id: 1, status: 'completed' })
})

test('pause intentions enforce owner, strict shape and consumed IDs while rejecting gameplay in the frozen world', { timeout: 10000 }, async t => {
  const context = await setup(t, { doors: [{ name: 'front', location: [94, 99] }],
    containers: [{ name: 'box', location: [92, 102] }] })
  const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
  const observer = await context.connect({ version: 2, token: context.connection.observerToken })
  rejection(await checkpoint(owner, 1, 'pause'), 'NOT_JOINED', 1)
  await join(owner)
  await join(observer)
  rejection(await checkpoint(observer, 100, 'pause'), 'FORBIDDEN', 100)
  rejection(await checkpoint(observer, 101, 'resume'), 'FORBIDDEN', 101)
  rejection(await checkpoint(owner, 1, 'pause', { actorId: 'another' }), 'FORBIDDEN', 1)
  rejection(await checkpoint(owner, 1, 'pause', { version: 3 }), 'VERSION_MISMATCH', 1)
  for (const type of ['pause', 'resume'] as const) {
    for (const changes of [{ target: start }, { targetId: doorId('front') }, { paused: true },
      { duration: 1 }, { id: 0 }, { id: '1' }, { id: 1.5 }] as const) {
      rejection(await checkpoint(owner, 1, type, changes), 'INVALID_COMMAND')
    }
  }
  assert.deepEqual((await checkpoint(owner, 1, 'pause')).result, { kind: 'pause', paused: true })
  rejection(await checkpoint(owner, 1, 'pause'), 'REPLAYED_COMMAND', 1)
  const frozen = context.server.getSnapshot()
  assert.equal((await checkpoint(owner, 2, 'pause')).ok, true, 'the desired pause state is idempotent')
  assert.equal(context.server.revision, frozen.revision)
  assert.deepEqual(actor(context.server.getSnapshot()), actor(frozen))
  rejection(await command(owner, 3, [93, 99]), 'PAUSED', 3)
  rejection(await use(owner, 4, 'front'), 'PAUSED', 4)
  rejection(await inspect(owner, 5, 'box'), 'PAUSED', 5)
  assert.deepEqual(actor(context.server.getSnapshot()), actor(frozen))
  const resumed = await checkpoint(owner, 6, 'resume')
  assert.deepEqual(resumed.result, { kind: 'resume', paused: false })
  const revision = context.server.revision
  assert.equal((await checkpoint(owner, 7, 'resume')).ok, true, 'the desired resumed state is idempotent')
  assert.equal(context.server.revision, revision)
  assert.deepEqual(actor(context.server.getSnapshot()), actor(frozen), 'pause controls do not replace the gameplay record')
  rejection(await checkpoint(owner, 6, 'resume'), 'REPLAYED_COMMAND', 6)
  assert.equal((await join(owner)).nextCommandId, 8)
  await context.server.stop()
  rejection(context.server.command({ data: { joined: true, role: 'owner' } },
    { version: 2, id: 8, actorId: '0', type: 'pause' }), 'SERVER_STOPPED', 8)
})

test('hosts can disable local pause explicitly and reject invalid pause policies', { timeout: 10000 }, async t => {
  for (const allowPause of [0, 1, null, 'true', {}, []] as const) {
    assert.throws(() => createAuthorityServer({ dataPath: os.tmpdir(), allowPause }), /allowPause must be a boolean/)
  }
  const context = await setup(t, { serverOptions: { allowPause: false } })
  const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
  assert.deepEqual((await join(owner)).snapshot.pause, { supported: false, paused: false })
  rejection(await checkpoint(owner, 1, 'pause'), 'PAUSE_UNAVAILABLE', 1)
  rejection(await checkpoint(owner, 2, 'resume'), 'PAUSE_UNAVAILABLE', 2)
  rejection(await checkpoint(owner, 2, 'resume'), 'REPLAYED_COMMAND', 2)
  assert.equal((await command(owner, 3, [93, 99])).status, 'accepted')
  const complete = await snapshotWhere(owner, snapshot => actor(snapshot).lastCommand?.id === 3 && !actor(snapshot).movement)
  assert.deepEqual(actor(complete).location, [93, 99])
  assert.deepEqual(complete.pause, { supported: false, paused: false })
})

test('pausing a pending door approach preserves its deferred interaction and exact-boundary completion', { timeout: 10000 }, async t => {
  const context = await setup(t, { doors: [{ name: 'front', location: [94, 99] }] })
  const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
  await join(owner)
  assert.equal((await use(owner, 1, 'front')).status, 'accepted')
  await snapshotWhere(owner, snapshot => actor(snapshot).movement?.progress > 0.1)
  const pendingUse = context.server.movement.pendingUse
  assert.equal((await checkpoint(owner, 2, 'pause')).ok, true)
  const frozen = context.server.getSnapshot()
  assert.equal(frozen.doors[0].open, false)
  assert.equal(context.server.movement.pendingUse, pendingUse)
  assert.deepEqual(actor(frozen).lastCommand, { id: 1, type: 'use', targetId: doorId('front'), status: 'accepted' })
  rejection(await checkpoint(owner, 3, 'save'), 'BUSY', 3)
  rejection(await checkpoint(owner, 4, 'load'), 'BUSY', 4)
  await new Promise(resolve => setTimeout(resolve, 1050))
  assert.equal(context.server.getSnapshot().doors[0].open, false)
  assert.deepEqual(actor(context.server.getSnapshot()), actor(frozen))
  assert.equal((await checkpoint(owner, 5, 'resume')).ok, true)
  const complete = await snapshotWhere(owner, snapshot => actor(snapshot).lastCommand?.id === 1 && !actor(snapshot).movement)
  assert.equal(complete.doors[0].open, true)
  assert.deepEqual(actor(complete).lastCommand, { id: 1, type: 'use', targetId: doorId('front'), status: 'completed',
    result: { targetId: doorId('front'), open: true } })
  assert.equal((await command(owner, 6, start)).status, 'accepted')
  // Hold automatic ticks, then put the accepted route exactly at its next tile
  // boundary. The pause handler must commit that due step before freezing.
  clearInterval(context.server.timer)
  context.server.movement.startedAt = performance.now() - 1000
  assert.equal((await checkpoint(owner, 7, 'pause')).ok, true)
  const boundary = context.server.getSnapshot()
  assert.deepEqual(actor(boundary).location, start)
  assert.equal(actor(boundary).movement, null)
  assert.deepEqual(actor(boundary).lastCommand, { id: 6, status: 'completed' })
  assert.deepEqual(boundary.pause, { supported: true, paused: true })
})

test('idle checkpoints remain available while paused and neither loading nor restarting saves pause state', { timeout: 10000 }, async t => {
  const context = await setup(t)
  const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
  await join(owner)
  assert.equal((await checkpoint(owner, 1, 'pause')).ok, true)
  assert.equal((await checkpoint(owner, 2, 'save')).ok, true)
  const filename = path.join(context.dataPath, 'saves', 'local-checkpoint.json')
  const document = JSON.parse(await fs.readFile(filename, 'utf8'))
  assert.equal(Object.hasOwn(document, 'pause'), false)
  assert.equal(Object.hasOwn(document, 'paused'), false)
  assert.deepEqual(Object.keys(document.actor).sort(), ['id', 'location'])
  assert.equal((await checkpoint(owner, 3, 'resume')).ok, true)
  assert.equal((await command(owner, 4, [93, 99])).status, 'accepted')
  await snapshotWhere(owner, snapshot => actor(snapshot).lastCommand?.id === 4 && !actor(snapshot).movement)
  assert.equal((await checkpoint(owner, 5, 'pause')).ok, true)
  assert.equal((await checkpoint(owner, 6, 'load')).ok, true)
  const loaded = context.server.getSnapshot()
  assert.deepEqual(actor(loaded).location, start)
  assert.deepEqual(loaded.pause, { supported: true, paused: true })
  assert.deepEqual(actor(loaded).lastCommand.result, { kind: 'load', savedAt: document.savedAt })
  await context.server.stop()
  const restarted = createAuthorityServer({ dataPath: context.dataPath, mapId, tickMs: 20 })
  t.after(() => restarted.stop())
  const session = await restarted.start()
  const newOwner = await context.connect({ version: 2, token: session.ownerToken }, session.url)
  assert.deepEqual((await join(newOwner)).snapshot.pause, { supported: true, paused: false })
  assert.equal((await checkpoint(newOwner, 1, 'load')).ok, true)
  assert.deepEqual(restarted.getSnapshot().pause, { supported: true, paused: false })
})

test('checkpoint IO blocks pause and resume without changing either current pause state', { timeout: 10000 }, async t => {
  const context = await setup(t)
  const owner = await context.connect({ version: 2, token: context.connection.ownerToken })
  await join(owner)
  const write = context.server.checkpointStore.write.bind(context.server.checkpointStore)
  let release
  let gate = new Promise(resolve => { release = resolve })
  context.server.checkpointStore.write = async document => { await gate; return write(document) }
  const saving = checkpoint(owner, 1, 'save')
  await snapshotWhere(owner, snapshot => snapshot.checkpoint.busy)
  rejection(await checkpoint(owner, 2, 'pause'), 'BUSY', 2)
  rejection(await checkpoint(owner, 3, 'resume'), 'BUSY', 3)
  assert.deepEqual(context.server.getSnapshot().pause, { supported: true, paused: false })
  release()
  assert.equal((await saving).ok, true)
  assert.equal((await checkpoint(owner, 4, 'pause')).ok, true)
  const read = context.server.checkpointStore.read.bind(context.server.checkpointStore)
  gate = new Promise(resolve => { release = resolve })
  context.server.checkpointStore.read = async () => { await gate; return read() }
  const loading = checkpoint(owner, 5, 'load')
  await snapshotWhere(owner, snapshot => snapshot.checkpoint.busy && snapshot.checkpoint.lastAction === 'load')
  rejection(await checkpoint(owner, 6, 'pause'), 'BUSY', 6)
  rejection(await checkpoint(owner, 7, 'resume'), 'BUSY', 7)
  assert.deepEqual(context.server.getSnapshot().pause, { supported: true, paused: true })
  release()
  assert.equal((await loading).ok, true)
  assert.deepEqual(context.server.getSnapshot().pause, { supported: true, paused: true })
  assert.equal((await checkpoint(owner, 8, 'resume')).ok, true)
})
