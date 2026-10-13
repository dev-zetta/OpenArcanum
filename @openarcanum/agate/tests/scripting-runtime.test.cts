import type { ClientScriptDefinition, JsonObject, NumberReference, ScriptDefinition, ScriptHost, ScriptInvocation,
  ScriptObject, ScriptPresentation, ServerScriptContext } from '../dist-types/shared/scripting/ScriptApi'

const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const { before, test } = require('node:test') as typeof import('node:test')
const path = require('node:path') as typeof import('node:path')
const Module = require('node:module') as typeof import('node:module')
const root = path.resolve(__dirname, '../../..')
let api: typeof import('../dist-types/shared/scripting/ScriptApi')
let Engine: typeof import('../dist-types/shared/scripting/ScriptEngine').default
let ClientEngine: typeof import('../dist-types/shared/scripting/ClientScriptEngine').default

before(async () => {
  const { build } = await import('esbuild')
  const result = await build({ absWorkingDir: root, stdin: { contents: `export * as api from './shared/scripting/ScriptApi.ts';
    export {default as Engine} from './shared/scripting/ScriptEngine.ts';
    export {default as ClientEngine} from './shared/scripting/ClientScriptEngine.ts';`,
    resolveDir: path.join(root, '@openarcanum/agate/src'), sourcefile: 'scripting-tests.ts' },
    bundle: true, platform: 'node', format: 'cjs', target: 'node24', write: false })
  const compiled = new Module(__filename + '.bundle.cjs', module)
  compiled.filename = __filename + '.bundle.cjs'; compiled.paths = Module._nodeModulePaths(root)
  compiled._compile(result.outputFiles[0].text, compiled.filename)
  ;({ api, Engine, ClientEngine } = compiled.exports)
})

function fixture(definitions: ScriptDefinition[], options: { failWrite?: boolean; unsupportedOffTarget?: string; initialFlags?: Record<string, Record<number, 0 | 1>>; onDispose?: () => void } = {}) {
  const definitionsById = new Map(definitions.map(definition => [definition.id, definition]))
  const objects = new Map<string, ScriptObject>([['pc', { id: 'pc', type: 'Pc' }], ['door', { id: 'door', type: 'Portal' }], ['npc', { id: 'npc', type: 'Npc' }]])
  const off = new Map([...objects.keys()].map(id => [id, false]))
  const effects: ScriptPresentation[] = []
  let selected: string[] = []
  const host: ScriptHost = {
    getObject: id => objects.get(id) ?? null, isOff: id => off.get(id) ?? false,
    isNamed: (id, name) => id === 'npc' && name === 7,
    select: () => selected.map(id => objects.get(id)!),
    prepareObjectWrites: writes => {
      if (writes.some(write => write.targetId === options.unsupportedOffTarget)) throw new Error('unsupported Off target')
      const before = new Map(off)
      return { apply() { for (const write of writes) { off.set(write.targetId, write.off); if (options.failWrite) throw new Error('host write failed') } },
        rollback() { off.clear(); for (const [id, value] of before) off.set(id, value) } }
    },
    emitPresentation: effect => effects.push(effect),
  }
  const engine = new Engine({ host, resolver: { contentIdentity: 'synthetic-scripts-v1', resolve: id => definitionsById.get(id), dispose: options.onDispose },
    symbols: { variables: { attempts: 42 }, flags: { unlocked: 7 } }, initialFlags: options.initialFlags })
  const invoke = (scriptId: string, extra: Partial<ScriptInvocation> = {}) => engine.prepare({ scriptId, triggererId: 'pc', attacheeId: 'door', playerId: 'pc', ...extra })
  return { engine, objects, off, effects, invoke, setSelected(ids: string[]) { selected = ids } }
}
function script(id: string, handler: (context: ServerScriptContext) => ReturnType<typeof api.flow.skipDefault> | void): ScriptDefinition {
  return api.defineScript({ id, name: id, realm: 'server', entryPoints: { 0: handler } })
}

