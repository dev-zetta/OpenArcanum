const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const { before, test } = require('node:test') as typeof import('node:test')
const fs = require('node:fs/promises') as typeof import('node:fs/promises')
const os = require('node:os') as typeof import('node:os')
const path = require('node:path') as typeof import('node:path')
const Module = require('node:module') as typeof import('node:module')
const { generate, MAP_ID, BOX_ID, TOKEN_ID, GROUND_ITEM_ID, NPC_ID, QUEST_ID } = require('../../../examples/inventory-workshop/generate.cts')
const root = path.resolve(__dirname, '../../..'), source = path.join(root, '@openarcanum/agate/src')
let engine
const attributePairs = [['strength', 'Strength'], ['dexterity', 'Dexterity'], ['constitution', 'Constitution'], ['beauty', 'Beauty'],
  ['intelligence', 'Intelligence'], ['perception', 'Perception'], ['willpower', 'Willpower'], ['charisma', 'Charisma']]
const baseAttributes = Object.fromEntries(attributePairs.map(([id]) => [id, 8]))
const presentation = (level, points) => ({ attributes: attributePairs.map(([id, label]) => ({ id, label, value: 8,
  maximum: 20, pointCost: 1, canIncrease: points > 0, ...(points ? {} : { reason: 'Not enough Character Points.' }) })),
  derived: { maxHealth: 28 + 2 * level, maxFatigue: 28 + 2 * level, carryWeight: 4000, damageBonus: -1,
    armorClassAdjustment: -2, speed: 8, healRate: 3, poisonRecovery: 8, reactionModifier: -7, maxFollowers: 2 } })
const initial = { kind: 'character', supported: true, experiencePoints: 0, level: 1, unspentPoints: 5, nextLevelExperience: 2100, ...presentation(1, 5) }
const advanced = { kind: 'character', supported: true, experiencePoints: 2100, level: 2, unspentPoints: 6, nextLevelExperience: 4600, ...presentation(2, 6) }
const stateOf = view => ({ experiencePoints: view.experiencePoints, level: view.level, unspentPoints: view.unspentPoints,
  attributes: { ...baseAttributes }, history: view.experiencePoints ? [{ kind: 'quest', questId: QUEST_ID }] : [] })
const baseline = { experiencePoints: 0, level: 1, unspentPoints: 5, attributes: { ...baseAttributes } }

before(async () => {
  const { build } = await import('esbuild')
  const result = await build({ absWorkingDir: root,
    stdin: { contents: `export { createAuthorityServer } from './server/authority/AuthorityServer.ts';
      export { default as CharacterProgression, LEVEL_EXPERIENCE, MAX_EXPERIENCE, MAX_CHARACTER_POINTS } from './server/authority/CharacterProgression.ts';`,
      resolveDir: source, sourcefile: 'progression-tests.js' },
    bundle: true, platform: 'node', format: 'cjs', target: 'node24', write: false,
    external: ['electron', 'workerpool'], loader: { '.glsl': 'text' },
  })
  const compiled = new Module(__filename + '.bundle.cjs', module)
  compiled.filename = __filename + '.bundle.cjs'; compiled.paths = Module._nodeModulePaths(root)
  compiled._compile(result.outputFiles[0].text, compiled.filename)
  engine = compiled.exports
})

async function fixture(t: import("node:test").TestContext, modify?) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agate-progression-'))
  await generate(directory)
  const dataPath = path.join(directory, 'data'), checkpointPath = path.join(directory, 'checkpoint.json')
  const change = async (name, update) => {
    const filename = path.join(dataPath, name), document = JSON.parse(await fs.readFile(filename, 'utf8'))
    update(document); await fs.writeFile(filename, JSON.stringify(document))
  }
  if (modify) await modify(change, dataPath)
  const hosts = []
  t.after(async () => { for (const server of hosts) await server.stop(); await fs.rm(directory, { recursive: true, force: true }) })
  const start = async () => {
    const server = engine.createAuthorityServer({ dataPath, mapId: MAP_ID, checkpointPath })
    hosts.push(server); await server.loadWorld()
    const owner = { data: { joined: true, role: 'owner' } }
    const command = (type, extra = {}, socket = owner) => server.command(socket, {
      version: 2, id: server.lastCommandId + 1, actorId: '0', type, ...extra,
    })
    const finish = () => server.advanceMovement(performance.now() + 120000)
    const use = targetId => {
      const ack = command('use', { targetId }); if (ack.status === 'accepted') finish(); return ack
    }
    const talk = () => command('talk', { targetId: NPC_ID })
    const reply = (page, optionId, extra = {}) => command('reply', { targetId: NPC_ID,
      conversationId: page.conversationId, optionId, expectedRevision: server.revision, ...extra })
    const begin = () => { use(NPC_ID); return reply(talk().result, 'accept') }
    const carry = () => {
      use(GROUND_ITEM_ID)
      assert.equal(command('pickup', { targetId: GROUND_ITEM_ID, expectedRevision: server.revision }).ok, true)
      use(NPC_ID)
      return talk().result
    }
    const character = () => command('character')
    const state = () => ({ actor: [server.player.base.location.x, server.player.base.location.y],
      doors: server.doors.checkpointStates(), ownership: server.ownership.checkpointStates(),
      quests: server.conversations.checkpointStates(), character: server.progression.checkpointState(), revision: server.revision })
    return { server, owner, command, finish, use, talk, reply, begin, carry, character, state }
  }
  return { start, change, dataPath, checkpointPath }
}

