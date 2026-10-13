const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const { before, test } = require('node:test') as typeof import('node:test')
const fs = require('node:fs/promises') as typeof import('node:fs/promises')
const os = require('node:os') as typeof import('node:os')
const path = require('node:path') as typeof import('node:path')
const Module = require('node:module') as typeof import('node:module')
const { io } = require('socket.io-client') as typeof import('socket.io-client')
const { MAP_ID, BOX_ID, TOKEN_ID, TOKEN_LABEL, KEY_ID, PRIZE_ID, PRIZE_LABEL,
  GROUND_ITEM_ID, GROUND_ITEM_LABEL, NPC_ID, NPC_LABEL, QUEST_ID, QUEST_TITLE } = require('../../../examples/inventory-workshop/generate.cts')

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
  const result = await build({
    absWorkingDir: root,
    stdin: { contents: "export { createAuthorityServer } from './server/authority/AuthorityServer.ts';",
      resolveDir: source, sourcefile: 'dialogue-network-test-entry.js' },
    bundle: true, platform: 'node', format: 'cjs', target: 'node24', write: false,
    external: ['electron', 'workerpool'], loader: { '.glsl': 'text' },
  })
  const compiled = new Module(path.join(__dirname, 'dialogue-network-test-bundle.cjs'), module)
  compiled.filename = path.join(__dirname, 'dialogue-network-test-bundle.cjs')
  compiled.paths = Module._nodeModulePaths(root)
  compiled._compile(result.outputFiles[0].text, compiled.filename)
  createAuthorityServer = compiled.exports.createAuthorityServer
})

async function setup(t: import("node:test").TestContext, mutate?) {
  const dataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'agate-dialogue-network-'))
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
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', resolve); socket.once('connect_error', reject); socket.connect()
      })
      return client
    }
    return { server, connect }
  }
  return { dataPath, start, nextId: 1, ...(await start()) }
}

const join = client => client.socket.timeout(3000).emitWithAck('authority:join', { version: 1 })
const command = (client, id, type, data = {}) => client.socket.timeout(3000).emitWithAck('authority:command',
  { version: 1, id, actorId: '0', type, ...data })
const pickup = (client, id, revision, changes = {}) => command(client, id, 'pickup',
  { targetId: GROUND_ITEM_ID, expectedRevision: revision, ...changes })
const drop = (client, id, revision, changes = {}) => command(client, id, 'drop',
  { itemId: GROUND_ITEM_ID, expectedRevision: revision, ...changes })
