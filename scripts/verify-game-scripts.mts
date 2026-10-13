import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import {build} from 'esbuild'
import type {ScriptHost, ScriptObject} from '../@openarcanum/agate/src/shared/scripting/ScriptApi'
import type {ActionName, ConditionName} from '../@openarcanum/agate/src/shared/scripting/OperationCatalog'
const require = createRequire(import.meta.url)
const Zip = require('node-stream-zip') as typeof import('node-stream-zip')
const {parseSectorScriptBindings} = require('../@openarcanum/asset-converter/dist/src/scripts/SectorScriptBindings.cjs') as typeof import('../@openarcanum/asset-converter/lib/src/scripts/SectorScriptBindings.cjs')

const directory = path.resolve('local-data/scripts/arcanum/research')
await fs.mkdir(directory, {recursive: true})
const runtimeFile = path.join(directory, 'witness-runtime.cjs')
await build({stdin: {contents: "export {default as ScriptEngine} from './@openarcanum/agate/src/shared/scripting/ScriptEngine'; export {default as NodeScriptLoader} from './@openarcanum/agate/src/shared/scripting/NodeScriptLoader'; export {actionNames,conditionNames} from './@openarcanum/agate/src/shared/scripting/OperationCatalog'", resolveDir: process.cwd(), loader: 'ts'},
  outfile: runtimeFile, bundle: true, platform: 'node', target: 'node24', format: 'cjs'})
