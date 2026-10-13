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
const pebble = slot => ({ id: GROUND_ITEM_ID, slot, label: GROUND_ITEM_LABEL, type: 'Generic', prototypeId: 900007, canDrop: true })
const token = slot => ({ id: TOKEN_ID, slot, label: TOKEN_LABEL, type: 'Generic', prototypeId: 900003 })
let createAuthorityServer

before(async () => {
  const { build } = await import('esbuild')
  const result = await build({
    absWorkingDir: root,
    stdin: { contents: "export { createAuthorityServer } from './server/authority/AuthorityServer.ts';",
      resolveDir: source, sourcefile: 'attribute-network-test-entry.js' },
    bundle: true, platform: 'node', format: 'cjs', target: 'node24', write: false,
    external: ['electron', 'workerpool'], loader: { '.glsl': 'text' },
  })
  const compiled = new Module(path.join(__dirname, 'attribute-network-test-bundle.cjs'), module)
  compiled.filename = path.join(__dirname, 'attribute-network-test-bundle.cjs')
  compiled.paths = Module._nodeModulePaths(root)
  compiled._compile(result.outputFiles[0].text, compiled.filename)
  createAuthorityServer = compiled.exports.createAuthorityServer
})

async function setup(t: import("node:test").TestContext, mutate?) {
  const dataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'agate-attribute-network-'))
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
    'character', 'experiencePoints', 'level', 'unspentPoints', 'nextLevelExperience', 'rewardExperience',
    'attributes', 'derived', 'history', 'statId', 'maximum', 'pointCost', 'canIncrease'] as const) {
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
async function character(context, client, expected) {
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

const buy = (context, client, statId, revision, changes = {}) => send(context, client, 'buy-attribute', { statId, expectedRevision: revision, ...changes })
const attribute = (view, id) => view.attributes.find(row => row.id === id)
async function readView(context, client) {
  const read = await send(context, client, 'character')
  assert.equal(read.ok, true, read.message)
  return read
}
async function acceptQuest(context, client) {
  await approach(context, client, NPC_ID)
  const talk = await send(context, client, 'talk', { targetId: NPC_ID })
  assert.equal(talk.ok, true, talk.message)
  const accepted = await reply(context, client, talk.result, 'accept', talk.revision)
  assert.equal(accepted.ok, true, accepted.message)
  return accepted
}

test('socket attribute purchases spend one point, preserve eight private attributes and derived previews, and restore on a fresh host',
  { timeout: 12000 }, async t => {
    const context = await setup(t)
    const owner = await context.connect(), observer = await context.connect('observer')
    const first = await join(owner); await join(observer)
    publicState(first.snapshot)
    const initial = await readView(context, owner)
    assert.deepEqual(initial.result, baseline())
    const purchased = await buy(context, owner, 'strength', initial.revision)
    assert.equal(purchased.ok, true, purchased.message)
    const strength = { ...baseline(), unspentPoints: 4,
      attributes: rows().map(row => row.id === 'strength' ? { ...row, value: 9 } : row),
      derived: { ...baseDerived(), maxHealth: 32, carryWeight: 4500, damageBonus: 0 } }
    assert.deepEqual(purchased.result, { kind: 'buy-attribute', statId: 'strength', character: strength })
    assert.equal(purchased.revision, initial.revision + 1)
    assert.deepEqual(actor(context.server.getSnapshot()).lastCommand,
      { id: purchased.id, type: 'buy-attribute', status: 'completed', result: { kind: 'buy-attribute' } })
    const wanted = ['strength', 'dexterity', 'constitution', 'beauty', 'intelligence']
    let latest = purchased
    for (const statId of wanted.slice(1)) {
      latest = await buy(context, owner, statId, latest.revision)
      assert.equal(latest.ok, true, latest.message)
    }
    const exhausted = latest.result.character
    assert.equal(exhausted.experiencePoints, 0)
    assert.equal(exhausted.level, 1)
    assert.equal(exhausted.unspentPoints, 0)
    assert.deepEqual(exhausted.attributes.map(row => row.id), ATTRIBUTE_IDS)
    for (const row of exhausted.attributes) {
      assert.equal(row.value, wanted.includes(row.id) ? 9 : 8)
      assert.equal(row.maximum, 20); assert.equal(row.pointCost, 1)
      assert.equal(row.canIncrease, false)
      assert.equal(row.reason, 'Not enough Character Points.')
    }
    rejection(await buy(context, owner, 'perception', latest.revision), 'INSUFFICIENT_POINTS')
    rejection(await command(owner, latest.id, 'buy-attribute', { statId: 'intelligence', expectedRevision: latest.revision }), 'REPLAYED_COMMAND')
    assert.deepEqual((await readView(context, owner)).result, exhausted)
    assert.deepEqual((await send(context, owner, 'inventory')).result.items, [])
    const saved = await send(context, owner, 'save')
    assert.equal(saved.ok, true, saved.message)
    const document = JSON.parse(await fs.readFile(context.server.checkpointStore.filename, 'utf8'))
    assert.equal(document.version, 6)
    assert.equal(document.rulesVersion, 'movement-doors-ownership-attributes-v9')
    assert.deepEqual(document.character.history, wanted.map(statId => ({ kind: 'attribute', statId })))
    assert.deepEqual(document.character.attributes, Object.fromEntries(ATTRIBUTE_IDS.map(id => [id, wanted.includes(id) ? 9 : 8])))
    const late = await context.connect('observer'); publicState((await join(late)).snapshot)
    for (const snapshot of observer.snapshots) publicState(snapshot)
    await context.server.stop()
    const restarted = await context.start(), newOwner = await restarted.connect(), newObserver = await restarted.connect('observer')
    await join(newOwner); await join(newObserver); context.nextId = 1
    assert.deepEqual((await readView(context, newOwner)).result, baseline())
    assert.equal((await send(context, newOwner, 'load')).ok, true)
    assert.deepEqual((await readView(context, newOwner)).result, exhausted)
    rejection(await buy(context, newOwner, 'perception', restarted.server.revision), 'INSUFFICIENT_POINTS')
    for (const snapshot of newObserver.snapshots) publicState(snapshot)
  })

test('owner sockets racing the same fresh attribute revision have one purchase and no doubled stat or point cost',
  { timeout: 10000 }, async t => {
    const context = await setup(t)
    const first = await context.connect(), second = await context.connect(), observer = await context.connect('observer')
    await join(first); await join(second); await join(observer)
    const view = await readView(context, first), revision = view.revision
    const results = await Promise.all([buy(context, first, 'strength', revision), buy(context, second, 'strength', revision)])
    assert.equal(results.filter(result => result.ok).length, 1, JSON.stringify(results))
    assert.ok(['STALE_REVISION', 'REPLAYED_COMMAND'].includes(results.find(result => !result.ok).code))
    assert.equal(context.server.revision, revision + 1)
    const after = (await readView(context, first)).result
    assert.equal(attribute(after, 'strength').value, 9)
    assert.equal(after.unspentPoints, 4)
    assert.deepEqual((await readView(context, second)).result, after)
    rejection(await buy(context, first, 'strength', revision), 'STALE_REVISION')
    assert.deepEqual((await readView(context, first)).result, after)
    for (const snapshot of observer.snapshots) publicState(snapshot)
  })

test('bank saturation preserves purchase and quest award order in live sockets and checkpoint validation',
  { timeout: 33000 }, async t => {
    for (const purchaseFirst of [true, false] as const) {
      const context = await setup(t, async dataPath => {
        const filename = path.join(dataPath, 'rules/Progression.json')
        const rules = JSON.parse(await fs.readFile(filename, 'utf8'))
        rules.baseline.unspentPoints = 56
        rules.baseline.attributes.strength = 20
        await fs.writeFile(filename, JSON.stringify(rules))
      })
      const owner = await context.connect(), observer = await context.connect('observer')
      await join(owner); await join(observer)
      const initial = await readView(context, owner)
      assert.equal(initial.result.unspentPoints, 56)
      assert.equal(attribute(initial.result, 'strength').canIncrease, false)
      assert.equal(attribute(initial.result, 'strength').reason, 'Attribute is at its maximum.')
      rejection(await buy(context, owner, 'strength', initial.revision), 'ATTRIBUTE_AT_MAX')
      if (purchaseFirst) assert.equal((await buy(context, owner, 'dexterity', context.server.revision)).ok, true)
      await acceptQuest(context, owner)
      const completed = await showPebble(context, owner)
      if (!purchaseFirst) assert.equal((await buy(context, owner, 'dexterity', context.server.revision)).ok, true)
      const after = (await readView(context, owner)).result
      assert.equal(after.experiencePoints, 2100)
      assert.equal(after.level, 2)
      assert.equal(attribute(after, 'dexterity').value, 9)
      assert.equal(after.unspentPoints, purchaseFirst ? 56 : 55, 'points spent before a capped award remain available to receive it')
      const saved = await send(context, owner, 'save')
      assert.equal(saved.ok, true, saved.message)
      const filename = context.server.checkpointStore.filename
      const bytes = await fs.readFile(filename, 'utf8'), document = JSON.parse(bytes)
      assert.deepEqual(document.character.history, purchaseFirst
        ? [{ kind: 'attribute', statId: 'dexterity' }, { kind: 'quest', questId: QUEST_ID }]
        : [{ kind: 'quest', questId: QUEST_ID }, { kind: 'attribute', statId: 'dexterity' }])
      document.character.history.reverse()
      await fs.writeFile(filename, JSON.stringify(document))
      const prior = context.server.getSnapshot()
      rejection(await send(context, owner, 'load'), 'CHECKPOINT_INVALID')
      assert.deepEqual((await readView(context, owner)).result, after, 'a reordered history cannot partially apply character values')
      assert.deepEqual(actor(context.server.getSnapshot()).location, actor(prior).location)
      await fs.writeFile(filename, bytes)
      const another = await buy(context, owner, 'constitution', context.server.revision)
      assert.equal(another.ok, true, another.message)
      assert.equal(another.result.character.unspentPoints, after.unspentPoints - 1)
      assert.equal((await send(context, owner, 'load')).ok, true)
      assert.deepEqual((await readView(context, owner)).result, after, 'loading an earlier purchased timeline restores points and attributes together')
      for (const snapshot of observer.snapshots) publicState(snapshot, [completed.completed.result])
      await context.server.stop()
    }
  })

test('buy-attribute envelopes enforce authority, schema, pause, movement, checkpoint and current revision guards',
  { timeout: 12000 }, async t => {
    const context = await setup(t)
    const owner = await context.connect(), observer = await context.connect('observer')
    rejection(await send(context, owner, 'buy-attribute', { statId: 'strength', expectedRevision: 0 }), 'NOT_JOINED')
    await join(owner); await join(observer)
    rejection(await buy(context, observer, 'strength', context.server.revision), 'FORBIDDEN')
    rejection(await buy(context, owner, 'strength', 0, { version: 2 }), 'VERSION_MISMATCH')
    rejection(await buy(context, owner, 'strength', 0, { actorId: 'another' }), 'FORBIDDEN')
    for (const data of [{}, { statId: 'strength' }, { statId: 'unknown', expectedRevision: 0 }, { statId: '', expectedRevision: 0 },
      { statId: 'strength', expectedRevision: -1 }, { statId: 'strength', expectedRevision: 0.5 },
      { statId: 'strength', expectedRevision: 0, value: 20 }, { statId: 'strength', expectedRevision: 0, pointCost: 0 },
      { statId: 'strength', expectedRevision: 0, unspentPoints: 56 }] as const) {
      rejection(await send(context, owner, 'buy-attribute', data), 'INVALID_COMMAND')
    }
    assert.equal((await send(context, owner, 'pause')).ok, true)
    rejection(await buy(context, owner, 'strength', context.server.revision), 'PAUSED')
    await character(context, owner, baseline())
    assert.equal((await send(context, owner, 'resume')).ok, true)
    const moving = await send(context, owner, 'move', { target: [7, 7] })
    assert.equal(moving.ok, true, moving.message)
    rejection(await buy(context, owner, 'strength', context.server.revision), 'BUSY')
    await snapshotWhere(owner, snapshot => actor(snapshot).lastCommand?.id === moving.id && !actor(snapshot).movement)
    const write = context.server.checkpointStore.write.bind(context.server.checkpointStore)
    let finish
    context.server.checkpointStore.write = document => new Promise(resolve => { finish = () => write(document).then(resolve) })
    const saving = send(context, owner, 'save')
    while (!finish) await new Promise(resolve => setTimeout(resolve, 1))
    rejection(await buy(context, owner, 'strength', context.server.revision), 'BUSY')
    finish(); assert.equal((await saving).ok, true)
    rejection(await buy(context, owner, 'strength', 0), 'STALE_REVISION')
    await character(context, owner, baseline())
    for (const snapshot of observer.snapshots) publicState(snapshot)
  })

test('an unmarked actor cannot buy attributes from legacy raw stats', { timeout: 10000 }, async t => {
  const context = await setup(t, async dataPath => {
    const filename = path.join(dataPath, OWNER_ID), actor = JSON.parse(await fs.readFile(filename, 'utf8'))
    delete actor.Critter.progressionSupported
    actor.Critter.stats = { strength: 8, experiencePoints: 0, level: 1, unspentPoints: 56 }
    await fs.writeFile(filename, JSON.stringify(actor))
  })
  const owner = await context.connect(), observer = await context.connect('observer')
  await join(owner); await join(observer)
  const revision = context.server.revision
  await character(context, owner, { kind: 'character', supported: false })
  rejection(await buy(context, owner, 'strength', revision), 'PROGRESSION_UNAVAILABLE')
  assert.equal(context.server.revision, revision)
  await character(context, owner, { kind: 'character', supported: false })
  assert.deepEqual((await send(context, owner, 'inventory')).result.items, [])
  for (const snapshot of observer.snapshots) publicState(snapshot)
})