test('script veto, Off writes and presentation effects commit together and rollback before publication', () => {
  const f = fixture([script('test:veto', ctx => {
    ctx.shared.variables.attempts++
    ctx.shared.flag(7).value = 1
    assert.equal(ctx.shared.flags.unlocked, 1)
    ctx.game.toggleOff(ctx.attachee!)
    ctx.ui.message('private', 'pc')
    return api.flow.skipDefault()
  })])
  const baseline = f.engine.snapshot(), transaction = f.invoke('test:veto')
  assert.equal(transaction.runDefault, false); assert.deepEqual(f.engine.snapshot(), baseline)
  assert.equal(f.off.get('door'), false); assert.deepEqual(f.effects, [])
  transaction.commit()
  assert.equal(f.off.get('door'), true); assert.equal(f.engine.snapshot().shared.variables['test:42'], 1)
  transaction.rollback()
  assert.equal(f.off.get('door'), false); assert.deepEqual(f.engine.snapshot(), baseline); assert.deepEqual(f.effects, [])
  const committed = f.invoke('test:veto'); committed.commit(); committed.flushEffects(); committed.flushEffects()
  assert.deepEqual(f.effects, [{ type: 'message', text: 'private', targetId: 'pc' }])
  assert.throws(() => committed.rollback(), { code: 'STALE_TRANSACTION' })
})

test('default action is an explicit decision; uncommitted or stale preparations cannot publish or commit', () => {
  const f = fixture([script('test:default', () => api.flow.runDefault())])
  const a = f.invoke('test:default'), b = f.invoke('test:default')
  assert.equal(a.runDefault, true)
  assert.throws(() => a.flushEffects(), { code: 'UNCOMMITTED_EFFECT' })
  a.commit(); assert.throws(() => b.commit(), { code: 'STALE_TRANSACTION' })
})

test('unsupported named operations abort all state/effects with original row and operation diagnostics', () => {
  const f = fixture([script('test:unsupported', ctx => {
    ctx.shared.variable(0).value = 99; ctx.game.toggleOff(ctx.attachee!); ctx.ui.message('must not escape')
    ctx.at(37); ctx.game.actions.getStoryState(ctx.localNumber(0))
  })])
  const before = f.engine.snapshot()
  assert.throws(() => f.invoke('test:unsupported'), error => {
    const diagnostic = error as Error & { code: string; source: { scriptId: string; line: number; operation: string; opcode: number } }
    assert.equal(diagnostic.code, 'UNSUPPORTED_OPERATION')
    assert.deepEqual(diagnostic.source, { scriptId: 'test:unsupported', line: 37, operation: 'getStoryState', opcode: 42 })
    return true
  })
  assert.deepEqual(f.engine.snapshot(), before); assert.equal(f.off.get('door'), false); assert.deepEqual(f.effects, [])
})

test('host application failure rolls back partial object writes and leaves script state untouched', () => {
  const f = fixture([script('test:host-failure', ctx => { ctx.shared.variable(0).value = 1; ctx.game.toggleOff(ctx.attachee!) })], { failWrite: true })
  const before = f.engine.snapshot(), transaction = f.invoke('test:host-failure')
  assert.throws(() => transaction.commit(), /host write failed/)
  assert.deepEqual(f.engine.snapshot(), before); assert.equal(f.off.get('door'), false)
})
test('equal-valued Off requests still enforce the host target capability boundary', () => {
  const f = fixture([script('test:unsupported-off', ctx => {
    ctx.shared.variable(0).value = 1
    ctx.game.toggleOff(ctx.attachee!, false)
  })], { unsupportedOffTarget: 'door' })
  const before = f.engine.snapshot()
  assert.throws(() => f.invoke('test:unsupported-off'), /unsupported Off target/)
  assert.deepEqual(f.engine.snapshot(), before)
})

test('function jumps and dynamic entry lines are trampolined and bounded without recursive gotos', () => {
  const first = (ctx: ServerScriptContext) => { ctx.localNumber(0).value++; return api.flow.jump(first) }
  const f = fixture([api.defineScript({ id: 'test:loop', name: 'loop', realm: 'server', entryPoints: { 0: first } }),
    api.defineScript({ id: 'test:entry', name: 'entry', realm: 'server', entryPoints: { 0: () => api.flow.jumpByLine(12), 12: () => api.flow.runDefault() } })])
  assert.throws(() => f.invoke('test:loop'), { code: 'SCRIPT_BUDGET' })
  assert.equal(f.invoke('test:entry').runDefault, true)
  assert.equal(f.invoke('test:entry', { entryLine: 12 }).runDefault, true)
  assert.equal(f.invoke('test:entry', { entryLine: 99 }).runDefault, false)
})

test('original dynamic control codes preserve next/skip/run and out-of-range targets', () => {
  const cases: [number, boolean][] = [[-1, true], [-2, false], [-3, true], [-4, true], [999, false]]
  for (const [line, run] of cases) {
    const f = fixture([api.defineScript({ id: 'test:control', name: 'control', realm: 'server', entryPoints: { 0: () => api.flow.jumpByLine(line), 1: () => api.flow.runDefault() } })])
    assert.equal(f.invoke('test:control').runDefault, run)
  }
})

