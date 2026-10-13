const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const { before, test } = require('node:test') as typeof import('node:test')
const fs = require('node:fs/promises') as typeof import('node:fs/promises')
const os = require('node:os') as typeof import('node:os')
const path = require('node:path') as typeof import('node:path')
const Module = require('node:module') as typeof import('node:module')
const { io } = require('socket.io-client') as typeof import('socket.io-client')
const { MAP_ID, BOX_ID, TOKEN_ID, TOKEN_LABEL, KEY_ID, PRIZE_ID, PRIZE_LABEL,
  GROUND_ITEM_ID, GROUND_ITEM_LABEL, NPC_ID, NPC_LABEL, QUEST_ID, QUEST_TITLE, QUEST_EXPERIENCE_REWARD, PROGRESSION_BASELINE } = require('../../../examples/inventory-workshop/generate.cts')

const root = path.resolve(__dirname, '../../..')
const source = path.join(root, '@openarcanum/agate/src')
const OWNER_ID = '16086.json'
const ground = location => ({ id: GROUND_ITEM_ID, kind: 'ground', label: GROUND_ITEM_LABEL,
  type: 'Generic', prototypeId: 900007, location })
const pebble = slot => ({ id: GROUND_ITEM_ID, slot, label: GROUND_ITEM_LABEL, type: 'Generic', prototypeId: 900007, canDrop: true, weight: 1 })
const token = slot => ({ id: TOKEN_ID, slot, label: TOKEN_LABEL, type: 'Generic', prototypeId: 900003, weight: 1 })
let createAuthorityServer

before(async () => {
  const { build } = await import('esbuild')
  const result = await build({
    absWorkingDir: root,
    stdin: { contents: "export { createAuthorityServer } from './server/authority/AuthorityServer.ts';",
      resolveDir: source, sourcefile: 'progression-network-test-entry.js' },
    bundle: true, platform: 'node', format: 'cjs', target: 'node24', write: false,
    external: ['electron', 'workerpool'], loader: { '.glsl': 'text' },
  })
  const compiled = new Module(path.join(__dirname, 'progression-network-test-bundle.cjs'), module)
  compiled.filename = path.join(__dirname, 'progression-network-test-bundle.cjs')
  compiled.paths = Module._nodeModulePaths(root)
  compiled._compile(result.outputFiles[0].text, compiled.filename)
  createAuthorityServer = compiled.exports.createAuthorityServer
})

