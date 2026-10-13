'use strict'

const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const { EventEmitter } = require('node:events') as typeof import('node:events')
const fs = require('node:fs/promises') as typeof import('node:fs/promises')
const Module = require('node:module') as typeof import('node:module')
const path = require('node:path') as typeof import('node:path')
const { before, test } = require('node:test') as typeof import('node:test')

let AuthorityClient
before(async () => {
  const { build } = await import('esbuild')
  const filename = path.resolve(__dirname, '../src/client/network/AuthorityClient.ts')
  const output = await build({entryPoints: [filename], bundle: true, write: false, platform: 'node', format: 'cjs', target: 'node24'})
  const compiled = new Module(filename, module)
  compiled.filename = filename
  compiled.paths = Module._nodeModulePaths(path.dirname(filename))
  compiled._compile(output.outputFiles[0].text, filename)
  AuthorityClient = compiled.exports.default
})

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function snapshot(revision = 1) {
  return { version: 2, revision, scriptEpoch: 1, scriptObjects: [], mapId: 'Synthetic map', actors: [{ id: '0', location: [92, 99] }] }
}

function joined(overrides = {}) {
  return { ok: true, version: 2, role: 'owner', actorId: '0', nextCommandId: 11,
    mapId: 'Synthetic map', snapshot: snapshot(), ...overrides }
}

class FakeSocket extends EventEmitter {
  declare autoConnect: boolean
  declare autoJoin: boolean
  declare connected: boolean
  declare requests: Array<{ event: string; payload: unknown; promise: Promise<unknown>; resolve: (value: unknown) => void; reject: (error: unknown) => void }>
  declare disconnectCount: number
  constructor({ connect = true, join = true } = {}) {
    super()
    this.autoConnect = connect
    this.autoJoin = join
    this.connected = false
    this.requests = []
    this.disconnectCount = 0
  }

  connect() {
    if (this.autoConnect) queueMicrotask(() => {
      this.connected = true
      this.emit('connect')
    })
  }

  timeout() { return this }

  emitWithAck(event, payload) {
    const request = { event, payload, ...deferred() }
    this.requests.push(request)
    if (event === 'authority:join' && this.autoJoin) queueMicrotask(() => request.resolve(joined()))
    return request.promise
  }

  disconnect() {
    this.disconnectCount++
    this.connected = false
    this.emit('disconnect', 'io client disconnect')
  }

  loseConnection() {
    this.connected = false
    this.emit('disconnect', 'transport close')
  }
}

function fixture(t: import("node:test").TestContext, options = {}) {
  const socket = new FakeSocket(options)
  const snapshots = [], presentations = [], errors = [], connections = []
  const client = new AuthorityClient({ url: 'http://127.0.0.1:12345', token: 'private-test-token', protocolVersion: 2 }, {
    onSnapshot: value => snapshots.push(value),
    onPresentation: value => presentations.push(value),
    onError: error => errors.push(error),
    socketFactory(url, config) { connections.push({ url, config }); return socket }
  })
  t.after(() => client.close())
  return { client, socket, snapshots, presentations, errors, connections }
}

const flush = () => new Promise<void>(resolve => setImmediate(resolve))

test('joins with the protocol request and resumes the server command sequence without sending geometry', async t => {
  const { client, socket, connections } = fixture(t)
  const starting = client.start()
  assert.equal(client.start(), starting)
  assert.equal((await starting).actorId, '0')
  assert.equal(connections.length, 1)
  assert.deepEqual(socket.requests[0].payload, { version: 2 })
  const moving = client.move('0', [94, 99])
  const command = socket.requests[1]
  assert.deepEqual(command.payload, { version: 2, id: 11, actorId: '0', type: 'move', target: [94, 99] })
  command.resolve({ ok: true, version: 2, id: 11, actorId: '0', status: 'accepted', path: [[92, 99], [94, 99]] })
  assert.equal((await moving).id, 11)
})

test('close during connection settles startup immediately and suppresses intentional disconnect errors', { timeout: 1000 }, async t => {
  const { client, socket, errors } = fixture(t, { connect: false })
  const rejected = assert.rejects(client.start(), /client closed/)
  client.close()
  await rejected
  socket.emit('connect')
  await flush()
  assert.equal(socket.requests.length, 0)
  assert.deepEqual(errors, [])
  assert.equal(socket.listenerCount('connect'), 0)
  assert.equal(socket.listenerCount('connect_error'), 0)
  assert.equal(client.pending.size, 0)
  client.close()
  assert.equal(socket.disconnectCount, 1)
})