test('nested calls get fresh numeric/object scratch while sharing module and explicit PC state', () => {
  const f = fixture([script('test:caller', ctx => {
    ctx.localNumber(0).value = 91; ctx.localObject(0).value = ctx.attachee
    ctx.shared.data.shared = 8; ctx.player.data.shared = 9
    ctx.game.call('test:callee')
    assert.equal(ctx.localNumber(0).value, 91); assert.equal(ctx.localObject(0).value?.id, 'door')
    assert.equal(ctx.shared.data.shared, 10); assert.equal(ctx.player.variable(3).value, 77)
  }), script('test:callee', ctx => {
    assert.equal(ctx.localNumber(0).value, 0); assert.equal(ctx.localObject(0).value, null)
    assert.equal(ctx.shared.data.shared, 8); assert.equal(ctx.player.data.shared, 9)
    ctx.shared.data.shared = 10; ctx.player.variable(3).value = 77; ctx.localNumber(0).value = 2
  })])
  f.invoke('test:caller').commit()
  assert.equal(f.engine.snapshot().shared.data.test.value.shared, 10)
  assert.equal(f.engine.snapshot().players.pc.variables['test:3'], 77)
})

test('nested call depth is bounded across named script modules', () => {
  const f = fixture([script('test:recurse', ctx => ctx.game.call('test:recurse'))])
  assert.throws(() => f.invoke('test:recurse'), { code: 'SCRIPT_BUDGET' })
})

test('module variable IDs and custom state do not alias another module or another world', () => {
  const a = script('alpha:a', ctx => { ctx.shared.variable(3).value = 12; ctx.shared.data.token = 'a' })
  const b = script('beta:b', ctx => { assert.equal(ctx.shared.variable(3).value, 0); assert.equal(ctx.shared.data.token, undefined) })
  const f = fixture([a, b]), second = fixture([a, b])
  f.invoke(a.id).commit(); f.invoke(b.id).commit()
  assert.deepEqual(second.engine.snapshot().shared, { variables: {}, flags: {}, data: {} })
})

test('quantified every requires nonempty matches and any differs from every', () => {
  const f = fixture([script('test:quantifiers', ctx => {
    const all = ctx.game.select(8), any = ctx.game.select(9)
    ctx.data.all = ctx.game.conditions.objIsNamed(all, 7); ctx.data.any = ctx.game.conditions.objIsNamed(any, 7)
  })])
  f.invoke('test:quantifiers').commit()
  assert.deepEqual(f.engine.snapshot().data['test:quantifiers'].value, { all: false, any: false })
  f.setSelected(['npc', 'door']); f.invoke('test:quantifiers').commit()
  assert.deepEqual(f.engine.snapshot().data['test:quantifiers'].value, { all: false, any: true })
  f.setSelected(['npc']); f.invoke('test:quantifiers').commit()
  assert.deepEqual(f.engine.snapshot().data['test:quantifiers'].value, { all: true, any: true })
})

test('numeric writable cells, signed overflow, local flags and persistent counter limits are explicit', () => {
  let leaked: NumberReference | undefined
  const f = fixture([script('test:arithmetic', ctx => {
    ctx.game.actions.add(ctx.localNumber(0), 2147483647, 1)
    assert.equal(ctx.localNumber(0).value, -2147483648)
    ctx.game.actions.multiply(ctx.shared.variable(3), 2147483647, 2147483647)
    assert.equal(ctx.shared.variable(3).value, 1)
    ctx.attachment.flag(31).value = 1; ctx.attachment.counter(3).value = 255
    leaked = ctx.shared.variable(3)
  })])
  f.engine.registerAttachment('door:use', { scriptId: 'test:arithmetic' })
  f.invoke('test:arithmetic', { attachmentId: 'door:use' }).commit()
  assert.equal(f.engine.binding('door:use')?.flags, 0x80000000)
  assert.equal(f.engine.binding('door:use')?.counters[3], 255)
  leaked!.value = 99
  assert.equal(f.engine.snapshot().shared.variables['test:3'], 1, 'retained context cannot mutate committed state')
})

