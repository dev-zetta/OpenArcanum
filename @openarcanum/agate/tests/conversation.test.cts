const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const { before, test } = require('node:test') as typeof import('node:test')
const fs = require('node:fs/promises') as typeof import('node:fs/promises')
const os = require('node:os') as typeof import('node:os')
const path = require('node:path') as typeof import('node:path')
const Module = require('node:module') as typeof import('node:module')
const { generate, MAP_ID, BOX_ID, TOKEN_ID, GROUND_ITEM_ID, NPC_ID, NPC_LABEL, QUEST_ID, QUEST_TITLE } = require('../../../examples/inventory-workshop/generate.cts')
const root = path.resolve(__dirname, '../../..')
const source = path.join(root, '@openarcanum/agate/src')
let engine

before(async () => {
  const { build } = await import('esbuild')
  const result = await build({
    absWorkingDir: root,
    stdin: { contents: `export { createAuthorityServer } from './server/authority/AuthorityServer.ts';`,
      resolveDir: source, sourcefile: 'conversation-tests.js' },
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
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agate-conversation-'))
  await generate(directory)
  const dataPath = path.join(directory, 'data'), checkpointPath = path.join(directory, 'checkpoint.json')
  const change = async (name, update) => {
    const filename = path.join(dataPath, name)
    const data = JSON.parse(await fs.readFile(filename, 'utf8'))
    update(data)
    await fs.writeFile(filename, JSON.stringify(data))
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
    const command = (type, extra = {}, socket = owner) => server.command(socket, {
      version: 1, id: server.lastCommandId + 1, actorId: '0', type, ...extra,
    })
    const finish = () => server.advanceMovement(performance.now() + 120000)
    const use = targetId => {
      const response = command('use', { targetId })
      if (response.status === 'accepted') finish()
      return response
    }
    const talk = (socket = owner) => command('talk', { targetId: NPC_ID }, socket)
    const reply = (page, optionId, extra = {}, socket = owner) => command('reply', {
      targetId: NPC_ID, conversationId: page.conversationId, optionId, expectedRevision: server.revision, ...extra,
    }, socket)
    const pickup = () => {
      assert.equal(use(GROUND_ITEM_ID).ok, true)
      return command('pickup', { targetId: GROUND_ITEM_ID, expectedRevision: server.revision })
    }
    const journal = () => command('journal').result.entries
    const quest = () => server.conversations.quests.get(QUEST_ID)
    const state = () => ({ actor: [server.player.base.location.x, server.player.base.location.y],
      doors: server.doors.checkpointStates(), ownership: server.ownership.checkpointStates(),
      quests: server.conversations.checkpointStates(), revision: server.revision })
    return { server, owner, command, finish, use, talk, reply, pickup, journal, quest, state }
  }
  return { start, change, dataPath, checkpointPath }
}

test('authored stationary NPC approach is authoritative while dialogue and journal reads remain private and nonmutating', async t => {
  const { start } = await fixture(t)
  const context = await start(), { server, command, talk, reply, journal, use } = context
  assert.deepEqual(server.getSnapshot().conversationTargets, [{ id: NPC_ID, kind: 'conversation', label: NPC_LABEL, location: [9, 8] }])
  assert.equal(server.world.entityManager.systems.size, 0)
  assert.equal(talk().code, 'OUT_OF_RANGE')
  assert.deepEqual(journal(), [])
  const approach = use(NPC_ID)
  assert.equal(approach.status, 'accepted')
  assert.deepEqual(server.lastCommand.result, { kind: 'conversation', targetId: NPC_ID })
  assert.equal(Math.abs(server.player.base.location.x - 9) + Math.abs(server.player.base.location.y - 8), 1)
  const revision = server.revision, lastCommand = structuredClone(server.lastCommand)
  const first = talk()
  assert.equal(first.ok, true)
  assert.equal(first.result.closed, false)
  assert.equal(first.result.nodeId, 'offer')
  assert.equal(first.result.speaker, NPC_LABEL)
  assert.deepEqual(first.result.options.map(option => option.id), ['accept', 'leave'])
  assert.deepEqual(first.result.journal, { entries: [] })
  assert.deepEqual(command('inventory').result.items, [])
  assert.deepEqual(journal(), [])
  assert.equal(server.revision, revision)
  assert.deepEqual(server.lastCommand, lastCommand)
  const second = talk()
  assert.notEqual(first.result.conversationId, second.result.conversationId)
  assert.equal(reply(first.result, 'accept').code, 'CONVERSATION_EXPIRED')
  const closed = reply(second.result, 'leave')
  assert.deepEqual(closed.result, { kind: 'conversation', targetId: NPC_ID, closed: true, journal: { entries: [] },
    character: command('character').result })
  assert.equal(server.revision, revision)
  assert.equal(server.conversations.active, null)
  const snapshot = JSON.stringify(server.getSnapshot())
  for (const value of [QUEST_ID, QUEST_TITLE, first.result.text, first.result.conversationId, 'journal', 'options'] as const) assert.equal(snapshot.includes(value), false, value)
})

test('accept and currently held pebble completion each commit once without consuming, transferring or rewarding any item', async t => {
  const { start } = await fixture(t)
  const context = await start(), { server, use, talk, reply, pickup, journal, quest } = context
  use(NPC_ID)
  const offer = talk().result, before = server.revision
  const accepted = reply(offer, 'accept')
  assert.equal(accepted.ok, true)
  assert.equal(server.revision, before + 1)
  assert.equal(accepted.result.nodeId, 'active')
  assert.deepEqual(accepted.result.options.map(option => option.id), ['leave'])
  assert.equal(quest().status, 'active')
  assert.equal(journal()[0].title, QUEST_TITLE)
  assert.equal(reply(accepted.result, 'show').code, 'INVALID_OPTION')
  assert.equal(reply(offer, 'accept').code, 'CONVERSATION_EXPIRED')
  assert.equal(pickup().ok, true)
  use(NPC_ID)
  const page = talk().result, inventory = server.ownership.checkpointStates(), revision = server.revision
  assert.deepEqual(page.options.map(option => option.id), ['show', 'leave'])
  const finished = reply(page, 'show')
  assert.equal(finished.ok, true)
  assert.equal(server.revision, revision + 1)
  assert.equal(finished.result.nodeId, 'completed')
  assert.deepEqual(finished.result.options.map(option => option.id), ['leave'])
  assert.equal(quest().status, 'completed')
  assert.deepEqual(server.ownership.checkpointStates(), inventory)
  assert.equal(server.ownership.actorInventory().items[0].id, GROUND_ITEM_ID)
  assert.deepEqual(server.lastCommand, { id: finished.id, type: 'reply', status: 'completed', result: { kind: 'reply' } })
  assert.deepEqual(journal().map(entry => [entry.id, entry.status]), [[QUEST_ID, 'completed']])
  const completedRevision = server.revision
  assert.equal(reply(page, 'show').code, 'CONVERSATION_EXPIRED')
  assert.equal(server.revision, completedRevision)
  const publicState = JSON.stringify(server.getSnapshot())
  for (const privateValue of [GROUND_ITEM_ID, QUEST_ID, QUEST_TITLE, page.text, 'completedText', 'journal', 'options', 'conversationId'] as const) {
    assert.equal(publicState.includes(privateValue), false, privateValue)
  }
})

test('conversation commands enforce exact schemas, global replay prevention, role, range, pause and busy guards', async t => {
  const { start } = await fixture(t)
  const context = await start(), { server, command, use, talk, reply } = context
  for (const [kind, extra] of [ ['journal', { entries: [] }], ['talk', { targetId: NPC_ID, optionId: 'accept' }],
    ['reply', { targetId: NPC_ID, conversationId: 'x', optionId: 'accept', expectedRevision: 0.5 }],
    ['reply', { targetId: NPC_ID, conversationId: 'x'.repeat(129), optionId: 'accept', expectedRevision: 0 }],
    ['reply', { targetId: NPC_ID, conversationId: 'x', optionId: 'accept', expectedRevision: 0, reward: true }] ] as const) {
    assert.equal(command(kind, extra).code, 'INVALID_COMMAND')
  }
  const observer = { data: { joined: true, role: 'observer' } }
  assert.equal(command('journal', {}, observer).code, 'FORBIDDEN')
  assert.equal(command('talk', { targetId: NPC_ID }, observer).code, 'FORBIDDEN')
  assert.equal(command('talk', { targetId: NPC_ID }, { data: { joined: false, role: 'owner' } }).code, 'NOT_JOINED')
  assert.equal(command('talk', { targetId: 'missing' }).code, 'UNKNOWN_TARGET')
  const movement = command('use', { targetId: NPC_ID })
  assert.equal(movement.status, 'accepted')
  assert.equal(talk().code, 'BUSY')
  context.finish()
  const page = talk().result
  assert.equal(reply(page, 'accept', { expectedRevision: server.revision - 1 }).code, 'STALE_REVISION')
  assert.equal(command('pause').ok, true)
  assert.equal(talk().code, 'PAUSED')
  assert.equal(command('journal').ok, true)
  assert.equal(command('resume').ok, true)
  assert.equal(reply(page, 'accept').code, 'CONVERSATION_EXPIRED')
  const replayId = server.lastCommandId
  assert.equal(command('journal', { id: replayId }).code, 'REPLAYED_COMMAND')
  server.checkpointBusy = true
  assert.equal(command('journal').code, 'BUSY')
  server.checkpointBusy = false
  use(NPC_ID)
  assert.equal(talk().ok, true)
})

test('private turns are socket-bound and two authorized owners cannot commit one response twice', async t => {
  const { start } = await fixture(t)
  const context = await start(), { server, use, talk, reply, owner, command } = context
  use(NPC_ID)
  const other = { data: { joined: true, role: 'owner' } }, first = talk().result
  assert.equal(reply(first, 'accept', {}, other).code, 'CONVERSATION_EXPIRED')
  assert.equal(server.conversations.active.socket, owner)
  const replacement = talk(other).result
  assert.equal(reply(first, 'accept').code, 'CONVERSATION_EXPIRED')
  const revision = server.revision
  const committed = reply(replacement, 'accept', {}, other)
  assert.equal(committed.ok, true)
  assert.equal(server.revision, revision + 1)
  assert.equal(reply(replacement, 'accept', { expectedRevision: revision }, other).code, 'STALE_REVISION')
  assert.equal(reply(replacement, 'accept', {}, other).code, 'CONVERSATION_EXPIRED')
  assert.equal(command('reply', { id: committed.id, targetId: NPC_ID, conversationId: replacement.conversationId,
    optionId: 'accept', expectedRevision: revision }, other).code, 'REPLAYED_COMMAND')
  server.conversations.invalidate(other)
  assert.equal(server.conversations.active, null)
})

test('accepted unrelated actions invalidate turns while private inventory and journal reads preserve them', async t => {
  const { start } = await fixture(t, change => change(NPC_ID, data => { data.Base.location = [5, 5] }))
  const context = await start(), { server, command, talk, reply } = context
  assert.equal(command('move', { target: [5, 4] }).ok, true)
  context.finish()
  let page = talk().result
  command('inventory'); command('journal')
  assert.equal(reply(page, 'leave').ok, true)
  const assertInvalidated = action => {
    page = talk().result
    assert.equal(action().ok, true)
    assert.equal(reply(page, 'accept').code, 'CONVERSATION_EXPIRED')
  }
  assertInvalidated(() => command('move', { target: [5, 4] }))
  assertInvalidated(() => command('use', { targetId: BOX_ID }))
  assertInvalidated(() => command('inspect', { targetId: BOX_ID }))
  assertInvalidated(() => command('take', { targetId: BOX_ID, itemId: TOKEN_ID, expectedRevision: server.revision }))
  assertInvalidated(() => command('put', { targetId: BOX_ID, itemId: TOKEN_ID, expectedRevision: server.revision }))
  page = talk().result
  assert.equal((await command('save')).ok, true)
  assert.equal(reply(page, 'accept').code, 'CONVERSATION_EXPIRED')
  page = talk().result
  assert.equal((await command('load')).ok, true)
  assert.equal(reply(page, 'accept').code, 'CONVERSATION_EXPIRED')
  page = talk().result
  assert.equal(command('pause').ok, true)
  command('resume')
  assert.equal(reply(page, 'accept').code, 'CONVERSATION_EXPIRED')
  page = talk().result
  assert.equal(command('use', { targetId: 'missing' }).code, 'UNKNOWN_TARGET')
  assert.equal(reply(page, 'leave').ok, true, 'rejected unrelated action does not consume the active turn')
})

test('reply revalidates current reciprocal held-item ownership, not the earlier page or nearby floor placement', async t => {
  const { start } = await fixture(t)
  const context = await start(), { server, use, talk, reply, pickup, quest } = context
  use(NPC_ID)
  assert.equal(reply(talk().result, 'accept').ok, true)
  assert.equal(pickup().ok, true)
  use(NPC_ID)
  const page = talk().result, revision = server.revision
  assert.equal(page.options.some(option => option.id === 'show'), true)
  assert.equal(server.ownership.drop(GROUND_ITEM_ID).result.kind, 'drop', 'simulate content changing outside a command')
  assert.equal(reply(page, 'show').code, 'CONDITION_NOT_MET')
  assert.equal(server.revision, revision)
  assert.equal(quest().status, 'active')
  assert.equal(server.ownership.pickup(GROUND_ITEM_ID).result.kind, 'pickup')
  const held = server.ownership.items.get(GROUND_ITEM_ID).entity
  Object.defineProperty(held.item, 'parent', { value: BOX_ID, writable: true, configurable: true })
  assert.equal(reply(page, 'show').code, 'INVENTORY_UNAVAILABLE')
  assert.equal(quest().status, 'active')
  assert.equal(server.revision, revision)
})

test('changed NPC metadata or position interrupts an approach and cannot enable unsupported original conversations', async t => {
  const { start } = await fixture(t)
  const context = await start(), { server, command, finish } = context
  assert.equal(command('use', { targetId: NPC_ID }).status, 'accepted')
  const npc = server.conversations.targets.get(NPC_ID).entity
  npc.base.location.set([10, 8])
  finish()
  assert.equal(server.lastCommand.status, 'interrupted')
  assert.equal(server.lastCommand.code, 'TARGET_CHANGED')
  npc.base.location.set([9, 8])
  Object.defineProperty(npc.npc, 'conversationSupported', { value: false, writable: true, configurable: true })
  assert.deepEqual(server.getSnapshot().conversationTargets, [])
  assert.equal(command('talk', { targetId: NPC_ID }).code, 'UNKNOWN_TARGET')
  Object.defineProperty(npc.npc, 'conversationId', { value: 'changed', writable: true, configurable: true })
  Object.defineProperty(npc.npc, 'conversationSupported', { value: true, writable: true, configurable: true })
  assert.equal(command('talk', { targetId: NPC_ID }).code, 'UNKNOWN_TARGET')
})

test('NPC approach uses map collision and never bypasses an unreachable cardinal neighbor', async t => {
  const { start } = await fixture(t, change => change(`${MAP_ID}/Sector/0/0/Sector.json`, data => {
    for (const [x, y] of [[8, 8], [9, 7], [9, 9], [10, 8]] as const) data.tiles[x][y].blocked = true
  }))
  const { server, use } = await start()
  assert.equal(use(NPC_ID).code, 'NO_PATH')
  assert.equal(server.movement, null)
})

test('checkpoint stores fixed quest states without dialogue tokens and restores completed journal with pebble put away on a fresh host', async t => {
  const { start, checkpointPath } = await fixture(t)
  const context = await start(), { server, command, use, talk, reply, pickup, journal } = context
  assert.deepEqual(server.createCheckpoint().quests, [{ id: QUEST_ID, status: 'absent' }])
  use(NPC_ID)
  reply(talk().result, 'accept')
  assert.deepEqual(server.createCheckpoint().quests, [{ id: QUEST_ID, status: 'active' }])
  pickup(); use(NPC_ID)
  reply(talk().result, 'show')
  assert.equal(command('drop', { itemId: GROUND_ITEM_ID, expectedRevision: server.revision }).ok, true)
  const completed = journal()
  assert.equal((await command('save')).ok, true)
  const bytes = await fs.readFile(checkpointPath, 'utf8'), document = JSON.parse(bytes)
  assert.equal(document.version, 6)
  assert.equal(document.rulesVersion, 'movement-doors-ownership-attributes-v9')
  assert.deepEqual(document.quests, [{ id: QUEST_ID, status: 'completed' }])
  for (const value of ['conversationId', 'options', 'speaker', QUEST_TITLE] as const) assert.equal(bytes.includes(value), false, value)
  await server.stop()
  const fresh = await start()
  assert.deepEqual(fresh.journal(), [])
  assert.equal((await fresh.command('load')).ok, true)
  assert.deepEqual(fresh.journal(), completed)
  assert.equal(fresh.server.conversations.active, null)
  assert.deepEqual(fresh.server.ownership.actorInventory().items, [])
  assert.equal(fresh.talk().result.nodeId, 'completed')
})

test('quest checkpoint tamper is prevalidated atomically and old checkpoints are rejected without overwriting their file', async t => {
  const { start, checkpointPath } = await fixture(t)
  const context = await start(), { server, state, command } = context
  const document = server.createCheckpoint(), original = state()
  for (const quests of [[], [{ id: QUEST_ID, status: 'offer' }], [{ id: 'fabricated', status: 'active' }],
    [{ id: QUEST_ID, status: 'active', reward: TOKEN_ID }], [{ id: QUEST_ID, status: 'active' }, { id: QUEST_ID, status: 'completed' }]] as const) {
    assert.throws(() => server.validateCheckpoint({ ...document, quests }), { code: 'CHECKPOINT_INVALID' })
    assert.deepEqual(state(), original)
  }
  const old = JSON.stringify({ ...document, version: 3, rulesVersion: 'movement-doors-ownership-v6' })
  await fs.writeFile(checkpointPath, old)
  assert.equal((await command('load')).code, 'CHECKPOINT_INCOMPATIBLE')
  assert.equal(await fs.readFile(checkpointPath, 'utf8'), old)
  assert.deepEqual(server.conversations.checkpointStates(), original.quests)
})

test('quest writes preflight immutable fields and rollback a failing checkpoint after actor, doors and ownership apply', async t => {
  const { start } = await fixture(t)
  const first = await start()
  first.use(NPC_ID)
  const page = first.talk().result, revision = first.server.revision
  Object.defineProperty(first.quest(), 'status', { value: 'absent', writable: false, configurable: false })
  assert.equal(first.reply(page, 'accept').code, 'QUEST_UNAVAILABLE')
  assert.equal(first.quest().status, 'absent')
  assert.equal(first.server.revision, revision)
  await first.server.stop()
  const second = await start(), { server, state } = second
  const before = state(), saved = server.createCheckpoint()
  saved.actor.location = [5, 4]
  saved.quests[0].status = 'active'
  const quest = second.quest()
  let fail = true
  server.conversations.quests.set(QUEST_ID, new Proxy(quest, {
    defineProperty(target, property, descriptor) {
      if (property === 'status' && fail) { fail = false; throw new Error('Synthetic quest commit failure') }
      return Reflect.defineProperty(target, property, descriptor)
    },
  }))
  const candidate = server.validateCheckpoint(saved)
  assert.throws(() => server.applyCheckpoint(candidate), { code: 'CHECKPOINT_INVALID' })
  assert.deepEqual(state(), before)
})

test('unknown original actor ownership cannot satisfy held-item completion or fabricate a completed quest checkpoint', async t => {
  const { start } = await fixture(t, change => change('16086.json', data => { delete data.Critter.inventory }))
  const context = await start(), { server, use, talk, reply, command } = context
  use(NPC_ID)
  const accepted = reply(talk().result, 'accept')
  assert.equal(accepted.ok, true)
  assert.deepEqual(accepted.result.options.map(option => option.id), ['leave'])
  assert.equal(command('inventory').code, 'INVENTORY_UNAVAILABLE')
  const document = server.createCheckpoint()
  document.quests[0].status = 'completed'
  assert.throws(() => server.validateCheckpoint(document), { code: 'CHECKPOINT_INVALID' })
})

test('authored simulation rules enter the content fingerprint while private text never enters checkpoints', async t => {
  const { start, change } = await fixture(t)
  const first = await start(), checkpoint = first.server.createCheckpoint()
  await first.server.stop()
  await change('rules/Conversations.json', document => { document.conversations[0].nodes[0].text += ' Revised.' })
  const second = await start()
  assert.notEqual(second.server.contentIdentity, checkpoint.contentIdentity)
  assert.throws(() => second.server.validateCheckpoint(checkpoint), { code: 'CHECKPOINT_INCOMPATIBLE' })
})

test('declarative conversation data rejects arbitrary effects, unknown item references, oversized graphs and ambiguous stage identities', async t => {
  for (const [name, modify] of [
    ['script effect', document => { document.conversations[0].nodes[0].options[0].effect = 'script' }],
    ['extra expression', document => { document.conversations[0].nodes[0].options[0].when = 'true' }],
    ['unknown item', document => { document.conversations[0].nodes[1].options[0].condition.itemId = 'unregistered' }],
    ['duplicate quest', document => { document.quests.push({ ...document.quests[0] }) }],
    ['duplicate stage', document => { document.conversations[0].nodes[1].id = 'offer' }],
    ['oversized choices', document => { document.conversations[0].nodes[0].options = Array.from({ length: 6 }, (_, index) => ({ id: `close${index}`, text: 'Bye', effect: 'close' })) }],
    ['effect in completed stage', document => { document.conversations[0].nodes[2].options[0].effect = 'start' }],
    ['missing exit', document => { document.conversations[0].nodes[0].options.pop() }],
    ['control characters', document => { document.conversations[0].nodes[0].text += '\u0001' }],
  ] as const) {
    await t.test(name, async child => {
      const { start } = await fixture(child, change => change('rules/Conversations.json', modify))
      await assert.rejects(start(), /conversation rules are invalid or unsupported/)
    })
  }
})

test('missing optional rules are safe for maps without opted-in NPCs but marked NPCs fail closed', async t => {
  await t.test('ordinary NPC', async child => {
    const { start } = await fixture(child, async (change, dataPath) => {
      await fs.rm(path.join(dataPath, 'rules/Conversations.json'))
      await change(NPC_ID, data => { data.Npc = { conversationSupported: false } })
    })
    const { server, command } = await start()
    assert.deepEqual(server.getSnapshot().conversationTargets, [])
    assert.deepEqual(command('journal').result, { kind: 'journal', entries: [], character: command('character').result })
    assert.deepEqual(server.createCheckpoint().quests, [])
  })
  await t.test('marked NPC', async child => {
    const { start } = await fixture(child, async (_change, dataPath) => { await fs.rm(path.join(dataPath, 'rules/Conversations.json')) })
    await assert.rejects(start(), /conversation rules are missing/)
  })
})