const {ScriptEngine, NodeScriptLoader, actionNames, conditionNames} = require(runtimeFile) as {
  ScriptEngine: typeof import('../@openarcanum/agate/src/shared/scripting/ScriptEngine').default
  NodeScriptLoader: typeof import('../@openarcanum/agate/src/shared/scripting/NodeScriptLoader').default
  actionNames: readonly ActionName[]; conditionNames: readonly ConditionName[]
}
const zip = new Zip.async({file: 'local-data/unpacked_data.zip'})
try {
  const sourceEntry = 'Arcanum/maps/Caladon-Panarrii Temple/67108865.sec'
  const recovered = parseSectorScriptBindings(await zip.entryData(sourceEntry), sourceEntry)
  const target = recovered.objects.find(object => object.ordinal === 246)
  assert.ok(target); assert.equal(target.type, 'Portal'); assert.equal(target.prototype, 2029)
  assert.deepEqual(target.location, {x: 94, y: 95})
  const originalBinding = target.scripts?.find(binding => binding.slot === 1)
  assert.ok(originalBinding); assert.equal(originalBinding.scriptId, 1162)
  const object: ScriptObject = {id: `${sourceEntry}#object${target.ordinal}`, type: target.type, prototype: target.prototype,
    location: [target.location!.y, target.location!.x]}
  const host: ScriptHost = {getObject: id => id === object.id ? object : null, isOff: () => false,
    prepareObjectWrites: writes => {
      assert.deepEqual(writes, []) // This script gates default behavior without changing objects.
      return {apply() {}, rollback() {}}
    }}
  const manifest = path.resolve('local-data/scripts/arcanum/dist/manifest.json')
  const resolver = new NodeScriptLoader(manifest, {realm: 'server'})
  const outcomes: {flag: 0 | 1; runDefault: boolean; defaultDoorOpened: boolean}[] = []
  for (const flag of [0, 1] as const) {
    const engine = new ScriptEngine({host, resolver, initialFlags: {arcanum: {2087: flag}}, symbols: resolver.symbols})
    const attachmentId: string = `${object.id}#${originalBinding.slot}`
    engine.registerAttachment(attachmentId, {scriptId: `arcanum:${originalBinding.scriptId}`, flags: originalBinding.flags,
      counters: [0, 1, 2, 3].map(index => (originalBinding.counters >>> (index * 8)) & 255)})
    const transaction = engine.prepare({scriptId: `arcanum:${originalBinding.scriptId}`, attachmentId, attachmentPoint: originalBinding.slot,
      attacheeId: object.id, triggererId: object.id})
    assert.equal(transaction.runDefault, flag === 1)
    transaction.commit(); transaction.flushEffects()
    // Represents the host's supported ordinary door action; no Caladon render
    // import or original quest progression is claimed by this headless witness.
    const defaultDoorOpened = transaction.runDefault
    assert.equal(defaultDoorOpened, flag === 1)
    assert.equal(engine.binding(attachmentId)?.scriptId, 'arcanum:1162')
    outcomes.push({flag, runDefault: transaction.runDefault, defaultDoorOpened})
  }
  const report = {version: 1, verified: true, sourceEntry, sourceSha256: recovered.sourceSha256,
    sectorObjects: recovered.objects.length, sectorTileScripts: recovered.tiles.length,
    target, originalBinding, moduleContentIdentity: resolver.contentIdentity, outcomes,
    limitations: 'Headless actual-binding/default-gate witness. Caladon map rendering, Examine1161, and original prerequisites are not implemented by this test.'}
  const filename = path.join(directory, 'original-01162-witness.json')
  await fs.writeFile(filename, JSON.stringify(report, null, 2) + '\n')
  const probeHost: ScriptHost = {getObject: () => null, isOff: () => false, prepareObjectWrites: () => ({apply() {}, rollback() {}})}
  const supportedActions: string[] = [], supportedConditions: string[] = []
  for (const kind of ['action', 'condition'] as const) for (const name of kind === 'action' ? actionNames : conditionNames) {
    const definition: import('../@openarcanum/agate/src/shared/scripting/ScriptApi').ServerScriptDefinition = {
      id: `coverage:${kind}_${name}`, name: `SDK ${kind} capability probe`, realm: 'server', entryPoints: {0: ctx => {
        if (kind === 'action') ctx.game.actions[name as ActionName]()
        else ctx.game.conditions[name as ConditionName]()
      }}}
    const engine = new ScriptEngine({host: probeHost, resolver: {contentIdentity: 'capability-probe', resolve: id => id === definition.id ? definition : undefined}})
    let supported = true
    try {engine.prepare({scriptId: definition.id})} catch (error) {
      supported = !(error && typeof error === 'object' && 'code' in error && error.code === 'UNSUPPORTED_OPERATION')
    }
    if (supported) (kind === 'action' ? supportedActions : supportedConditions).push(name)
  }
  assert.ok(supportedActions.includes('divide'), 'original CDQ/IDIV evidence-backed kernel action must be available')
  const controls = ['goto', 'returnAndRunDefault', 'returnAndSkipDefault']
  const scriptIndex = JSON.parse(await fs.readFile('local-data/scripts/arcanum/script-index.json', 'utf8')) as {
    id: string; sourceEntry: string; operations: {actions: string[]; conditions: string[]}; dependencies?: unknown[]
  }[]
  const perScript = scriptIndex.map(script => ({id: script.id, sourceEntry: script.sourceEntry,
    unsupportedActions: script.operations.actions.filter(name => !supportedActions.includes(name) && !controls.includes(name)),
    unsupportedConditions: script.operations.conditions.filter(name => !supportedConditions.includes(name)),
    dependencies: script.dependencies || []}))
  const coverage = {version: 1, catalog: {actions: actionNames.length, conditions: conditionNames.length},
    supportedActions, generatedControlFlow: controls, supportedConditions,
    originalArithmeticEvidence: { path: 'original-opcodes/opcode-byte-evidence.json',
      kind: 'static-original-executable-instructions', runtimeOracleExecuted: false,
      division: 'Signed IDIV truncates toward zero; zero divisor preserves destination. INT_MIN/-1 raises an explicit transactional ARITHMETIC_OVERFLOW fault.',
      counters: 'Original numeric setter masks writes with 0xff; saved counters remain 0..255.' },
    observedActions: [...new Set(scriptIndex.flatMap(script => script.operations.actions))].sort(),
    observedConditions: [...new Set(scriptIndex.flatMap(script => script.operations.conditions))].sort(),
    scriptsWithinCurrentOperationSubset: perScript.filter(script => !script.unsupportedActions.length && !script.unsupportedConditions.length).length,
    scripts: perScript,
    limitations: 'Static operation membership plus SDK unsupported-operation probe. This does not prove original semantic fidelity, selector support, transitive dependency support, or playable campaign coverage.'}
  await fs.writeFile(path.join(directory, 'runtime-coverage.json'), JSON.stringify(coverage, null, 2) + '\n')
  console.log(JSON.stringify({verified: true, report: filename, outcomes}, null, 2))
} finally {await zip.close()}