test('reviewed XP thresholds, five-level bonus and bank cap derive exact boundary states without mutable global rules', () => {
  const { CharacterProgression, LEVEL_EXPERIENCE } = engine
  assert.equal(LEVEL_EXPERIENCE.length, 50)
  assert.equal(Object.isFrozen(LEVEL_EXPERIENCE), true)
  assert.deepEqual(LEVEL_EXPERIENCE.slice(0, 5), [0, 2100, 4600, 7700, 11400])
  assert.equal(LEVEL_EXPERIENCE[9], 38300)
  assert.equal(LEVEL_EXPERIENCE[49], 1300000)
  const actor = { sourcePath: '16086.json', base: { type: 'Pc', prototype: 900001 }, critter: { progressionSupported: true } }
  for (let index = 0; index < LEVEL_EXPERIENCE.length; index++) {
    const minimum = LEVEL_EXPERIENCE[index]
    const ledger = new CharacterProgression(actor, { version: 2, actorId: '16086.json', profile: 'neutral-human', baseline })
    const quests = new Map([['test', { definition: { rewardExperience: minimum }, status: 'absent' }]])
    ledger.bindQuests(quests)
    const current = ledger.expected([{ id: 'test', status: 'completed' }], [{ kind: 'quest', questId: 'test' }])
    let points = 5
    for (let level = 2; level <= index + 1; level++) points += level % 5 === 0 ? 2 : 1
    assert.deepEqual(current, { experiencePoints: minimum, level: index + 1, unspentPoints: Math.min(56, points),
      attributes: { ...baseAttributes }, history: [{ kind: 'quest', questId: 'test' }] })
    if (index) {
      quests.get('test').definition.rewardExperience = minimum - 1
      const before = new CharacterProgression(actor, { version: 2, actorId: '16086.json', profile: 'neutral-human', baseline })
      before.bindQuests(quests)
      assert.equal(before.expected([{ id: 'test', status: 'completed' }], [{ kind: 'quest', questId: 'test' }]).level, index)
      assert.equal(ledger.expected([{ id: 'test', status: 'completed' }], [{ kind: 'quest', questId: 'test' }]).level, index + 1, 'reward catalog is immutable after binding')
    }
  }
})

test('character reads preserve revision, lastCommand and active conversation, and every private journal/page agrees', async t => {
  const { start } = await fixture(t)
  const context = await start(), { server, command, character, use, talk, reply } = context
  assert.deepEqual(character().result, initial)
  assert.equal(server.player.critter.stats, undefined, 'owned progression does not fabricate or mirror legacy stats')
  use(NPC_ID)
  const page = talk().result, revision = server.revision, last = structuredClone(server.lastCommand)
  assert.deepEqual(page.character, initial)
  assert.deepEqual(command('journal').result.character, initial)
  assert.deepEqual(character().result, initial)
  assert.equal(server.revision, revision)
  assert.deepEqual(server.lastCommand, last)
  assert.deepEqual(reply(page, 'leave').result.character, initial)
  assert.equal(server.revision, revision)
  const serialized = JSON.stringify(server.getSnapshot())
  for (const key of ['character', 'experiencePoints', 'unspentPoints', 'nextLevelExperience'] as const) assert.equal(serialized.includes(key), false)
})