const actor = snapshot => snapshot.actors.find(value => value.id === '0')
function rejection(result, code: string, id?: number) {
  assert.equal(result.ok, false)
  assert.equal(result.code, code)
  assert.equal(result.version, 1)
  if (id !== undefined) assert.equal(result.id, id)
  assert.ok(Number.isSafeInteger(result.revision))
  assert.equal(typeof result.message, 'string')
}
function publicState(snapshot, privatePages = []) {
  assert.deepEqual(snapshot.conversationTargets, [{ id: NPC_ID, kind: 'conversation', label: NPC_LABEL, location: [9, 8] }])
  const value = JSON.stringify(snapshot)
  for (const hidden of [TOKEN_ID, TOKEN_LABEL, KEY_ID, PRIZE_ID, PRIZE_LABEL, QUEST_ID, QUEST_TITLE] as const) {
    assert.equal(value.includes(hidden), false, `public state exposed ${hidden}`)
  }
  for (const key of ['items', 'inventory', 'ownership', 'parent', 'slot', 'keyId', 'keyID', 'canDrop',
    'options', 'nodeId', 'conversationId', 'text', 'journal', 'entries', 'quests', 'speaker'] as const) {
    assert.equal(value.includes(`"${key}":`), false, `public state exposed ${key}`)
  }
  for (const page of privatePages) {
    if (page.text) assert.equal(value.includes(page.text), false, 'NPC lines remain private')
    for (const option of page.options || []) assert.equal(value.includes(option.text), false, 'reply labels remain private')
    for (const entry of page.journal?.entries || []) assert.equal(value.includes(entry.text), false, 'journal descriptions remain private')
  }
  if (!snapshot.groundItems.length) {
    assert.equal(value.includes(GROUND_ITEM_ID), false, 'held pebble identity remains private')
    assert.equal(value.includes(GROUND_ITEM_LABEL), false, 'held pebble label remains private')
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

const send = (context, client, type, data = {}) => command(client, context.nextId++, type, data)
const reply = (context, client, page, optionId, revision, changes = {}) => send(context, client, 'reply', {
  targetId: NPC_ID, conversationId: page.conversationId, optionId, expectedRevision: revision, ...changes,
})
async function approach(context, client, targetId) {
  return complete(client, context.nextId++, 'use', { targetId })
}
function page(result, node, options) {
  assert.equal(result.kind, 'conversation')
  assert.equal(result.targetId, NPC_ID)
  assert.equal(result.closed, false)
  assert.equal(result.nodeId, node)
  assert.equal(result.speaker, NPC_LABEL)
  assert.equal(typeof result.text, 'string')
  assert.ok(result.text.length > 0 && result.text.length <= 2048)
  assert.equal(typeof result.conversationId, 'string')
  assert.ok(result.conversationId.length > 16 && result.conversationId.length <= 128)
  assert.deepEqual(result.options.map(option => option.id), options)
  assert.ok(result.options.every(option => Object.keys(option).sort().join(',') === 'id,text' &&
    typeof option.text === 'string' && option.text.length > 0 && option.text.length <= 512))
}
function journal(result, status?) {
  assert.deepEqual(Object.keys(result).sort(), ['entries'])
  if (!status) return assert.deepEqual(result.entries, [])
  assert.equal(result.entries.length, 1)
  const [entry] = result.entries
  assert.deepEqual(Object.keys(entry).sort(), ['id', 'status', 'text', 'title'])
  assert.equal(entry.id, QUEST_ID)
  assert.equal(entry.title, QUEST_TITLE)
  assert.equal(entry.status, status)
  assert.equal(typeof entry.text, 'string')
  assert.ok(entry.text.length > 0 && entry.text.length <= 2048)
}

test('socket dialogue keeps lines and journal private while a held-pebble quest survives ownership changes and a fresh host',
  { timeout: 30000 }, async t => {
    const context = await setup(t)
    const owner = await context.connect(), observer = await context.connect('observer')
    const initial = await join(owner); await join(observer)
    publicState(initial.snapshot)
    const bytes = await fs.readFile(path.join(context.dataPath, GROUND_ITEM_ID))
    const initialRevision = context.server.revision
    const initialCommand = actor(context.server.getSnapshot()).lastCommand
    const empty = await send(context, owner, 'journal')
    assert.equal(empty.ok, true, empty.message)
    assert.equal(empty.result.kind, 'journal')
    journal({ entries: empty.result.entries })
    assert.equal(context.server.revision, initialRevision, 'private journal reads do not publish a world revision')
    assert.deepEqual(actor(context.server.getSnapshot()).lastCommand, initialCommand)
    rejection(await send(context, owner, 'talk', { targetId: NPC_ID }), 'OUT_OF_RANGE')
    const reached = await approach(context, owner, NPC_ID)
    assert.deepEqual(reached.result, { kind: 'conversation', targetId: NPC_ID })
    const offered = await send(context, owner, 'talk', { targetId: NPC_ID })
    assert.equal(offered.ok, true, offered.message)
    page(offered.result, 'offer', ['accept', 'leave'])
    journal(offered.result.journal)
    assert.equal(offered.revision, reached.revision)
    assert.equal(context.server.revision, reached.revision, 'talk reads preserve approach completion and revision')
    assert.equal(actor(context.server.getSnapshot()).lastCommand.id, reached.id)
    const active = await reply(context, owner, offered.result, 'accept', offered.revision)
    assert.equal(active.ok, true, active.message)
    page(active.result, 'active', ['leave'])
    journal(active.result.journal, 'active')
    assert.equal(active.revision, offered.revision + 1, 'accept has one authoritative commit')
    assert.deepEqual(actor(context.server.getSnapshot()).lastCommand,
      { id: active.id, type: 'reply', status: 'completed', result: { kind: 'reply' } })
    rejection(await reply(context, owner, offered.result, 'accept', offered.revision), 'STALE_REVISION')
    rejection(await reply(context, owner, offered.result, 'accept', active.revision), 'CONVERSATION_EXPIRED')
    rejection(await reply(context, owner, active.result, 'show', active.revision), 'INVALID_OPTION')
    const left = await reply(context, owner, active.result, 'leave', active.revision)
    assert.equal(left.ok, true, left.message)
    assert.deepEqual(left.result, { kind: 'conversation', targetId: NPC_ID, closed: true, journal: active.result.journal, character: active.result.character })
    assert.equal(left.revision, active.revision, 'closing a page does not publish or change quest state')
    rejection(await reply(context, owner, active.result, 'leave', active.revision), 'CONVERSATION_EXPIRED')

    await approach(context, owner, GROUND_ITEM_ID)
    const picked = await send(context, owner, 'pickup', { targetId: GROUND_ITEM_ID, expectedRevision: context.server.revision })
    assert.equal(picked.ok, true, picked.message)
    assert.deepEqual(picked.result.inventory.items, [pebble(0)])
    await approach(context, owner, NPC_ID)
    const carrying = await send(context, owner, 'talk', { targetId: NPC_ID })
    assert.equal(carrying.ok, true, carrying.message)
    page(carrying.result, 'active', ['show', 'leave'])
    const completed = await reply(context, owner, carrying.result, 'show', carrying.revision)
    assert.equal(completed.ok, true, completed.message)
    page(completed.result, 'completed', ['leave'])
    journal(completed.result.journal, 'completed')
    assert.equal(completed.revision, carrying.revision + 1)
    assert.deepEqual((await send(context, owner, 'inventory')).result.items, [pebble(0)], 'showing the pebble neither consumes nor duplicates it')
    rejection(await command(owner, completed.id, 'reply', { targetId: NPC_ID,
      conversationId: carrying.result.conversationId, optionId: 'show', expectedRevision: carrying.revision }), 'REPLAYED_COMMAND', completed.id)
    publicState(context.server.getSnapshot(), [offered.result, active.result, carrying.result, completed.result])

    await approach(context, owner, BOX_ID)
    const put = await send(context, owner, 'put', { targetId: BOX_ID, itemId: GROUND_ITEM_ID, expectedRevision: context.server.revision })
    assert.equal(put.ok, true, put.message)
    assert.deepEqual(put.result.inventory.items, [])
    journal({ entries: (await send(context, owner, 'journal')).result.entries }, 'completed')
    const saved = await send(context, owner, 'save')
    assert.equal(saved.ok, true, saved.message)
    const document = JSON.parse(await fs.readFile(context.server.checkpointStore.filename, 'utf8'))
    assert.equal(document.version, 6)
    assert.equal(document.rulesVersion, 'movement-doors-ownership-attributes-v9')
    assert.deepEqual(document.quests, [{ id: QUEST_ID, status: 'completed' }])
    const late = await context.connect('observer'); const lateJoin = await join(late)
    publicState(lateJoin.snapshot, [offered.result, active.result, carrying.result, completed.result])
    for (const snapshot of observer.snapshots) publicState(snapshot, [offered.result, active.result, carrying.result, completed.result])

    await context.server.stop()
    const restarted = await context.start(), newOwner = await restarted.connect(), newObserver = await restarted.connect('observer')
    await join(newOwner); await join(newObserver)
    context.nextId = 1
    const loaded = await send(context, newOwner, 'load')
    assert.equal(loaded.ok, true, loaded.message)
    journal({ entries: (await send(context, newOwner, 'journal')).result.entries }, 'completed')
    assert.deepEqual((await send(context, newOwner, 'inventory')).result.items, [])
    await approach(context, newOwner, NPC_ID)
    const remembered = await send(context, newOwner, 'talk', { targetId: NPC_ID })
    assert.equal(remembered.ok, true, remembered.message)
    page(remembered.result, 'completed', ['leave'])
    journal(remembered.result.journal, 'completed')
    rejection(await reply(context, newOwner, carrying.result, 'show', remembered.revision), 'CONVERSATION_EXPIRED')
    publicState(restarted.server.getSnapshot(), [remembered.result])
    for (const snapshot of newObserver.snapshots) publicState(snapshot, [remembered.result])
    assert.deepEqual(await fs.readFile(path.join(context.dataPath, GROUND_ITEM_ID)), bytes, 'quest completion leaves authored simulation data untouched')
  })

test('socket-bound conversation turns prevent another owner and racing replies from granting a quest twice',
  { timeout: 16000 }, async t => {
    const context = await setup(t)
    const first = await context.connect(), second = await context.connect(), observer = await context.connect('observer')
    await join(first); await join(second); await join(observer)
    await approach(context, first, NPC_ID)
    const offer = await send(context, first, 'talk', { targetId: NPC_ID })
    rejection(await reply(context, second, offer.result, 'accept', offer.revision), 'CONVERSATION_EXPIRED')
    const other = await send(context, second, 'talk', { targetId: NPC_ID })
    assert.equal(other.ok, true, other.message)
    const prior = context.server.revision
    const results = await Promise.all([reply(context, first, offer.result, 'accept', prior),
      reply(context, second, other.result, 'accept', prior)])
    assert.equal(results.filter(result => result.ok).length, 1, JSON.stringify(results))
    assert.equal(context.server.revision, prior + 1)
    assert.ok(['CONVERSATION_EXPIRED', 'STALE_REVISION', 'REPLAYED_COMMAND'].includes(results.find(result => !result.ok).code))
    journal({ entries: (await send(context, first, 'journal')).result.entries }, 'active')
    const winner = results.find(result => result.ok)
    page(winner.result, 'active', ['leave'])
    const winningClient = results[0].ok ? first : second
    const read = await send(context, winningClient, 'inventory')
    assert.equal(read.ok, true, read.message)
    const journalRead = await send(context, winningClient, 'journal')
    const closed = await reply(context, winningClient, winner.result, 'leave', journalRead.revision)
    assert.equal(closed.ok, true, closed.message)
    assert.equal(closed.revision, winner.revision, 'private inventory and journal reads preserve the active turn')
    const abandoned = await send(context, winningClient, 'talk', { targetId: NPC_ID })
    const lastId = context.nextId
    winningClient.socket.disconnect()
    const reconnected = await context.connect(); const joined = await join(reconnected)
    context.nextId = Math.max(lastId, joined.nextCommandId)
    rejection(await reply(context, reconnected, abandoned.result, 'leave', context.server.revision), 'CONVERSATION_EXPIRED')
    for (const snapshot of observer.snapshots) publicState(snapshot, [offer.result, other.result, winner.result])
  })

test('dialogue socket intentions enforce exact shape, owner, range, pause, busy, revision and session guards',
  { timeout: 16000 }, async t => {
    const context = await setup(t)
    const owner = await context.connect(), observer = await context.connect('observer')
    rejection(await send(context, owner, 'talk', { targetId: NPC_ID }), 'NOT_JOINED')
    await join(owner); await join(observer)
    for (const [type, data] of [['talk', { targetId: NPC_ID }], ['journal', {}],
      ['reply', { targetId: NPC_ID, conversationId: 'forged', optionId: 'accept', expectedRevision: context.server.revision }]] as const) {
      rejection(await send(context, observer, type, data), 'FORBIDDEN')
    }
    rejection(await send(context, owner, 'talk', { targetId: NPC_ID, version: 2 }), 'VERSION_MISMATCH')
    rejection(await send(context, owner, 'talk', { targetId: NPC_ID, actorId: 'another' }), 'FORBIDDEN')
    for (const data of [{}, { targetId: 3 }, { targetId: NPC_ID, expectedRevision: 0 }, { targetId: NPC_ID, options: [] }] as const) {
      rejection(await send(context, owner, 'talk', data), 'INVALID_COMMAND')
    }
    for (const data of [{ targetId: NPC_ID }, { entries: [] }, { expectedRevision: 0 }] as const) {
      rejection(await send(context, owner, 'journal', data), 'INVALID_COMMAND')
    }
    const shape = { targetId: NPC_ID, conversationId: 'forged', optionId: 'accept', expectedRevision: 0 }
    for (const data of [{ ...shape, conversationId: '' }, { ...shape, optionId: '' }, { ...shape, expectedRevision: -1 },
      { ...shape, expectedRevision: 0.5 }, { ...shape, nodeId: 'offer' }, { ...shape, itemId: GROUND_ITEM_ID },
      { ...shape, questStatus: 'completed' }] as const) {
      rejection(await send(context, owner, 'reply', data), 'INVALID_COMMAND')
    }
    rejection(await send(context, owner, 'talk', { targetId: 'missing-npc' }), 'UNKNOWN_TARGET')
    rejection(await send(context, owner, 'talk', { targetId: NPC_ID }), 'OUT_OF_RANGE')
    await approach(context, owner, NPC_ID)
    let offer = await send(context, owner, 'talk', { targetId: NPC_ID })
    rejection(await reply(context, owner, offer.result, 'invented', offer.revision), 'INVALID_OPTION')
    const paused = await send(context, owner, 'pause')
    assert.equal(paused.ok, true, paused.message)
    rejection(await send(context, owner, 'talk', { targetId: NPC_ID }), 'PAUSED')
    rejection(await reply(context, owner, offer.result, 'accept', context.server.revision), 'PAUSED')
    const frozenRevision = context.server.revision
    const pausedJournal = await send(context, owner, 'journal')
    assert.equal(pausedJournal.ok, true, pausedJournal.message)
    journal({ entries: pausedJournal.result.entries })
    assert.equal(context.server.revision, frozenRevision)
    assert.equal((await send(context, owner, 'resume')).ok, true)
    rejection(await reply(context, owner, offer.result, 'accept', context.server.revision), 'CONVERSATION_EXPIRED')
    offer = await send(context, owner, 'talk', { targetId: NPC_ID })
    const oldRevision = offer.revision
    const moving = await send(context, owner, 'move', { target: [4, 4] })
    assert.equal(moving.ok, true, moving.message)
    assert.equal(moving.status, 'accepted')
    rejection(await send(context, owner, 'talk', { targetId: NPC_ID }), 'BUSY')
    rejection(await send(context, owner, 'journal'), 'BUSY')
    rejection(await reply(context, owner, offer.result, 'accept', context.server.revision), 'BUSY')
    await snapshotWhere(owner, snapshot => actor(snapshot).lastCommand?.id === moving.id && !actor(snapshot).movement)
    rejection(await reply(context, owner, offer.result, 'accept', oldRevision), 'STALE_REVISION')
    rejection(await reply(context, owner, offer.result, 'accept', context.server.revision), 'CONVERSATION_EXPIRED')
    const delayed = context.server.checkpointStore.write.bind(context.server.checkpointStore)
    let finish
    context.server.checkpointStore.write = document => new Promise(resolve => { finish = () => delayed(document).then(resolve) })
    const saving = send(context, owner, 'save')
    while (!finish) await new Promise(resolve => setTimeout(resolve, 1))
    rejection(await send(context, owner, 'journal'), 'BUSY')
    rejection(await send(context, owner, 'talk', { targetId: NPC_ID }), 'BUSY')
    finish(); assert.equal((await saving).ok, true)
    for (const snapshot of observer.snapshots) publicState(snapshot, [offer.result])
  })