test('schema defaults and shared data are validated after every invocation', () => {
  const schema = { version: 1, defaults: { count: 2 }, validate(value: unknown): value is JsonObject {
    return !!value && typeof value === 'object' && 'count' in value && typeof value.count === 'number' && value.count >= 0
  } }
  const f = fixture([api.defineScript({ id: 'test:schema', name: 'schema', realm: 'server', sharedSchema: schema, entryPoints: {
    0(ctx) { assert.equal(ctx.shared.data.count, 2); ctx.shared.data.count = -1 }
  } })])
  const before = f.engine.snapshot()
  assert.throws(() => f.invoke('test:schema'), { code: 'INVALID_SCHEMA' }); assert.deepEqual(f.engine.snapshot(), before)
})

test('scheduler clock is 8x, capped at250ms, transactional, and deterministic after restore', () => {
  const f = fixture([api.defineScript({ id: 'test:timer', name: 'timer', realm: 'server', entryPoints: {
    0(ctx) { ctx.game.schedule('test:timer', 3, 10); ctx.data.random = ctx.game.random(1, 1000000) },
    10(ctx) { ctx.shared.variable(0).value++; ctx.data.random = ctx.game.random(1, 1000000); ctx.ui.message('due') }
  } })])
  f.invoke('test:timer').commit(); const saved = f.engine.snapshot()
  f.engine.prepareAdvance(99999).commit()
  assert.equal(f.engine.snapshot().clockMs, 2000); assert.equal(f.engine.snapshot().scheduled.length, 1)
  const due = f.engine.prepareAdvance(125); due.commit(); due.flushEffects()
  assert.equal(f.engine.snapshot().clockMs, 3000); assert.equal(f.effects.length, 1)
  const expected = f.engine.snapshot()
  f.engine.prepareRestore(saved).commit(); f.engine.prepareAdvance(250).commit(); f.engine.prepareAdvance(125).commit()
  assert.deepEqual(f.engine.snapshot(), expected)
})

test('checkpoint preparation validates all scripts, objects, schema, queue and state before touching live values', () => {
  const f = fixture([script('test:save', ctx => { ctx.shared.variable(0).value = 7; ctx.game.toggleOff(ctx.attachee!) })])
  f.engine.registerAttachment('door:use', { scriptId: 'test:save' })
  f.invoke('test:save').commit(); const baseline = f.engine.snapshot()
  const mutations: ((value: typeof baseline) => void)[] = [
    value => { value.contentIdentity = 'wrong' }, value => { value.rng = 0 },
    value => { value.off.missing = true }, value => { value.shared.variables['test:0'] = 1.2 },
    value => { value.players.npc = { variables: {}, flags: {}, data: {} } },
    value => { value.attachments.fake = { scriptId: 'test:save', flags: 0, counters: [0, 0, 0, 0], data: {} } },
    value => { value.attachments['door:use'].counters[0] = 256 },
    value => { value.scheduled = [{ id: 'call:1', dueMs: 0, invocation: { scriptId: 'missing:script' } }]; value.nextCall = 2 },
  ]
  for (const mutate of mutations) {
    const document = structuredClone(baseline); mutate(document)
    assert.throws(() => f.engine.prepareRestore(document)); assert.deepEqual(f.engine.snapshot(), baseline); assert.equal(f.off.get('door'), true)
  }
})

test('restoring an earlier snapshot resets object Off overrides and does not catch up wall-clock time', () => {
  const f = fixture([script('test:off', ctx => ctx.game.toggleOff(ctx.attachee!))])
  const baseline = f.engine.snapshot(); f.invoke('test:off').commit(); assert.equal(f.off.get('door'), true)
  const restore = f.engine.prepareRestore(baseline)
  assert.deepEqual(restore.objectWrites, [{ targetId: 'door', off: false }]); assert.equal(f.off.get('door'), true)
  restore.commit(); assert.equal(f.off.get('door'), false); assert.equal(f.engine.snapshot().clockMs, 0)
})

test('client modules receive only presentation/local context and rollback failed local effects', () => {
  const effects: ScriptPresentation[] = []
  const definition: ClientScriptDefinition = api.defineScript({ id: 'test:client', name: 'client', realm: 'client', entryPoints: {
    0(ctx) { assert.equal('game' in ctx, false); assert.equal('shared' in ctx, false); ctx.data.count = Number(ctx.data.count ?? 0) + 1; ctx.ui.message(String(ctx.event.text)); if (ctx.event.fail) throw new Error('bad event') }
  } })
  const client = new ClientEngine({ scripts: [definition], emitPresentation: effect => effects.push(effect) })
  client.run(definition.id, 0, { text: 'hello' }); const before = client.snapshot()
  assert.throws(() => client.run(definition.id, 0, { text: 'discard', fail: true }), /bad event/)
  assert.deepEqual(client.snapshot(), before); assert.deepEqual(effects, [{ type: 'message', text: 'hello' }])
})