test('close during join cancels startup and ignores a late successful join snapshot', { timeout: 1000 }, async t => {
  const { client, socket, snapshots, errors } = fixture(t, { join: false })
  const rejected = assert.rejects(client.start(), /client closed/)
  await flush()
  assert.equal(socket.requests.length, 1)
  client.close()
  await rejected
  socket.requests[0].resolve(joined())
  await flush()
  assert.deepEqual(snapshots, [])
  assert.deepEqual(errors, [])
  assert.equal(client.pending.size, 0)
})

test('close during a move cancels its acknowledgement and consumes late failure', { timeout: 1000 }, async t => {
  const { client, socket, errors } = fixture(t)
  await client.start()
  const rejected = assert.rejects(client.move('0', [94, 99]), /client closed/)
  client.close()
  await rejected
  socket.requests[1].reject(new Error('Late transport timeout'))
  await flush()
  assert.deepEqual(errors, [])
  assert.equal(client.pending.size, 0)
})

test('unexpected disconnect cancels an outstanding join and reports one runtime error', { timeout: 1000 }, async t => {
  const { client, socket, errors } = fixture(t, { join: false })
  const rejected = assert.rejects(client.start(), /Local server disconnected: transport close/)
  await flush()
  socket.loseConnection()
  await rejected
  assert.equal(errors.length, 1)
  assert.equal(client.closed, true)
  assert.equal(client.pending.size, 0)
})

test('unexpected disconnect cancels an outstanding move even if the transport never settles its ack', { timeout: 1000 }, async t => {
  const { client, socket, errors } = fixture(t)
  await client.start()
  const rejected = assert.rejects(client.move('0', [94, 99]), /Local server disconnected/)
  socket.loseConnection()
  await rejected
  assert.equal(errors.length, 1)
  assert.equal(client.pending.size, 0)
})

test('keeps the newest broadcast when an older join acknowledgement arrives afterwards', async t => {
  const { client, socket, snapshots } = fixture(t, { join: false })
  const starting = client.start()
  await flush()
  socket.emit('authority:snapshot', snapshot(4))
  socket.requests[0].resolve(joined({ snapshot: snapshot(2) }))
  await starting
  socket.emit('authority:snapshot', snapshot(3))
  socket.emit('authority:snapshot', snapshot(4))
  assert.equal(client.snapshot.revision, 4)
  assert.deepEqual(snapshots.map(value => value.revision), [4])
})

test('invalid ownership metadata and invalid join snapshots fail before startup succeeds', async t => {
  for (const response of [joined({ nextCommandId: undefined }), joined({ actorId: '' }), joined({ snapshot: null })] as const) {
    const { client, socket } = fixture(t, { join: false })
    const rejected = assert.rejects(client.start(), /invalid player ownership|Invalid authoritative world snapshot/)
    await flush()
    socket.requests[0].resolve(response)
    await rejected
    assert.equal(client.closed, true)
  }
})

test('a presentation callback failure closes the transport and rejects startup', async t => {
  const socket = new FakeSocket()
  const errors = []
  const client = new AuthorityClient({ protocolVersion: 2 }, {
    onSnapshot() { throw new Error('Invalid controlled actor') },
    onError: error => errors.push(error),
    socketFactory: () => socket
  })
  t.after(() => client.close())
  await assert.rejects(client.start(), /Invalid controlled actor/)
  assert.equal(client.closed, true)
  assert.equal(errors.length, 1)
})

test('use sends only the authoritative target intention and preserves a normal locked rejection', async t => {
  const { client, socket, errors } = fixture(t)
  await client.start()
  const rejected = assert.rejects(client.use('0', 'Synthetic map/Sector/1/1/Portal/door.json'), (error: NodeJS.ErrnoException) => {
    assert.equal(error.code, 'LOCKED')
    assert.equal(error.message, 'Door is locked.')
    return true
  })
  const request = socket.requests[1]
  assert.deepEqual(request.payload, {
    version: 2, id: 11, actorId: '0', type: 'use', targetId: 'Synthetic map/Sector/1/1/Portal/door.json'
  })
  request.resolve({ ok: false, version: 2, id: 11, code: 'LOCKED', message: 'Door is locked.' })
  await rejected
  assert.deepEqual(errors, [])
  assert.equal(client.closed, false)
})