test('quest completion awards 2100 XP and one banked Character Point in one revision, with no inventory reward or repeat', async t => {
  const { start } = await fixture(t)
  const context = await start(), { server, begin, carry, reply, command, character } = context
  const accepted = begin()
  assert.deepEqual(accepted.result.character, initial)
  assert.equal(reply(accepted.result, 'show').code, 'INVALID_OPTION')
  assert.deepEqual(character().result, initial)
  const page = carry(), before = server.ownership.checkpointStates(), revision = server.revision
  const completed = reply(page, 'show')
  assert.equal(completed.ok, true)
  assert.equal(server.revision, revision + 1)
  assert.deepEqual(completed.result.character, advanced)
  assert.deepEqual(character().result, advanced)
  assert.deepEqual(command('journal').result.character, advanced)
  assert.deepEqual(server.ownership.checkpointStates(), before)
  assert.equal(server.player.critter.stats, undefined)
  assert.equal(reply(page, 'show').code, 'CONVERSATION_EXPIRED')
  assert.deepEqual(character().result, advanced)
  assert.equal(server.revision, revision + 1)
  assert.deepEqual(server.lastCommand.result, { kind: 'reply' })
})

test('multi-level quest awards and cap saturation use the verified curve and bank ceiling', async t => {
  for (const [reward, expected] of [
    [11400, { experiencePoints: 11400, level: 5, unspentPoints: 10, nextLevelExperience: 15500 }],
    [38300, { experiencePoints: 38300, level: 10, unspentPoints: 16, nextLevelExperience: 45600 }],
    [2000000000, { experiencePoints: 1300000, level: 50, unspentPoints: 56, nextLevelExperience: null }],
  ] as const) await t.test(`reward ${reward}`, async child => {
    const { start } = await fixture(child, change => change('rules/Conversations.json', data => { data.quests[0].rewardExperience = reward }))
    const context = await start(); context.begin()
    const completed = context.reply(context.carry(), 'show')
    assert.equal(completed.ok, true)
    assert.deepEqual(completed.result.character, { kind: 'character', supported: true, ...expected, ...presentation(expected.level, expected.unspentPoints) })
    assert.doesNotThrow(() => context.server.validateCheckpoint(context.server.createCheckpoint()))
  })
})

test('XP field preflight and partial-write/page failures rollback progression and quest together', async t => {
  for (const mode of ['frozen XP', 'second field trap', 'page failure'] as const) await t.test(mode, async child => {
    const { start } = await fixture(child)
    const context = await start(), { server, begin, carry, reply, character } = context
    begin(); const page = carry(), revision = server.revision, ownership = server.ownership.checkpointStates()
    const original = server.progression.state
    if (mode === 'frozen XP') Object.defineProperty(original, 'experiencePoints', { value: 0, writable: false, configurable: false })
    if (mode === 'second field trap') {
      let fail = true
      server.progression.state = new Proxy(original, { defineProperty(target, key, descriptor) {
        if (key === 'level' && fail) { fail = false; throw new Error('Synthetic second progression write failure') }
        return Reflect.defineProperty(target, key, descriptor)
      } })
    }
    if (mode === 'page failure') {
      const issue = server.conversations.issue
      server.conversations.issue = function (...args) {
        if (this.quests.get(QUEST_ID).status === 'completed') throw new Error('Synthetic private page failure')
        return issue.apply(this, args)
      }
    }
    assert.equal(reply(page, 'show').ok, false)
    assert.equal(server.conversations.quests.get(QUEST_ID).status, 'active')
    assert.deepEqual(character().result, initial)
    assert.equal(server.revision, revision)
    assert.deepEqual(server.ownership.checkpointStates(), ownership)
    assert.equal(server.conversations.active, null)
  })
})

test('unsupported original actor fields never opt into progression, and a promised XP reward cannot complete without support', async t => {
  const bogus = { experiencePoints: 999999, level: 50, unspentPoints: 55 }
  const { start } = await fixture(t, change => change('16086.json', data => {
    delete data.Critter.progressionSupported; data.Critter.stats = { ...bogus }
  }))
  const context = await start(), { server, character, begin, carry, reply, command } = context
  assert.deepEqual(character().result, { kind: 'character', supported: false })
  assert.equal(server.player.critter.stats.experiencePoints, bogus.experiencePoints)
  assert.deepEqual(begin().result.character, { kind: 'character', supported: false })
  const revision = server.revision, result = reply(carry(), 'show')
  assert.equal(result.code, 'PROGRESSION_UNAVAILABLE')
  assert.equal(server.conversations.quests.get(QUEST_ID).status, 'active')
  assert.deepEqual(character().result, { kind: 'character', supported: false })
  assert.deepEqual(command('journal').result.character, { kind: 'character', supported: false })
  assert.equal(server.createCheckpoint().character, null)
  assert.equal(server.player.critter.stats.level, bogus.level)
  assert.equal(server.revision > revision, true, 'only the intervening carry approach changes public revision')
})