test('packed PC selectors use the selected PC rather than the invocation player', () => {
  const f = fixture([script('test:pc-selector', ctx => { ctx.playerState(1).variable(4).value = 11 })])
  f.objects.set('other-pc', { id: 'other-pc', type: 'Pc' })
  f.invoke('test:pc-selector', { attacheeId: 'other-pc' }).commit()
  assert.equal(f.engine.snapshot().players['other-pc'].variables['test:4'], 11)
  assert.equal(f.engine.snapshot().players.pc, undefined)
  assert.throws(() => f.invoke('test:pc-selector', { attacheeId: 'npc' }), { code: 'PLAYER_REQUIRED' })
})

test('direct calls seed independent template headers and pending replacement overrides automatic removal', () => {
  const f = fixture([script('test:caller', ctx => { ctx.game.call('test:template'); ctx.game.call('test:template') }),
    api.defineScript({ id: 'test:template', name: 'template', realm: 'server', template: { flags: 32, counters: [0, 0, 9, 0] }, entryPoints: {
      0(ctx) { assert.equal(ctx.attachment.flag(5).value, 1); assert.equal(ctx.attachment.counter(2).value, 9); ctx.attachment.counter(2).value = 10 }
    } }),
    api.defineScript({ id: 'test:auto', name: 'auto', realm: 'server', scriptFlags: 4, entryPoints: { 0: () => api.flow.runDefault() } }),
    api.defineScript({ id: 'test:replace', name: 'replace', realm: 'server', scriptFlags: 4, entryPoints: {
      0(ctx) { ctx.attachment.replace('test:auto'); return api.flow.skipDefault() }
    } })])
  f.invoke('test:caller').commit()
  f.engine.registerAttachment('auto', { scriptId: 'test:auto' }); f.engine.registerAttachment('replace', { scriptId: 'test:replace' })
  f.invoke('test:auto', { attachmentId: 'auto' }).commit(); assert.equal(f.engine.binding('auto')?.scriptId, '')
  f.invoke('test:replace', { attachmentId: 'replace' }).commit(); assert.equal(f.engine.binding('replace')?.scriptId, 'test:auto')
})

test('custom schema versions and cyclic or accessor data cannot enter checkpoints', () => {
  const f = fixture([script('test:json', ctx => { ctx.data.value = 1 })])
  f.invoke('test:json').commit(); const saved = f.engine.snapshot()
  const wrongVersion = structuredClone(saved); wrongVersion.data['test:json'].version = 2
  assert.throws(() => f.engine.prepareRestore(wrongVersion), { code: 'INVALID_SCHEMA' })
  const cyclic = structuredClone(saved); cyclic.data['test:json'].value.self = cyclic.data['test:json'].value
  assert.throws(() => f.engine.prepareRestore(cyclic), { code: 'INVALID_STATE' })
  const accessor = structuredClone(saved)
  Object.defineProperty(accessor.data['test:json'].value, 'evil', { enumerable: true, get() { throw new Error('getter executed') } })
  assert.throws(() => f.engine.prepareRestore(accessor), { code: 'INVALID_STATE' })
  assert.deepEqual(f.engine.snapshot(), saved)
})
test('invalid wire messages fail before either realm commits state or emits effects', () => {
  for (const text of ['   ', '\u0000control', 'x'.repeat(4097)]) {
    const f = fixture([script('test:bad-message', ctx => { ctx.shared.variable(0).value = 1; ctx.ui.message(text) })])
    const saved = f.engine.snapshot()
    assert.throws(() => f.invoke('test:bad-message'), { code: 'INVALID_EFFECT' })
    assert.deepEqual(f.engine.snapshot(), saved); assert.deepEqual(f.effects, [])
    const client = new ClientEngine({ scripts: [api.defineScript({ id: 'test:client-message', name: 'client', realm: 'client', entryPoints: {
      0(ctx) { ctx.data.changed = true; ctx.ui.message(text) }
    } })], emitPresentation() { assert.fail('invalid message escaped') } })
    assert.throws(() => client.run('test:client-message'), { code: 'INVALID_EFFECT' }); assert.deepEqual(client.snapshot(), {})
  }
})