test('close during use cancels the acknowledgement without losing later snapshot safety', { timeout: 1000 }, async t => {
  const { client, socket, snapshots, errors } = fixture(t)
  await client.start()
  const rejected = assert.rejects(client.use('0', 'door'), /client closed/)
  client.close()
  await rejected
  socket.requests[1].resolve({ ok: true, version: 2, id: 11, status: 'accepted', targetId: 'door', path: [[92, 99]] })
  socket.emit('authority:snapshot', snapshot(5))
  await flush()
  assert.deepEqual(snapshots.map(value => value.revision), [1])
  assert.deepEqual(errors, [])
})

test('save and load send only checkpoint intentions and never install acknowledgement state as a snapshot', async t => {
  const { client, socket, snapshots } = fixture(t)
  await client.start()
  const original = client.snapshot
  const savedAt = '2026-10-12T12:00:00.000Z'
  for (const [index, action] of ['save', 'load'].entries()) {
    const result = client[action]('0')
    const request = socket.requests[index + 1]
    assert.deepEqual(request.payload, { version: 2, id: 11 + index, actorId: '0', type: action })
    assert.equal(client.snapshot, original, 'pending actions do not optimistically rewrite world state')
    request.resolve({ ok: true, version: 2, id: 11 + index, actorId: '0', status: 'completed',
      result: { kind: action, savedAt } })
    assert.equal((await result).result.kind, action)
    assert.equal(client.snapshot, original, 'only broadcasts carry the restored world')
  }
  assert.deepEqual(snapshots.map(value => value.revision), [1])
})

test('missing or incompatible checkpoints remain normal recoverable command rejections', async t => {
  const { client, socket, errors } = fixture(t)
  await client.start()
  for (const [index, action] of ['save', 'load'].entries()) {
    const code = action === 'save' ? 'CHECKPOINT_IO_ERROR' : 'CHECKPOINT_INCOMPATIBLE'
    const rejected = assert.rejects(client[action]('0'), (error: NodeJS.ErrnoException) => error.code === code && error.message === 'Checkpoint could not be used.')
    socket.requests[index + 1].resolve({ ok: false, version: 2, id: 11 + index, code,
      message: 'Checkpoint could not be used.' })
    await rejected
    assert.equal(client.closed, false)
    assert.equal(client.socket.connected, true)
  }
  assert.deepEqual(errors, [])
})

test('teardown cancels save and load acknowledgements and consumes late transport completion', { timeout: 1000 }, async t => {
  for (const action of ['save', 'load'] as const) {
    const { client, socket, snapshots, errors } = fixture(t)
    await client.start()
    const rejected = assert.rejects(client[action]('0'), /client closed/)
    client.close()
    await rejected
    socket.requests[1].resolve({ ok: true, version: 2, id: 11, status: 'completed',
      result: { kind: action, savedAt: '2026-10-12T12:00:00.000Z' } })
    socket.emit('authority:snapshot', snapshot(8))
    await flush()
    assert.equal(client.pending.size, 0)
    assert.deepEqual(snapshots.map(value => value.revision), [1])
    assert.deepEqual(errors, [])
  }
})

test('inspection sends only a target intention and keeps private item rows outside public snapshots', async t => {
  const { client, socket, snapshots } = fixture(t)
  await client.start()
  const targetId = 'Synthetic map/Sector/1/1/Container/box.json'
  const inspecting = client.inspect('0', targetId)
  const request = socket.requests[1]
  assert.deepEqual(request.payload, { version: 2, id: 11, actorId: '0', type: 'inspect', targetId })
  const result = { kind: 'container', targetId,
    items: [{ id: 'item-a', slot: 0, label: 'Weapon', type: 'Weapon', prototypeId: 2001, quantity: 2 }] }
  request.resolve({ ok: true, version: 2, id: 11, status: 'completed', targetId, result })
  assert.deepEqual((await inspecting).result, result)
  assert.deepEqual(snapshots, [snapshot()])
  assert.equal(JSON.stringify(client.snapshot).includes('item-a'), false)
})