async function setup(t: import("node:test").TestContext, mutate?) {
  const dataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'agate-progression-network-'))
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
    'options', 'nodeId', 'conversationId', 'text', 'journal', 'entries', 'quests', 'speaker',
    'character', 'experiencePoints', 'level', 'unspentPoints', 'nextLevelExperience', 'rewardExperience'] as const) {
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
function journal(result, status) {
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

const ATTRIBUTE_IDS = ['strength', 'dexterity', 'constitution', 'beauty', 'intelligence', 'perception', 'willpower', 'charisma']
const baseAttributes = () => Object.fromEntries(ATTRIBUTE_IDS.map(id => [id, 8]))
const rows = () => ATTRIBUTE_IDS.map(id => ({ id, label: id[0].toUpperCase() + id.slice(1), value: 8, maximum: 20, pointCost: 1, canIncrease: true }))
const baseDerived = () => ({ maxHealth: 30, maxFatigue: 30, carryWeight: 4000, damageBonus: -1,
  armorClassAdjustment: -2, speed: 8, healRate: 3, poisonRecovery: 8, reactionModifier: -7, maxFollowers: 2 })
const baseline = () => ({ kind: 'character', supported: true, experiencePoints: 0, level: 1, unspentPoints: 5,
  nextLevelExperience: 2100, attributes: rows(), derived: baseDerived() })
const rewarded = () => ({ ...baseline(), experiencePoints: QUEST_EXPERIENCE_REWARD,
  level: 2, unspentPoints: 6, nextLevelExperience: 4600, derived: { ...baseDerived(), maxHealth: 32, maxFatigue: 32 } })
async function character(context, client, expected, _description?: string) {
  const read = await send(context, client, 'character')
  assert.equal(read.ok, true, read.message)
  assert.equal(read.status, 'completed')
  assert.deepEqual(read.result, expected)
  return read
}
async function showPebble(context, client) {
  await approach(context, client, GROUND_ITEM_ID)
  const picked = await send(context, client, 'pickup', { targetId: GROUND_ITEM_ID, expectedRevision: context.server.revision })
  assert.equal(picked.ok, true, picked.message)
  await approach(context, client, NPC_ID)
  const talked = await send(context, client, 'talk', { targetId: NPC_ID })
  assert.equal(talked.ok, true, talked.message)
  page(talked.result, 'active', ['show', 'leave'])
  const completed = await reply(context, client, talked.result, 'show', talked.revision)
  assert.equal(completed.ok, true, completed.message)
  return { talked, completed }
}

test('quest XP, derived level and banked points stay private and restore together across earlier timelines and a fresh host',
  { timeout: 45000 }, async t => {
    const context = await setup(t)
    const owner = await context.connect(), observer = await context.connect('observer')
    const joined = await join(owner); await join(observer)
    publicState(joined.snapshot)
    assert.deepEqual(PROGRESSION_BASELINE, { experiencePoints: 0, level: 1, unspentPoints: 5, attributes: baseAttributes() })
    assert.equal(QUEST_EXPERIENCE_REWARD, 2100)
    const actorBytes = await fs.readFile(path.join(context.dataPath, OWNER_ID))
    const rulesBytes = await fs.readFile(path.join(context.dataPath, 'rules/Progression.json'))
    const firstRevision = context.server.revision, firstCommand = actor(context.server.getSnapshot()).lastCommand
    await character(context, owner, baseline())
    assert.equal(context.server.revision, firstRevision)
    assert.deepEqual(actor(context.server.getSnapshot()).lastCommand, firstCommand)
    await approach(context, owner, NPC_ID)
    const offered = await send(context, owner, 'talk', { targetId: NPC_ID })
    assert.deepEqual(offered.result.character, baseline())
    const offerRead = await character(context, owner, baseline())
    const active = await reply(context, owner, offered.result, 'accept', offerRead.revision)
    assert.equal(active.ok, true, active.message)
    assert.deepEqual(active.result.character, baseline(), 'acceptance does not grant completion XP')
    const activeJournal = await send(context, owner, 'journal')
    assert.deepEqual(activeJournal.result.character, baseline())
    journal({ entries: activeJournal.result.entries }, 'active')
    const savedActive = await send(context, owner, 'save')
    assert.equal(savedActive.ok, true, savedActive.message)
    const activeDocument = JSON.parse(await fs.readFile(context.server.checkpointStore.filename, 'utf8'))
    assert.deepEqual(activeDocument.character, { ...PROGRESSION_BASELINE, history: [] })
    assert.deepEqual(activeDocument.quests, [{ id: QUEST_ID, status: 'active' }])

    const first = await showPebble(context, owner)
    assert.deepEqual(first.talked.result.character, baseline())
    assert.deepEqual(first.completed.result.character, rewarded())
    journal(first.completed.result.journal, 'completed')
    assert.equal(first.completed.revision, first.talked.revision + 1, 'quest and reward share one authoritative commit')
    assert.deepEqual(actor(context.server.getSnapshot()).lastCommand,
      { id: first.completed.id, type: 'reply', status: 'completed', result: { kind: 'reply' } })
    await character(context, owner, rewarded())
    rejection(await command(owner, first.completed.id, 'reply', { targetId: NPC_ID,
      conversationId: first.talked.result.conversationId, optionId: 'show', expectedRevision: first.talked.revision }), 'REPLAYED_COMMAND')
    const terminal = await send(context, owner, 'talk', { targetId: NPC_ID })
    assert.deepEqual(terminal.result.character, rewarded())
    page(terminal.result, 'completed', ['leave'])
    rejection(await reply(context, owner, terminal.result, 'show', terminal.revision), 'INVALID_OPTION')
    const close = await reply(context, owner, terminal.result, 'leave', terminal.revision)
    assert.equal(close.ok, true, close.message)
    assert.deepEqual(close.result.character, rewarded(), 'closing a completed page cannot award again')
    assert.deepEqual((await send(context, owner, 'inventory')).result.items, [pebble(0)])

    const restoredActive = await send(context, owner, 'load')
    assert.equal(restoredActive.ok, true, restoredActive.message)
    await character(context, owner, baseline())
    const restoredJournal = await send(context, owner, 'journal')
    journal({ entries: restoredJournal.result.entries }, 'active')
    assert.deepEqual(restoredJournal.result.character, baseline(), 'loading the earlier timeline restores XP with its quest')
    assert.deepEqual((await send(context, owner, 'inventory')).result.items, [])
    assert.deepEqual(context.server.getSnapshot().groundItems, [ground([4, 7])])
    const second = await showPebble(context, owner)
    assert.deepEqual(second.completed.result.character, rewarded(), 'recompleting the restored timeline grants one reward rather than accumulating process history')
    const dropped = await send(context, owner, 'drop', { itemId: GROUND_ITEM_ID, expectedRevision: context.server.revision })
    assert.equal(dropped.ok, true, dropped.message)
    await character(context, owner, rewarded())
    const savedComplete = await send(context, owner, 'save')
    assert.equal(savedComplete.ok, true, savedComplete.message)
    const document = JSON.parse(await fs.readFile(context.server.checkpointStore.filename, 'utf8'))
    assert.equal(document.version, 6)
    assert.equal(document.rulesVersion, 'movement-doors-ownership-attributes-weight-v10')
    assert.deepEqual(document.character, { experiencePoints: 2100, level: 2, unspentPoints: 6, attributes: baseAttributes(), history: [{ kind: 'quest', questId: QUEST_ID }] })
    assert.deepEqual(document.quests, [{ id: QUEST_ID, status: 'completed' }])
    const pages = [offered.result, active.result, first.talked.result, first.completed.result, terminal.result, second.completed.result]
    const late = await context.connect('observer'); publicState((await join(late)).snapshot, pages)
    for (const snapshot of observer.snapshots) publicState(snapshot, pages)

    await context.server.stop()
    const restarted = await context.start(), newOwner = await restarted.connect(), newObserver = await restarted.connect('observer')
    await join(newOwner); await join(newObserver)
    context.nextId = 1
    await character(context, newOwner, baseline(), 'a fresh host starts from authored state until explicit load')
    assert.equal((await send(context, newOwner, 'load')).ok, true)
    await character(context, newOwner, rewarded())
    const loadedJournal = await send(context, newOwner, 'journal')
    assert.deepEqual(loadedJournal.result.character, rewarded())
    journal({ entries: loadedJournal.result.entries }, 'completed')
    await approach(context, newOwner, NPC_ID)
    const remembered = await send(context, newOwner, 'talk', { targetId: NPC_ID })
    assert.deepEqual(remembered.result.character, rewarded())
    page(remembered.result, 'completed', ['leave'])
    assert.equal((await reply(context, newOwner, remembered.result, 'leave', remembered.revision)).ok, true)
    await character(context, newOwner, rewarded())
    for (const snapshot of newObserver.snapshots) publicState(snapshot, pages)
    assert.deepEqual(await fs.readFile(path.join(context.dataPath, OWNER_ID)), actorBytes)
    assert.deepEqual(await fs.readFile(path.join(context.dataPath, 'rules/Progression.json')), rulesBytes)
  })

test('racing owner completion replies grant exactly one XP reward and character reads preserve the private turn',
  { timeout: 20000 }, async t => {
    const context = await setup(t)
    const first = await context.connect(), second = await context.connect(), observer = await context.connect('observer')
    await join(first); await join(second); await join(observer)
    await approach(context, first, NPC_ID)
    const offer = await send(context, first, 'talk', { targetId: NPC_ID })
    assert.equal((await reply(context, first, offer.result, 'accept', offer.revision)).ok, true)
    await approach(context, first, GROUND_ITEM_ID)
    assert.equal((await send(context, first, 'pickup', { targetId: GROUND_ITEM_ID, expectedRevision: context.server.revision })).ok, true)
    await approach(context, first, NPC_ID)
    const firstPage = await send(context, first, 'talk', { targetId: NPC_ID })
    const revision = context.server.revision, priorCommand = actor(context.server.getSnapshot()).lastCommand
    await character(context, second, baseline())
    assert.equal(context.server.revision, revision)
    assert.deepEqual(actor(context.server.getSnapshot()).lastCommand, priorCommand)
    const secondPage = await send(context, second, 'talk', { targetId: NPC_ID })
    const results = await Promise.all([reply(context, first, firstPage.result, 'show', revision),
      reply(context, second, secondPage.result, 'show', revision)])
    assert.equal(results.filter(result => result.ok).length, 1, JSON.stringify(results))
    assert.ok(['CONVERSATION_EXPIRED', 'STALE_REVISION', 'REPLAYED_COMMAND'].includes(results.find(result => !result.ok).code))
    assert.equal(context.server.revision, revision + 1)
    assert.deepEqual(results.find(result => result.ok).result.character, rewarded())
    await character(context, first, rewarded()); await character(context, second, rewarded())
    const readJournal = await send(context, second, 'journal')
    assert.deepEqual(readJournal.result.character, rewarded())
    journal({ entries: readJournal.result.entries }, 'completed')
    assert.deepEqual((await send(context, first, 'inventory')).result.items, [pebble(0)], 'reward adds no inventory side effects')
    for (const snapshot of observer.snapshots) publicState(snapshot, [firstPage.result, secondPage.result])
  })

test('private character read enforces exact shape and ownership, works paused idle and rejects concurrent movement or checkpoint IO',
  { timeout: 16000 }, async t => {
    const context = await setup(t)
    const owner = await context.connect(), observer = await context.connect('observer')
    rejection(await send(context, owner, 'character'), 'NOT_JOINED')
    await join(owner); await join(observer)
    rejection(await send(context, observer, 'character'), 'FORBIDDEN')
    rejection(await send(context, owner, 'character', { version: 2 }), 'VERSION_MISMATCH')
    rejection(await send(context, owner, 'character', { actorId: 'another' }), 'FORBIDDEN')
    for (const data of [{ targetId: NPC_ID }, { expectedRevision: 0 }, { experiencePoints: 999999 },
      { level: 50 }, { unspentPoints: 56 }, { statId: 'strength' }, { rewardExperience: 2100 }] as const) {
      rejection(await send(context, owner, 'character', data), 'INVALID_COMMAND')
    }
    const before = await character(context, owner, baseline())
    rejection(await command(owner, before.id, 'character'), 'REPLAYED_COMMAND', before.id)
    assert.equal((await send(context, owner, 'pause')).ok, true)
    const frozenRevision = context.server.revision, frozenCommand = actor(context.server.getSnapshot()).lastCommand
    await character(context, owner, baseline())
    assert.equal(context.server.revision, frozenRevision)
    assert.deepEqual(actor(context.server.getSnapshot()).lastCommand, frozenCommand)
    assert.equal((await send(context, owner, 'resume')).ok, true)
    const moving = await send(context, owner, 'move', { target: [7, 7] })
    assert.equal(moving.ok, true, moving.message)
    assert.equal(moving.status, 'accepted')
    rejection(await send(context, owner, 'character'), 'BUSY')
    await snapshotWhere(owner, snapshot => actor(snapshot).lastCommand?.id === moving.id && !actor(snapshot).movement)
    const write = context.server.checkpointStore.write.bind(context.server.checkpointStore)
    let finish
    context.server.checkpointStore.write = document => new Promise(resolve => { finish = () => write(document).then(resolve) })
    const saving = send(context, owner, 'save')
    while (!finish) await new Promise(resolve => setTimeout(resolve, 1))
    rejection(await send(context, owner, 'character'), 'BUSY')
    finish(); assert.equal((await saving).ok, true)
    await character(context, owner, baseline())
    for (const snapshot of observer.snapshots) publicState(snapshot)
  })

test('an unmarked actor with raw converted stats remains explicitly unsupported for authoritative progression',
  { timeout: 10000 }, async t => {
    const context = await setup(t, async dataPath => {
      const filename = path.join(dataPath, OWNER_ID)
      const actor = JSON.parse(await fs.readFile(filename, 'utf8'))
      delete actor.Critter.progressionSupported
      actor.Critter.stats = { experiencePoints: 900000, level: 50, unspentPoints: 56 }
      await fs.writeFile(filename, JSON.stringify(actor))
    })
    const owner = await context.connect(), observer = await context.connect('observer')
    await join(owner); await join(observer)
    await character(context, owner, { kind: 'character', supported: false })
    const readJournal = await send(context, owner, 'journal')
    assert.deepEqual(readJournal.result.character, { kind: 'character', supported: false })
    await approach(context, owner, NPC_ID)
    const talk = await send(context, owner, 'talk', { targetId: NPC_ID })
    assert.deepEqual(talk.result.character, { kind: 'character', supported: false })
    for (const snapshot of observer.snapshots) publicState(snapshot, [talk.result])
  })