test('original IDIV uses signed truncation toward zero and preserves the destination on division by zero', () => {
  const cases: [number, number, number][] = [[7, 3, 2], [-7, 3, -2], [7, -3, -2], [-7, -3, 2],
    [-1, 3, 0], [-2147483648, 2, -1073741824], [2147483647, -2, -1073741823], [7, 0, 91]]
  for (const [dividend, divisor, expected] of cases) {
    const f = fixture([script('test:divide', ctx => {
      const result = ctx.shared.variable(0); result.value = 91
      ctx.game.actions.divide(result, dividend, divisor)
    })])
    f.invoke('test:divide').commit()
    assert.equal(f.engine.snapshot().shared.variables['test:0'], expected)
  }
})

test('signed IDIV overflow raises an explicit arithmetic fault and rolls back the whole invocation', () => {
  const f = fixture([script('test:divide-overflow', ctx => {
    ctx.shared.variable(0).value = 91; ctx.attachment.counter(0).value = 3
    ctx.game.random(1, 10); ctx.game.schedule('test:divide-overflow', 8)
    ctx.game.toggleOff(ctx.attachee!); ctx.ui.message('must not escape')
    ctx.at(29); ctx.game.actions.divide(ctx.shared.variable(0), -2147483648, -1)
  })])
  f.engine.registerAttachment('door:use', { scriptId: 'test:divide-overflow' })
  const before = f.engine.snapshot()
  assert.throws(() => f.invoke('test:divide-overflow', { attachmentId: 'door:use' }), error => {
    const fault = error as Error & { code: string; source: { operation: string; line: number; opcode: number } }
    assert.equal(fault.code, 'ARITHMETIC_OVERFLOW'); assert.equal(fault.source.operation, 'divide')
    assert.equal(fault.source.line, 29); assert.equal(fault.source.opcode, 14); return true
  })
  assert.deepEqual(f.engine.snapshot(), before); assert.equal(f.off.get('door'), false); assert.deepEqual(f.effects, [])
})

test('original counter stores mask low8bits for positive and negative arithmetic while snapshots remain canonical', () => {
  const f = fixture([script('test:counter-wrap', ctx => {
    const counter = ctx.attachment.counter(0)
    counter.value = 255; ctx.game.actions.add(counter, counter, 1); assert.equal(counter.value, 0)
    ctx.game.actions.subtract(counter, counter, 1); assert.equal(counter.value, 255)
    counter.value = 513; assert.equal(counter.value, 1)
    counter.value = -258; assert.equal(counter.value, 254)
  })])
  f.engine.registerAttachment('door:use', { scriptId: 'test:counter-wrap' })
  f.invoke('test:counter-wrap', { attachmentId: 'door:use' }).commit()
  const snapshot = f.engine.snapshot()
  assert.equal(snapshot.attachments['door:use'].counters[0], 254)
  snapshot.attachments['door:use'].counters[0] = 256
  assert.throws(() => f.engine.prepareRestore(snapshot))
})
test('original delayed calls use fresh template state and SAP_USE while authored schedules retain caller policy', () => {
  let fired = 0
  const f = fixture([script('test:heartbeat-timer', ctx => {
    ctx.game.actions.callScriptIn(999, 0, ctx.triggerer, ctx.attachee, 1)
    ctx.game.schedule('test:999', 8)
  }), api.defineScript({ id: 'test:999', name: 'timer callback', realm: 'server', template: { flags: 0, counters: [22, 0, 0, 0] }, entryPoints: {
    0(ctx) { assert.equal(ctx.attachment.counter(0).value, 22); ctx.attachment.counter(0).value = 23; fired++ }
  } })])
  f.engine.registerAttachment('door:heartbeat', { scriptId: 'test:heartbeat-timer', counters: [99, 0, 0, 0] })
  f.invoke('test:heartbeat-timer', { attachmentId: 'door:heartbeat', attachmentPoint: 19, extraId: 'npc' }).commit()
  const queue = f.engine.snapshot().scheduled
  assert.equal(queue[0].invocation.attachmentPoint, 1); assert.equal(queue[0].invocation.extraId, null)
  assert.equal(queue[0].invocation.attachmentId, undefined)
  assert.equal(queue[1].invocation.attachmentPoint, 19); assert.equal(queue[1].invocation.extraId, 'npc')
  assert.equal(queue[0].dueMs, 8000)
  for (let step = 0; step < 4; step++) f.engine.prepareAdvance(250).commit()
  assert.equal(fired, 2)
  assert.equal(f.engine.binding('door:heartbeat')?.counters[0], 99)
})
test('original dynamic -4 returns run-default while bypassing automatic removal, unlike -3', () => {
  for (const control of [-3, -4]) {
    const definition = api.defineScript({ id: 'test:special-return', name: 'special return', realm: 'server', scriptFlags: 4,
      entryPoints: { 0: () => api.flow.jumpByLine(control) } })
    const f = fixture([definition]); f.engine.registerAttachment('door:use', { scriptId: definition.id })
    const transaction = f.invoke(definition.id, { attachmentId: 'door:use' })
    assert.equal(transaction.runDefault, true); transaction.commit()
    assert.equal(f.engine.binding('door:use')?.scriptId, control === -4 ? definition.id : '')
  }
})