test('inspection rejection is recoverable and teardown drops a late private contents acknowledgement', { timeout: 1000 }, async t => {
  const { client, socket, snapshots, errors } = fixture(t)
  await client.start()
  const rejected = assert.rejects(client.inspect('0', 'locked-box'), (error: NodeJS.ErrnoException) => error.code === 'LOCKED')
  socket.requests[1].resolve({ ok: false, id: 11, code: 'LOCKED', message: 'Container is locked.' })
  await rejected
  assert.equal(client.closed, false)
  const cancelled = assert.rejects(client.inspect('0', 'box'), /client closed/)
  client.close()
  await cancelled
  socket.requests[2].resolve({ ok: true, version: 2, id: 12, status: 'completed',
    result: { kind: 'container', targetId: 'box', items: [{ id: 'late-private-item' }] } })
  await flush()
  assert.equal(client.pending.size, 0)
  assert.deepEqual(snapshots, [snapshot()])
  assert.deepEqual(errors, [])
})

test('pause and resume send only strict session intentions and never optimistically change snapshots', async t => {
  const { client, socket, snapshots } = fixture(t)
  await client.start()
  for (const [index, action] of ['pause', 'resume'].entries()) {
    const paused = action === 'pause'
    const command = client[action]('0')
    const request = socket.requests[index + 1]
    assert.deepEqual(request.payload, { version: 2, id: 11 + index, actorId: '0', type: action })
    request.resolve({ ok: true, version: 2, id: 11 + index, status: 'completed', revision: 2 + index,
      result: { kind: action, paused } })
    assert.deepEqual((await command).result, { kind: action, paused })
    assert.deepEqual(snapshots, [snapshot()], 'an ACK is never promoted into a public snapshot')
  }
})

test('unavailable pause and paused gameplay remain recoverable command rejections', async t => {
  const { client, socket, errors } = fixture(t)
  await client.start()
  const unavailable = assert.rejects(client.pause('0'), (error: NodeJS.ErrnoException) => error.code === 'PAUSE_UNAVAILABLE')
  socket.requests[1].resolve({ ok: false, id: 11, code: 'PAUSE_UNAVAILABLE', message: 'Pause is unavailable.' })
  await unavailable
  const paused = assert.rejects(client.move('0', [94, 99]), (error: NodeJS.ErrnoException) => error.code === 'PAUSED')
  socket.requests[2].resolve({ ok: false, id: 12, code: 'PAUSED', message: 'The local game is paused.' })
  await paused
  assert.equal(client.closed, false)
  assert.deepEqual(errors, [])
})

test('teardown cancels pause and resume acknowledgements without late pause state resurrection', { timeout: 1000 }, async t => {
  for (const action of ['pause', 'resume'] as const) {
    const { client, socket, snapshots, errors } = fixture(t)
    await client.start()
    const cancelled = assert.rejects(client[action]('0'), /client closed/)
    client.close()
    await cancelled
    socket.requests[1].resolve({ ok: true, version: 2, id: 11, status: 'completed', revision: 5,
      result: { kind: action, paused: action === 'pause' } })
    socket.emit('authority:snapshot', { ...snapshot(5), pause: { supported: true, paused: action === 'pause' } })
    await flush()
    assert.equal(client.pending.size, 0)
    assert.deepEqual(snapshots, [snapshot()])
    assert.deepEqual(errors, [])
  }
})

test('private inventory reads and revision-checked Take send intentions without publishing their private ACKs', async t => {
  const { client, socket, snapshots } = fixture(t)
  await client.start()
  const read = client.inventory('0')
  assert.deepEqual(socket.requests[1].payload, { version: 2, id: 11, actorId: '0', type: 'inventory' })
  socket.requests[1].resolve({ ok: true, version: 2, id: 11, status: 'completed', revision: 1,
    result: { kind: 'inventory', ownerId: '16086.json', items: [] } })
  await read
  const taking = client.take('0', 'box', 'token', 1)
  assert.deepEqual(socket.requests[2].payload, { version: 2, id: 12, actorId: '0', type: 'take',
    targetId: 'box', itemId: 'token', expectedRevision: 1 })
  socket.requests[2].resolve({ ok: true, version: 2, id: 12, status: 'completed', revision: 2,
    result: { kind: 'take', targetId: 'box', itemId: 'token', items: [], inventory: { ownerId: '16086.json', items: [{ id: 'token' }] } } })
  await taking
  assert.deepEqual(snapshots, [snapshot()])
})