test('character intention has owner, exact-schema, replay, idle/pause and checkpoint guards without any external XP intent', async t => {
  const { start } = await fixture(t)
  const context = await start(), { server, command, character } = context
  assert.equal(command('character', { experiencePoints: 1 }).code, 'INVALID_COMMAND')
  assert.equal(command('award-xp', { amount: 2100 }).code, 'INVALID_COMMAND')
  assert.equal(command('character', {}, { data: { joined: true, role: 'observer' } }).code, 'FORBIDDEN')
  const first = character(), revision = server.revision
  assert.equal(command('character', { id: first.id }).code, 'REPLAYED_COMMAND')
  assert.equal(command('pause').ok, true)
  assert.deepEqual(character().result, initial)
  assert.equal(command('resume').ok, true)
  assert.equal(command('move', { target: [5, 4] }).status, 'accepted')
  assert.equal(character().code, 'BUSY')
  context.finish()
  server.checkpointBusy = true
  assert.equal(character().code, 'BUSY')
  server.checkpointBusy = false
  assert.deepEqual(character().result, initial)
  assert.equal(server.revision > revision, true)
})

test('schema6 jointly validates XP, level, points and quest completion before any checkpoint writes', async t => {
  const { start } = await fixture(t)
  const context = await start(), { server, state, begin, carry, reply } = context
  begin(); reply(carry(), 'show')
  const before = state(), document = server.createCheckpoint()
  assert.equal(document.version, 7)
  assert.equal(document.rulesVersion, 'movement-doors-ownership-attributes-weight-scripts-v11')
  assert.deepEqual(document.character, stateOf(advanced))
  for (const mutate of [
    value => { value.character.experiencePoints++ }, value => { value.character.level = 3 },
    value => { value.character.unspentPoints++ }, value => { value.character = null },
    value => { value.character.strength = 9 }, value => { delete value.character },
    value => { value.quests[0].status = 'active' }, value => { value.quests[0].status = 'absent' },
    value => { value.character.experiencePoints = 2000000000 }, value => { value.character.unspentPoints = 57 },
  ] as const) {
    const candidate = structuredClone(document); mutate(candidate)
    assert.throws(() => server.validateCheckpoint(candidate), { code: 'CHECKPOINT_INVALID' })
    assert.deepEqual(state(), before)
  }
})

test('active and completed checkpoints restore the corresponding bank without duplicate XP across restart or an earlier-save replay', async t => {
  const { start, checkpointPath } = await fixture(t)
  const context = await start(), { server, command, begin, carry, reply, character } = context
  begin(); assert.equal((await command('save')).ok, true)
  const activeBytes = await fs.readFile(checkpointPath, 'utf8')
  reply(carry(), 'show')
  assert.equal(command('drop', { itemId: GROUND_ITEM_ID, expectedRevision: server.revision }).ok, true)
  assert.equal((await command('save')).ok, true)
  const completedBytes = await fs.readFile(checkpointPath, 'utf8')
  assert.deepEqual(character().result, advanced)
  await server.stop()
  const fresh = await start()
  assert.deepEqual(fresh.character().result, initial)
  assert.equal((await fresh.command('load')).ok, true)
  assert.deepEqual(fresh.character().result, advanced)
  assert.deepEqual(fresh.server.ownership.actorInventory().items, [])
  await fs.writeFile(checkpointPath, activeBytes)
  assert.equal((await fresh.command('load')).ok, true)
  assert.deepEqual(fresh.character().result, initial)
  const replayed = fresh.reply(fresh.carry(), 'show')
  assert.equal(replayed.ok, true)
  assert.deepEqual(replayed.result.character, advanced)
  await fs.writeFile(checkpointPath, completedBytes)
  assert.equal((await fresh.command('load')).ok, true)
  assert.deepEqual(fresh.character().result, advanced)
})

