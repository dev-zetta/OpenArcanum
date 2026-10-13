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
      export { default as CharacterProgression, LEVEL_EXPERIENCE, MAX_EXPERIENCE, MAX_CHARACTER_POINTS } from './server/authority/CharacterProgression.ts';
      export { deriveNeutralStats, validAttributes, ATTRIBUTE_IDS } from './shared/character/NeutralStats.ts';`,
      resolveDir: source, sourcefile: 'attribute-purchase-tests.js' },
    bundle: true, platform: 'node', format: 'cjs', target: 'node24', write: false,
    external: ['electron', 'workerpool'], loader: { '.glsl': 'text' },
  })
  const compiled = new Module(__filename + '.bundle.cjs', module)
  compiled.filename = __filename + '.bundle.cjs'; compiled.paths = Module._nodeModulePaths(root)
  compiled._compile(result.outputFiles[0].text, compiled.filename)
  engine = compiled.exports
})

async function fixture(t: import("node:test").TestContext, modify?) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agate-attribute-'))
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


const buy = (context, statId, extra = {}, socket = context.owner) => context.command('buy-attribute', {
  statId, expectedRevision: context.server.revision, ...extra,
}, socket)
const attr = (view, id) => view.attributes.find(attribute => attribute.id === id)
const history = context => context.server.progression.checkpointState().history
const attributes = (override = {}) => ({ ...baseAttributes, ...override })

test('neutral previews match reviewed formulas, truncation, extraordinary bonuses and effective clamps', () => {
  const derive = engine.deriveNeutralStats
  assert.deepEqual(derive(attributes(), 1), initial.derived)
  assert.deepEqual(derive(attributes({ strength: 9 }), 1), { ...initial.derived, maxHealth: 32, carryWeight: 4500, damageBonus: 0 })
  assert.equal(Object.is(derive(attributes({ strength: 9 }), 1).damageBonus, -0), false)
  assert.equal(derive(attributes({ strength: 1 }), 1).damageBonus, -4)
  assert.equal(derive(attributes({ strength: 10 }), 1).damageBonus, 0)
  assert.equal(derive(attributes({ strength: 19 }), 1).damageBonus, 9)
  assert.equal(derive(attributes({ strength: 20 }), 1).damageBonus, 20)
  assert.equal(derive(attributes({ dexterity: 19 }), 1).speed, 19)
  assert.equal(derive(attributes({ dexterity: 20 }), 1).speed, 25)
  assert.equal(derive(attributes({ constitution: 20 }), 1).healRate, 6)
  assert.equal(derive(attributes({ constitution: 1 }), 1).healRate, 0)
  assert.equal(derive(attributes({ charisma: 1 }), 1).maxFollowers, 1)
  assert.equal(derive(attributes({ charisma: 3 }), 1).maxFollowers, 1)
  assert.equal(derive(attributes({ charisma: 4 }), 1).maxFollowers, 1)
  assert.equal(derive(attributes({ charisma: 20 }), 1).maxFollowers, 5)
  const reaction = [-65, -52, -42, -33, -25, -18, -12, -7, -3, 0, 3, 7, 12, 18, 25, 33, 42, 52, 65, 100]
  for (let beauty = 1; beauty <= 20; beauty++) assert.equal(derive(attributes({ beauty }), 1).reactionModifier, reaction[beauty - 1])
  assert.deepEqual(derive(Object.fromEntries(attributePairs.map(([id]) => [id, 20])), 50), {
    maxHealth: 164, maxFatigue: 164, carryWeight: 10000, damageBonus: 20, armorClassAdjustment: 10,
    speed: 25, healRate: 6, poisonRecovery: 20, reactionModifier: 100, maxFollowers: 5,
  })
  assert.deepEqual(derive(Object.fromEntries(attributePairs.map(([id]) => [id, 1])), 1), {
    maxHealth: 9, maxFatigue: 9, carryWeight: 500, damageBonus: -4, armorClassAdjustment: -9,
    speed: 1, healRate: 0, poisonRecovery: 1, reactionModifier: -65, maxFollowers: 1,
  })
  for (const value of [{ ...attributes(), strength: 0 }, { ...attributes(), beauty: 21 }, { ...attributes(), speed: 8 }, []] as const) {
    assert.throws(() => derive(value, 1), /Invalid neutral human/)
  }
  assert.throws(() => derive(attributes(), 51), /Invalid neutral human/)
})

test('all eight permanent purchases cost one point, keep XP and legacy stats untouched, and expose only private previews', async t => {
  const { start } = await fixture(t, change => change('rules/Progression.json', data => { data.baseline.unspentPoints = 56 }))
  const context = await start(), { server, character } = context
  const beforeOwnership = server.ownership.checkpointStates(), initialRevision = server.revision
  for (let index = 0; index < attributePairs.length; index++) {
    const [id, label] = attributePairs[index], response = buy(context, id)
    assert.equal(response.ok, true)
    assert.equal(response.result.kind, 'buy-attribute')
    assert.equal(response.result.statId, id)
    assert.equal(response.revision, initialRevision + index + 1)
    const view = response.result.character
    assert.equal(attr(view, id).label, label)
    assert.equal(attr(view, id).value, 9)
    assert.equal(view.unspentPoints, 55 - index)
    assert.equal(view.experiencePoints, 0)
    assert.equal(view.level, 1)
    assert.deepEqual(server.lastCommand, { id: response.id, type: 'buy-attribute', status: 'completed', result: { kind: 'buy-attribute' } })
  }
  assert.deepEqual(history(context), attributePairs.map(([statId]) => ({ kind: 'attribute', statId })))
  assert.deepEqual(character().result.attributes.map(row => row.value), Array(8).fill(9))
  assert.deepEqual(server.ownership.checkpointStates(), beforeOwnership)
  assert.equal(server.player.critter.stats, undefined)
  for (const value of ['strength', 'dexterity', 'attributes', 'history', 'derived', 'unspentPoints', 'carryWeight'] as const) {
    assert.equal(JSON.stringify(server.getSnapshot()).includes(value), false, value)
  }
})

test('depleted or capped purchases are atomic rejections with correct private availability and preserved conversation turn', async t => {
  const { start } = await fixture(t)
  const context = await start(), { server, use, talk, reply, character } = context
  for (let index = 0; index < 5; index++) assert.equal(buy(context, 'strength').ok, true)
  let view = character().result
  assert.equal(view.unspentPoints, 0)
  assert.equal(attr(view, 'strength').value, 13)
  assert.equal(view.attributes.every(row => !row.canIncrease && row.reason === 'Not enough Character Points.'), true)
  use(NPC_ID); const page = talk().result, before = context.state()
  assert.equal(buy(context, 'strength').code, 'INSUFFICIENT_POINTS')
  assert.deepEqual(context.state(), before)
  assert.equal(reply(page, 'leave').ok, true)
  await server.stop()
  const cappedFixture = await fixture(t, change => change('rules/Progression.json', data => {
    data.baseline.attributes.strength = 20; data.baseline.unspentPoints = 0
  }))
  const capped = await cappedFixture.start()
  assert.equal(buy(capped, 'strength').code, 'ATTRIBUTE_AT_MAX')
  view = capped.character().result
  assert.deepEqual(attr(view, 'strength'), { id: 'strength', label: 'Strength', value: 20, maximum: 20,
    pointCost: 1, canIncrease: false, reason: 'Attribute is at its maximum.' })
})

test('successful purchase invalidates dialogue and read-only views preserve the new authoritative balance', async t => {
  const { start } = await fixture(t)
  const context = await start(); context.use(NPC_ID)
  const page = context.talk().result, response = buy(context, 'strength')
  assert.equal(response.ok, true)
  assert.equal(context.reply(page, 'accept').code, 'CONVERSATION_EXPIRED')
  assert.equal(response.result.character.unspentPoints, 4)
  assert.deepEqual(response.result.character.derived, { ...initial.derived, maxHealth: 32, carryWeight: 4500, damageBonus: 0 })
  assert.deepEqual(context.command('journal').result.character, response.result.character)
  assert.deepEqual(context.talk().result.character, response.result.character)
  assert.equal(context.server.movement, null)
  const move = context.command('move', { target: [7, 8] })
  assert.equal(move.ok, true)
  assert.equal(context.server.movement.durationMs, 1000, 'private speed preview does not bind the fixed movement policy')
})

test('purchase wire rejects client balances, unknown stats, stale/replayed IDs, unauthorized actors and nonidle commands', async t => {
  const { start } = await fixture(t)
  const context = await start(), { server, command } = context
  for (const extra of [{ statId: 'speed' }, { amount: 20 }, { unspentPoints: 50 }, { expectedRevision: 0.5 }] as const) {
    assert.equal(buy(context, 'strength', extra).code, 'INVALID_COMMAND')
  }
  assert.equal(buy(context, 'strength', {}, { data: { joined: true, role: 'observer' } }).code, 'FORBIDDEN')
  assert.equal(buy(context, 'strength', { actorId: 'npc' }).code, 'FORBIDDEN')
  assert.equal(buy(context, 'strength', { expectedRevision: server.revision + 1 }).code, 'STALE_REVISION')
  const first = buy(context, 'strength'), revision = server.revision
  assert.equal(first.ok, true)
  assert.equal(buy(context, 'strength', { id: first.id }).code, 'REPLAYED_COMMAND')
  assert.equal(command('pause').ok, true)
  assert.equal(buy(context, 'strength').code, 'PAUSED')
  assert.equal(context.character().ok, true)
  assert.equal(command('resume').ok, true)
  assert.equal(command('move', { target: [5, 4] }).status, 'accepted')
  assert.equal(buy(context, 'strength').code, 'BUSY')
  context.finish()
  server.checkpointBusy = true
  assert.equal(buy(context, 'strength').code, 'BUSY')
  server.checkpointBusy = false
  assert.equal(history(context).length, 1)
  assert.equal(server.revision > revision, true)
})

test('two authorized owners racing a revision commit exactly one purchase and conserve the bank', async t => {
  const { start } = await fixture(t)
  const context = await start(), revision = context.server.revision
  const other = { data: { joined: true, role: 'owner' } }
  const first = buy(context, 'strength', { expectedRevision: revision })
  const second = buy(context, 'dexterity', { expectedRevision: revision }, other)
  assert.equal(first.ok, true)
  assert.equal(second.code, 'STALE_REVISION')
  assert.equal(context.server.revision, revision + 1)
  assert.equal(context.character().result.unspentPoints, 4)
  assert.deepEqual(history(context), [{ kind: 'attribute', statId: 'strength' }])
})

test('ordered award/purchase history preserves both legitimate CP overflow outcomes through checkpoint replay', async t => {
  const { start } = await fixture(t, change => change('rules/Progression.json', data => { data.baseline.unspentPoints = 56 }))
  for (const firstPurchase of [true, false] as const) {
    const context = await start(), { server, begin, carry, reply, character } = context
    if (firstPurchase) assert.equal(buy(context, 'strength').ok, true)
    begin(); assert.equal(reply(carry(), 'show').ok, true)
    if (!firstPurchase) assert.equal(buy(context, 'strength').ok, true)
    const view = character().result
    assert.equal(view.experiencePoints, 2100)
    assert.equal(attr(view, 'strength').value, 9)
    assert.equal(view.unspentPoints, firstPurchase ? 56 : 55)
    assert.deepEqual(history(context), firstPurchase ? [{ kind: 'attribute', statId: 'strength' }, { kind: 'quest', questId: QUEST_ID }] :
      [{ kind: 'quest', questId: QUEST_ID }, { kind: 'attribute', statId: 'strength' }])
    const checkpoint = server.createCheckpoint()
    assert.doesNotThrow(() => server.validateCheckpoint(checkpoint))
    checkpoint.character.history.reverse()
    assert.throws(() => server.validateCheckpoint(checkpoint), { code: 'CHECKPOINT_INVALID' }, 'reordering requires a different derived bank')
    await server.stop()
  }
})

test('frozen fields, a partial history write and a failed private preview rollback purchase fields and preserve the turn', async t => {
  for (const mode of ['unspentPoints', 'attributes', 'history', 'partial trap', 'preview failure'] as const) await t.test(mode, async child => {
    const { start } = await fixture(child)
    const context = await start(), { server, use, talk, reply } = context
    use(NPC_ID); const page = talk().result, before = context.state(), state = server.progression.state
    if (['unspentPoints', 'attributes', 'history'].includes(mode)) {
      Object.defineProperty(state, mode, { value: state[mode], writable: false, configurable: true })
    }
    if (mode === 'partial trap') {
      let fail = true
      server.progression.state = new Proxy(state, { defineProperty(target, key, descriptor) {
        if (key === 'history' && fail) { fail = false; throw new Error('Synthetic final history commit failure') }
        return Reflect.defineProperty(target, key, descriptor)
      } })
    }
    const view = server.progression.view
    if (mode === 'preview failure') server.progression.view = () => { throw new Error('Synthetic private preview failure') }
    assert.equal(buy(context, 'strength').code, 'PROGRESSION_UNAVAILABLE')
    server.progression.view = view
    assert.deepEqual(context.state(), before)
    assert.equal(reply(page, 'leave').ok, true, 'failed transaction did not consume the active dialogue turn')
  })
})

test('schema6 restores purchases before and after rewards across restart, with derived values recomputed and old files retained', async t => {
  const { start, checkpointPath } = await fixture(t)
  const context = await start(), { server, command, begin, carry, reply } = context
  const baselineSave = server.createCheckpoint()
  assert.equal(buy(context, 'strength').ok, true)
  begin(); reply(carry(), 'show')
  assert.equal(buy(context, 'willpower').ok, true)
  const expected = context.character().result
  assert.equal(expected.unspentPoints, 4)
  assert.equal((await command('save')).ok, true)
  const bytes = await fs.readFile(checkpointPath, 'utf8'), document = JSON.parse(bytes)
  assert.equal(document.version, 7)
  assert.equal(document.rulesVersion, 'movement-doors-ownership-attributes-weight-scripts-v11')
  assert.deepEqual(document.character.history, [{ kind: 'attribute', statId: 'strength' }, { kind: 'quest', questId: QUEST_ID }, { kind: 'attribute', statId: 'willpower' }])
  assert.equal(Object.hasOwn(document.character, 'derived'), false)
  await server.stop()
  const fresh = await start()
  assert.equal((await fresh.command('load')).ok, true)
  assert.deepEqual(fresh.character().result, expected)
  assert.equal(await fs.readFile(checkpointPath, 'utf8'), bytes)
  fresh.server.applyCheckpoint(fresh.server.validateCheckpoint(baselineSave))
  assert.deepEqual(fresh.character().result, initial)
  assert.deepEqual(history(fresh), [])
  const previous = JSON.stringify({ ...document, version: 5, rulesVersion: 'movement-doors-ownership-progression-v8' })
  await fs.writeFile(checkpointPath, previous)
  assert.equal((await fresh.command('load')).code, 'CHECKPOINT_INCOMPATIBLE')
  assert.equal(await fs.readFile(checkpointPath, 'utf8'), previous)
})

test('timeline, quest coverage, attribute and counter tamper fail before changing any live world state', async t => {
  const { start } = await fixture(t)
  const context = await start(), { server, begin, carry, reply } = context
  buy(context, 'strength'); begin(); reply(carry(), 'show')
  const original = server.createCheckpoint(), before = context.state()
  for (const modify of [
    value => { value.character.history = [] },
    value => { value.character.history = [{ kind: 'quest', questId: QUEST_ID }] },
    value => { value.character.history.push({ kind: 'quest', questId: QUEST_ID }) },
    value => { value.character.history[0].cost = 0 },
    value => { value.character.history[0].statId = 'speed' },
    value => { value.character.history = Array.from({ length: 257 }, () => ({ kind: 'attribute', statId: 'strength' })) },
    value => { value.character.history[1].questId = 'fabricated' },
    value => { value.quests[0].status = 'active' },
    value => { value.character.unspentPoints++ },
    value => { value.character.attributes.strength = 10 },
    value => { value.character.attributes.strength = 21 },
    value => { delete value.character.attributes.beauty },
    value => { value.character.derived = initial.derived },
    value => { value.character.attributes.speed = 20 },
  ] as const) {
    const candidate = structuredClone(original); modify(candidate)
    assert.throws(() => server.validateCheckpoint(candidate), { code: 'CHECKPOINT_INVALID' })
    assert.deepEqual(context.state(), before)
  }
  const reordered = structuredClone(original)
  reordered.character.attributes = Object.fromEntries(Object.entries(reordered.character.attributes).reverse())
  reordered.character.history = reordered.character.history.map(event => Object.fromEntries(Object.entries(event).reverse()))
  assert.doesNotThrow(() => server.validateCheckpoint(reordered), 'object key order is not part of the timeline semantics')
})

test('save replay rejects spending before funds exist and exceeding an attribute cap even with matching forged counters', async t => {
  const { start } = await fixture(t, change => change('rules/Progression.json', data => { data.baseline.unspentPoints = 0 }))
  const context = await start(); context.begin(); context.reply(context.carry(), 'show')
  const checkpoint = context.server.createCheckpoint()
  checkpoint.character.history.unshift({ kind: 'attribute', statId: 'strength' })
  checkpoint.character.attributes.strength = 9; checkpoint.character.unspentPoints = 0
  assert.throws(() => context.server.validateCheckpoint(checkpoint), { code: 'CHECKPOINT_INVALID' })
  await context.server.stop()
  const capped = await fixture(t, change => change('rules/Progression.json', data => { data.baseline.attributes.strength = 20 }))
  const second = await capped.start(), invalid = second.server.createCheckpoint()
  invalid.character.history = [{ kind: 'attribute', statId: 'strength' }]
  invalid.character.attributes.strength = 21; invalid.character.unspentPoints = 4
  assert.throws(() => second.server.validateCheckpoint(invalid), { code: 'CHECKPOINT_INVALID' })
})

test('final history failure on load rolls back actor, ownership, doors, quests, attributes and bank together', async t => {
  const { start } = await fixture(t)
  const context = await start(), { server } = context
  const saved = server.createCheckpoint(); saved.actor.location = [5, 4]
  buy(context, 'strength'); context.begin(); context.reply(context.carry(), 'show')
  const before = context.state(), original = server.progression.state
  let fail = true
  server.progression.state = new Proxy(original, { defineProperty(target, key, descriptor) {
    if (key === 'history' && fail) { fail = false; throw new Error('Synthetic load history commit failure') }
    return Reflect.defineProperty(target, key, descriptor)
  } })
  assert.throws(() => server.applyCheckpoint(server.validateCheckpoint(saved)), { code: 'CHECKPOINT_INVALID' })
  assert.deepEqual(context.state(), before)
})

test('unmarked actors keep unsupported character views and cannot buy even with legacy stat fields', async t => {
  const { start } = await fixture(t, change => change('16086.json', data => {
    delete data.Critter.progressionSupported
    data.Critter.stats = { strength: 19, unspentPoints: 56 }
  }))
  const context = await start(), revision = context.server.revision
  assert.deepEqual(context.character().result, { kind: 'character', supported: false })
  assert.equal(buy(context, 'strength').code, 'PROGRESSION_UNAVAILABLE')
  assert.equal(context.server.revision, revision)
  assert.equal(context.server.player.critter.stats.strength, 19)
  assert.equal(context.server.player.critter.stats.unspentPoints, 56)
  assert.equal(context.server.createCheckpoint().character, null)
})

test('the fixed neutral-human profile and explicit complete attribute baseline are strict simulation content', async t => {
  for (const [name, modify] of [
    ['wrong profile', value => { value.profile = 'elf' }],
    ['old rules schema', value => { value.version = 1 }],
    ['missing attribute', value => { delete value.baseline.attributes.strength }],
    ['fractional attribute', value => { value.baseline.attributes.dexterity = 8.5 }],
    ['below minimum', value => { value.baseline.attributes.constitution = 0 }],
    ['above maximum', value => { value.baseline.attributes.beauty = 21 }],
    ['extra gameplay field', value => { value.baseline.attributes.hpPoints = 1 }],
  ] as const) await t.test(name, async child => {
    const { start } = await fixture(child, change => change('rules/Progression.json', modify))
    await assert.rejects(start(), /Authored progression rules are invalid or unsupported/)
  })
  const { start, change } = await fixture(t)
  const first = await start(), checkpoint = first.server.createCheckpoint()
  await first.server.stop()
  await change('rules/Progression.json', value => { value.baseline.attributes.strength = 9 })
  const second = await start()
  assert.notEqual(second.server.contentIdentity, checkpoint.contentIdentity)
  assert.throws(() => second.server.validateCheckpoint(checkpoint), { code: 'CHECKPOINT_INCOMPATIBLE' })
})