test('Put sends only the selected IDs and inspected revision, and teardown cancels its private acknowledgement', async t => {
  const { client, socket, snapshots } = fixture(t)
  await client.start()
  const rejected = assert.rejects(client.put('0', 'box', 'token', 7), /client closed/)
  assert.deepEqual(socket.requests[1].payload, { version: 2, id: 11, actorId: '0', type: 'put',
    targetId: 'box', itemId: 'token', expectedRevision: 7 })
  client.close()
  socket.requests[1].resolve({ ok: true, version: 2, id: 11, status: 'completed', revision: 8,
    result: { kind: 'put', targetId: 'box', itemId: 'token', items: [{ id: 'token' }], inventory: { ownerId: '16086.json', items: [] } } })
  await rejected
  await flush()
  assert.deepEqual(snapshots, [snapshot()])
  assert.equal(client.pending.size, 0)
})

test('Take All sends a container and revision without client-selected items or private broadcast state', async t => {
  const { client, socket, snapshots } = fixture(t)
  await client.start()
  const taking = client.takeAll('0', 'box', 7)
  assert.deepEqual(socket.requests[1].payload, { version: 2, id: 11, actorId: '0', type: 'take-all',
    targetId: 'box', expectedRevision: 7 })
  socket.requests[1].resolve({ ok: true, version: 2, id: 11, status: 'completed', revision: 8,
    result: { kind: 'take-all', targetId: 'box', itemIds: ['first', 'second'], items: [],
      inventory: { ownerId: '16086.json', items: [{ id: 'first' }, { id: 'second' }] } } })
  assert.deepEqual((await taking).result.itemIds, ['first', 'second'])
  assert.deepEqual(snapshots, [snapshot()])
  const cancelled = assert.rejects(client.takeAll('0', 'box', 8), /client closed/)
  client.close()
  socket.requests[2].resolve({ ok: true, version: 2, id: 12, status: 'completed', revision: 9 })
  await cancelled
  await flush()
  assert.equal(client.pending.size, 0)
  assert.deepEqual(snapshots, [snapshot()])
})

test('ground intentions send only an item target and revision, never location or ownership', async t => {
  const { client, socket } = fixture(t)
  await client.start()
  const picking = client.pickup('0', 'ground-item', 7)
  assert.deepEqual(socket.requests[1].payload, { version: 2, id: 11, actorId: '0', type: 'pickup',
    targetId: 'ground-item', expectedRevision: 7 })
  socket.requests[1].resolve({ ok: true, version: 2, id: 11, status: 'completed', revision: 8 })
  await picking
  const dropping = client.drop('0', 'ground-item', 8)
  assert.deepEqual(socket.requests[2].payload, { version: 2, id: 12, actorId: '0', type: 'drop',
    itemId: 'ground-item', expectedRevision: 8 })
  socket.requests[2].resolve({ ok: true, version: 2, id: 12, status: 'completed', revision: 9 })
  await dropping
})

test('dialogue intentions carry a server turn token and choice, never conditions or quest state', async t => {
  const { client, socket, snapshots } = fixture(t)
  await client.start()
  const talking = client.talk('0', 'guide')
  assert.deepEqual(socket.requests[1].payload, { version: 2, id: 11, actorId: '0', type: 'talk', targetId: 'guide' })
  socket.requests[1].resolve({ ok: true, version: 2, id: 11, status: 'completed', revision: 7 })
  await talking
  const replying = client.reply('0', 'guide', 'turn-1', 'accept', 7)
  assert.deepEqual(socket.requests[2].payload, { version: 2, id: 12, actorId: '0', type: 'reply', targetId: 'guide',
    conversationId: 'turn-1', optionId: 'accept', expectedRevision: 7 })
  socket.requests[2].resolve({ ok: true, version: 2, id: 12, status: 'completed', revision: 8 })
  await replying
  const reading = client.journal('0')
  assert.deepEqual(socket.requests[3].payload, { version: 2, id: 13, actorId: '0', type: 'journal' })
  socket.requests[3].resolve({ ok: true, version: 2, id: 13, status: 'completed', revision: 8 })
  await reading
  assert.deepEqual(snapshots, [snapshot()], 'private ACKs do not synthesize public snapshots')
})