test('a final progression commit failure restores actor, doors, inventory, quests and previous progression atomically', async t => {
  const { start } = await fixture(t)
  const context = await start(), { server, begin, carry, reply, state } = context
  begin()
  const active = server.createCheckpoint()
  active.actor.location = [5, 4]
  reply(carry(), 'show')
  const before = state(), original = server.progression.state
  let fail = true
  server.progression.state = new Proxy(original, { defineProperty(target, key, descriptor) {
    if (key === 'level' && fail) { fail = false; throw new Error('Synthetic load progression commit failure') }
    return Reflect.defineProperty(target, key, descriptor)
  } })
  const candidate = server.validateCheckpoint(active)
  assert.throws(() => server.applyCheckpoint(candidate), { code: 'CHECKPOINT_INVALID' })
  assert.deepEqual(state(), before)
})

test('runtime progression marker and state tampering cannot enable or change the authored ledger', async t => {
  const { start } = await fixture(t)
  const context = await start(), { server, character, begin, carry, reply } = context
  begin(); const page = carry(), revision = server.revision
  Object.defineProperty(server.player.critter, 'progressionSupported', { value: false, writable: true, configurable: true })
  assert.equal(character().code, 'PROGRESSION_UNAVAILABLE')
  assert.equal(reply(page, 'show').code, 'INVENTORY_UNAVAILABLE', 'held-item conditions require a verified carrying profile')
  assert.equal(server.conversations.quests.get(QUEST_ID).status, 'active')
  assert.equal(server.revision, revision)
  Object.defineProperty(server.player.critter, 'progressionSupported', { value: true, writable: true, configurable: true })
  server.progression.state.unspentPoints = 6
  assert.equal(character().code, 'PROGRESSION_UNAVAILABLE')
  assert.throws(() => server.createCheckpoint(), { code: 'CHECKPOINT_INVALID' })
})

test('authored XP rules are bounded, immutable simulation content and malformed baselines/rewards fail closed', async t => {
  for (const [name, filename, modify] of [
    ['XP/level mismatch', 'rules/Progression.json', value => { value.baseline.level = 2 }],
    ['negative bank', 'rules/Progression.json', value => { value.baseline.unspentPoints = -1 }],
    ['excessive bank', 'rules/Progression.json', value => { value.baseline.unspentPoints = 57 }],
    ['foreign actor', 'rules/Progression.json', value => { value.actorId = NPC_ID }],
    ['extra attribute', 'rules/Progression.json', value => { value.baseline.strength = 8 }],
    ['negative reward', 'rules/Conversations.json', value => { value.quests[0].rewardExperience = -1 }],
    ['fractional reward', 'rules/Conversations.json', value => { value.quests[0].rewardExperience = 0.5 }],
    ['oversized reward', 'rules/Conversations.json', value => { value.quests[0].rewardExperience = 2000000001 }],
  ] as const) await t.test(name, async child => {
    const { start } = await fixture(child, change => change(filename, modify))
    await assert.rejects(start(), /rules are invalid or unsupported/)
  })
  const { start, change } = await fixture(t)
  const first = await start(), checkpoint = first.server.createCheckpoint()
  await first.server.stop()
  await change('rules/Progression.json', value => { value.baseline.unspentPoints = 4 })
  const second = await start()
  assert.notEqual(second.server.contentIdentity, checkpoint.contentIdentity)
  assert.throws(() => second.server.validateCheckpoint(checkpoint), { code: 'CHECKPOINT_INCOMPATIBLE' })
})

test('missing progression is safe only without the actor marker and omitted quest XP remains a zero-reward authored transition', async t => {
  await t.test('marked actor missing baseline', async child => {
    const { start } = await fixture(child, async (_change, dataPath) => { await fs.rm(path.join(dataPath, 'rules/Progression.json')) })
    await assert.rejects(start(), /explicit valid baseline/)
  })
  await t.test('unmarked zero reward', async child => {
    const { start } = await fixture(child, async (change, dataPath) => {
      await fs.rm(path.join(dataPath, 'rules/Progression.json'))
      await change('16086.json', value => { delete value.Critter.progressionSupported })
      await change('rules/Conversations.json', value => { delete value.quests[0].rewardExperience })
    })
    const context = await start(); context.begin()
    const completed = context.reply(context.carry(), 'show')
    assert.equal(completed.ok, true)
    assert.deepEqual(completed.result.character, { kind: 'character', supported: false })
    assert.equal(context.server.createCheckpoint().character, null)
  })
})