// Compiled by the fixture checker. These intentional negative cases protect the
// public declarations, rather than merely checking runtime string lookups.
function declaredDataTypeContracts(): void {
  const keys = api.defineDataKeys({ count: { default: 0, validate: (value: unknown): value is number => typeof value === 'number' } })
  const store = api.bindDataStore({}, keys)
  const count: number = store.get('count')
  store.set('count', count + 1)
  // @ts-expect-error Unknown declared keys must remain a type error.
  store.get('coutn')
  // @ts-expect-error A declared numeric key cannot accept a string.
  store.set('count', '1')
}
void declaredDataTypeContracts

test('declared data keys reject typos and malformed values and clone defaults, reads and writes', () => {
  const original = { values: [1] }
  const keys = api.defineDataKeys({
    count: { default: 0, validate: (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 },
    details: { default: original, validate: (value: unknown): value is { values: number[] } =>
      !!value && typeof value === 'object' && 'values' in value && Array.isArray(value.values) && value.values.every(item => typeof item === 'number') },
  })
  original.values.push(2)
  const first: JsonObject = {}, second: JsonObject = {}
  const a = api.bindDataStore(first, keys), b = api.bindDataStore(second, keys)
  assert.deepEqual(a.get('details'), { values: [1] })
  const read = a.get('details'); read.values.push(3)
  assert.deepEqual(a.get('details'), { values: [1] })
  a.set('details', read); read.values.push(4)
  assert.deepEqual(a.get('details'), { values: [1, 3] }); assert.deepEqual(b.get('details'), { values: [1] })
  assert.throws(() => Reflect.apply(a.get, a, ['unknown']), { code: 'INVALID_DATA_KEY' })
  assert.throws(() => Reflect.apply(a.set, a, ['count', 'bad']), { code: 'INVALID_DATA_KEY' })
  const malformed: JsonObject = { details: 'bad' }
  assert.throws(() => api.bindDataStore(malformed, keys), { code: 'INVALID_DATA_KEY' })
  assert.deepEqual(malformed, { details: 'bad' }, 'failed binding cannot partially insert defaults')
  const schema = api.schemaFromDataKeys(keys)
  assert.equal(schema.validate({ count: 0, details: { values: [1] }, unexpected: 1 }), false)
})

test('declared keys persist and validate all four server stores, including shared cross-script state', () => {
  const keys = api.defineDataKeys({ count: { default: 2, validate: (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 } })
  const schema = api.schemaFromDataKeys(keys, 2)
  const f = fixture([api.defineScript({ id: 'test:typed-stores', name: 'typed stores', realm: 'server',
    dataSchema: schema, sharedSchema: schema, playerSchema: schema, attachmentSchema: schema,
    entryPoints: { 0(ctx) {
      for (const scope of [ctx.data, ctx.shared.data, ctx.player.data, ctx.attachment.data]) {
        const store = api.bindDataStore(scope, keys); store.set('count', store.get('count') + 1)
      }
    } } }), api.defineScript({ id: 'test:typed-other', name: 'other script', realm: 'server', sharedSchema: schema,
    entryPoints: { 0(ctx) { const shared = api.bindDataStore(ctx.shared.data, keys); assert.equal(shared.get('count'), 3); shared.set('count', 7) } } })])
  f.engine.registerAttachment('door:typed', { scriptId: 'test:typed-stores' })
  f.invoke('test:typed-stores', { attachmentId: 'door:typed' }).commit()
  f.invoke('test:typed-other').commit()
  const saved = f.engine.snapshot()
  assert.equal(saved.data['test:typed-stores'].value.count, 3)
  assert.equal(saved.shared.data.test.value.count, 7)
  assert.equal(saved.players.pc.data.test.value.count, 3)
  assert.equal(saved.attachments['door:typed'].data.count, 3)
  f.invoke('test:typed-stores', { attachmentId: 'door:typed' }).commit()
  f.engine.prepareRestore(saved).commit(); assert.deepEqual(f.engine.snapshot(), saved)
  const mutations: ((document: typeof saved) => void)[] = [
    document => { document.data['test:typed-stores'].value.count = 'bad' },
    document => { document.shared.data.test.value.count = 'bad' },
    document => { document.players.pc.data.test.value.count = 'bad' },
    document => { document.attachments['door:typed'].data.count = 'bad' },
  ]
  for (const mutate of mutations) {
    const document = structuredClone(saved); mutate(document)
    assert.throws(() => f.engine.prepareRestore(document), { code: 'INVALID_SCHEMA' })
    assert.deepEqual(f.engine.snapshot(), saved)
  }
})

test('binding declared keys revalidates raw compatibility writes before either realm commits', () => {
  const keys = api.defineDataKeys({ count: { default: 0, validate: (value: unknown): value is number => typeof value === 'number' } })
  const f = fixture([script('test:typed-raw', ctx => {
    api.bindDataStore(ctx.data, keys).set('count', 1)
    ctx.data.count = 'invalid'; ctx.shared.variable(0).value = 9; ctx.ui.message('discard')
  })])
  const baseline = f.engine.snapshot()
  assert.throws(() => f.invoke('test:typed-raw'), { code: 'INVALID_DATA_KEY' })
  assert.deepEqual(f.engine.snapshot(), baseline); assert.deepEqual(f.effects, [])
  const effects: ScriptPresentation[] = []
  const client = new ClientEngine({ scripts: [api.defineScript({ id: 'test:typed-client', name: 'typed client', realm: 'client', entryPoints: {
    0(ctx) { api.bindDataStore(ctx.data, keys); ctx.data.count = 'invalid'; ctx.ui.message('discard') },
  } })], emitPresentation: effect => effects.push(effect) })
  assert.throws(() => client.run('test:typed-client'), { code: 'INVALID_DATA_KEY' })
  assert.deepEqual(client.snapshot(), {}); assert.deepEqual(effects, [])
})

test('disposing a script world clears timers/stores and invalidates new and retained transactions', () => {
  let disposals = 0
  const f = fixture([script('test:dispose', ctx => {
    ctx.data.count = 1; ctx.shared.variable(0).value = 1
    ctx.game.schedule('test:dispose', 8); ctx.ui.message('never published')
  })], { onDispose() { disposals++ } })
  f.engine.registerAttachment('door:dispose', { scriptId: 'test:dispose' })
  const committed = f.invoke('test:dispose'); committed.commit()
  const saved = f.engine.snapshot(), prepared = f.invoke('test:dispose')
  assert.equal(saved.scheduled.length, 1)
  f.engine.dispose(); f.engine.dispose()
  assert.equal(disposals, 1)
  const cleared = f.engine.snapshot()
  assert.deepEqual(cleared.scheduled, []); assert.deepEqual(cleared.data, {}); assert.deepEqual(cleared.attachments, {})
  assert.deepEqual(cleared.shared, { flags: {}, variables: {}, data: {} }); assert.equal(f.engine.objects().size, 0)
  assert.equal(f.engine.binding('door:dispose'), undefined)
  for (const operation of [() => f.invoke('test:dispose'), () => f.engine.prepareAdvance(250), () => f.engine.prepareRestore(saved),
    () => f.engine.registerAttachment('another', { scriptId: 'test:dispose' }),
    prepared.commit, prepared.rollback, prepared.flushEffects, committed.rollback, committed.flushEffects]) {
    assert.throws(operation, { code: 'SCRIPT_DISPOSED' })
  }
  assert.deepEqual(f.engine.snapshot(), cleared); assert.deepEqual(f.effects, [])
})

test('disposing client scripts removes programs/local data and rejects later presentation runs', () => {
  const client = new ClientEngine({ scripts: [api.defineScript({ id: 'test:disposed-client', name: 'disposed client', realm: 'client',
    entryPoints: { 0(ctx) { ctx.data.count = 1 } } })], emitPresentation() {} })
  client.run('test:disposed-client'); assert.deepEqual(client.snapshot(), { 'test:disposed-client': { count: 1 } })
  client.dispose(); client.dispose()
  assert.deepEqual(client.snapshot(), {})
  assert.throws(() => client.run('test:disposed-client'), { code: 'SCRIPT_DISPOSED' })
})