test('character read sends no client-proposed experience, level or point balances', async t => {
  const { client, socket, snapshots } = fixture(t)
  await client.start()
  const reading = client.character('0')
  assert.deepEqual(socket.requests[1].payload, { version: 2, id: 11, actorId: '0', type: 'character' })
  socket.requests[1].resolve({ ok: true, version: 2, id: 11, status: 'completed', revision: 1,
    result: { kind: 'character', supported: true, experiencePoints: 0, level: 1, unspentPoints: 5, nextLevelExperience: 2100 } })
  assert.equal((await reading).result.unspentPoints, 5)
  assert.deepEqual(snapshots, [snapshot()])
})

test('attribute purchase sends only the stat ID and revision, never client-selected value or cost', async t => {
  const { client, socket } = fixture(t)
  await client.start()
  const buying = client.buyAttribute('0', 'strength', 7)
  assert.deepEqual(socket.requests[1].payload, { version: 2, id: 11, actorId: '0', type: 'buy-attribute', statId: 'strength', expectedRevision: 7 })
  socket.requests[1].resolve({ ok: true, version: 2, id: 11, status: 'completed', revision: 8 })
  await buying
})

const presentation = (changes = {}) => ({ version: 2, epoch: 1, sequence: 1, revision: 1,
  type: 'message', text: 'Private scripted door message', targetId: 'owned-door', ...changes })

test('private script presentation waits for its committed revision and drops duplicate or old sequences', async t => {
  const { client, socket, presentations } = fixture(t)
  await client.start()
  socket.emit('authority:presentation', presentation({ revision: 3 }))
  assert.deepEqual(presentations, [])
  socket.emit('authority:snapshot', snapshot(2))
  assert.deepEqual(presentations, [])
  socket.emit('authority:snapshot', snapshot(3))
  assert.equal(presentations.length, 1)
  socket.emit('authority:presentation', presentation({ text: 'Duplicate' }))
  assert.equal(presentations.length, 1)
  socket.emit('authority:presentation', presentation({ sequence: 3, revision: 3 }))
  socket.emit('authority:presentation', presentation({ sequence: 2, revision: 3 }))
  assert.deepEqual(presentations.map(value => value.sequence), [1, 3])
})

test('checkpoint epochs discard queued old effects and allow a new sequence without replaying on join', async t => {
  const { client, socket, presentations } = fixture(t)
  await client.start()
  assert.deepEqual(presentations, [], 'joining does not replay historical messages')
  socket.emit('authority:presentation', presentation({ revision: 4 }))
  socket.emit('authority:snapshot', { ...snapshot(2), scriptEpoch: 2 })
  socket.emit('authority:presentation', presentation({ epoch: 1, sequence: 2, revision: 2 }))
  socket.emit('authority:presentation', presentation({ epoch: 2, sequence: 1, revision: 2 }))
  assert.equal(presentations.length, 1)
  assert.equal(presentations[0].epoch, 2)
  socket.emit('authority:snapshot', { ...snapshot(4), scriptEpoch: 2 })
  assert.equal(presentations.length, 1, 'the old queued message stays discarded')
  client.close()
  socket.emit('authority:presentation', presentation({ epoch: 2, sequence: 2, revision: 4 }))
  assert.equal(presentations.length, 1)
})

test('malformed private script events and script object snapshots fail the transport before dispatch', async t => {
  for (const bad of [presentation({ epoch: 0 }), presentation({ sequence: 0 }), presentation({ revision: -1 }),
    presentation({ text: '' }), presentation({ text: 'bad\u0000text' }), presentation({ targetId: 3 }),
    presentation({ ownerToken: 'never accepted' })]) {
    const { client, socket, presentations, errors } = fixture(t)
    await client.start()
    socket.emit('authority:presentation', bad)
    assert.equal(client.closed, true)
    assert.equal(presentations.length, 0)
    assert.match(errors[0].message, /Invalid authoritative script presentation/)
  }
  for (const scriptObjects of [[{ id: 'npc', off: 'yes' }], [{ id: 'npc', off: true }, { id: 'npc', off: false }],
    [{ id: 'npc', off: true, privateData: {} }]]) {
    const { client, socket, errors } = fixture(t)
    await client.start()
    socket.emit('authority:snapshot', { ...snapshot(2), scriptObjects })
    assert.equal(client.closed, true)
    assert.match(errors[0].message, /Invalid authoritative world snapshot/)
  }
})
