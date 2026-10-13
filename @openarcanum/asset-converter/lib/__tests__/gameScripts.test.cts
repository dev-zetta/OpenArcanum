const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const {test} = require('node:test') as typeof import('node:test')
const fs = require('node:fs/promises') as typeof import('node:fs/promises')
const os = require('node:os') as typeof import('node:os')
const path = require('node:path') as typeof import('node:path')
const {parseScript, parseMes, indexDialogue} = require('../../dist/src/scripts/BinaryScript.cjs') as typeof import('../../dist/src/scripts/BinaryScript.cjs')
const {actionCatalog, conditionCatalog} = require('../../dist/src/scripts/OpcodeCatalog.cjs') as typeof import('../../dist/src/scripts/OpcodeCatalog.cjs')
const {createSharedSymbolCatalog} = require('../../dist/src/scripts/SharedSymbolCatalog.cjs') as typeof import('../../dist/src/scripts/SharedSymbolCatalog.cjs')
const {emitScript} = require('../../dist/src/scripts/TypeScriptGenerator.cjs') as typeof import('../../dist/src/scripts/TypeScriptGenerator.cjs')
const {importGameScripts} = require('../../dist/src/scripts/GameScriptImporter.cjs') as typeof import('../../dist/src/scripts/GameScriptImporter.cjs')
import type {ScriptArchive} from '../../dist/src/scripts/GameScriptImporter.cjs'
const {parseSectorScriptBindings, correlateSectorScriptBindings} = require('../../dist/src/scripts/SectorScriptBindings.cjs') as typeof import('../../dist/src/scripts/SectorScriptBindings.cjs')
const {analyzeScriptDependencies} = require('../../dist/src/scripts/ScriptAnalysis.cjs') as typeof import('../../dist/src/scripts/ScriptAnalysis.cjs')

interface Block {code: number; operands?: {type: number; value: number}[]}
function scr(rows: {condition: Block; action: Block; otherwise?: Block}[], counters = 0): Buffer {
  const data = Buffer.alloc(64 + rows.length * 132, 0xcc)
  data.writeUInt32LE(0, 0); data.writeUInt32LE(counters, 4); data.fill(0, 8, 48)
  data.writeUInt32LE(0, 48); data.writeInt32LE(rows.length, 52); data.writeInt32LE(rows.length, 56)
  function block(offset: number, value: Block) {
    data.writeInt32LE(value.code, offset)
    for (const [index, operand] of (value.operands || []).entries()) {
      data[offset + 4 + index] = operand.type; data.writeInt32LE(operand.value, offset + 12 + index * 4)
    }
  }
  for (const [index, row] of rows.entries()) {
    block(64 + index * 132, row.condition); block(108 + index * 132, row.action); block(152 + index * 132, row.otherwise || {code: 0})
  }
  return data
}
const empty = scr([])
const returnScript = scr([{condition: {code: 0}, action: {code: 2}}])
const catalogMes = (catalog: typeof actionCatalog) => Buffer.from(catalog.map(value => `{${value.code}}{${value.operands.map(kind => kind.startsWith('number') ? '(num)' : '(obj)').join(' ')}}`).join('\n'))
function archive(scripts: Record<string, Buffer>): ScriptArchive {
  const values = {'semes/action.mes': catalogMes(actionCatalog), 'semes/condition.mes': catalogMes(conditionCatalog), ...scripts}
  return {names: async () => Object.keys(values), read: async name => {
    if (!Object.hasOwn(values, name)) throw new Error('Missing fixture entry')
    return values[name as keyof typeof values]
  }}
}
test('binary reader validates exact layout and ignores historical pointer/unused operand garbage', () => {
  const value = parseScript(returnScript, 'scr/01000Synthetic.scr')
  assert.equal(value.id, 1000); assert.equal(value.rows.length, 1)
  assert.deepEqual(value.rows[0].condition.operands, []); assert.deepEqual(value.rows[0].otherwise.operands, [])
  assert.throws(() => parseScript(returnScript.subarray(0, -1), 'scr/01000Synthetic.scr'), /entry count\/size/)
  assert.throws(() => parseScript(returnScript, '../no-number.scr'), /five-digit/)
  const invalid = Buffer.from(returnScript); invalid.writeInt32LE(1000, 64)
  assert.throws(() => parseScript(invalid, '01000Synthetic.scr'), /Unknown SCR opcode/)
})
test('binary reader validates only consumed operand types and local indices', () => {
  const bad = scr([{condition: {code: 4, operands: [{type: 99, value: 0}, {type: 3, value: 1}]}, action: {code: 2}}])
  assert.throws(() => parseScript(bad, '01000Synthetic.scr'), /consumed operand type/)
  const local = scr([{condition: {code: 0}, action: {code: 10, operands: [{type: 2, value: 10}, {type: 3, value: 0}]}}])
  assert.throws(() => parseScript(local, '01000Synthetic.scr'), /local\/counter index/)
})
test('generic opcode catalog exhaustively names all53 conditions and142 actions with writable targets', () => {
  assert.equal(conditionCatalog.length, 53); assert.equal(actionCatalog.length, 142)
  assert.equal(new Set(actionCatalog.map(value => value.name)).size, 142)
  assert.deepEqual(actionCatalog[10].operands, ['numberTarget', 'number'])
  assert.deepEqual(actionCatalog[15].operands, ['objectTarget', 'object'])
  assert.deepEqual(actionCatalog[79].operands, ['object', 'object', 'object', 'number', 'number'])
  assert.equal(actionCatalog[141].name, 'setNightStandpointEx')
})
test('MES parser retains duplicate descriptions and comment-like text inside braces', () => {
  assert.deepEqual(parseMes('{1000}{http://example.test} // comment\n{1000}{second}'),
    [{id: 1000, text: 'http://example.test'}, {id: 1000, text: 'second'}])
})
test('shared symbols retain numeric identity and fail closed on conflicting semantic descriptions', () => {
  const symbols = createSharedSymbolCatalog([{id: 2730, text: 'Author - one meaning'}, {id: 2730, text: 'Author - another meaning'}], [], [], {flags: {'2730': 'misleadingAlias'}})
  assert.equal(symbols.flags[0].alias, 'globalFlag2730'); assert.equal(symbols.flags[0].reviewed, false)
  assert.equal(symbols.flags[0].descriptions.length, 2); assert.equal(symbols.diagnostics.length, 1)
  assert.throws(() => createSharedSymbolCatalog([{id: 1, text: 'hello'}], [], [], {flags: {'1': 'bad alias'}}), /Invalid reviewed/)
  assert.throws(() => createSharedSymbolCatalog([{id: 1, text: 'hello'}], [], [], {flags: {'1': '__proto__'}}), /Invalid reviewed/)
  assert.equal(createSharedSymbolCatalog([{id: 1, text: 'constructor'}], [], []).flags[0].alias, 'globalFlag1')
})
test('generator emits ordinary named continuations, direct named APIs, and original entry metadata', () => {
  const value = parseScript(scr([
    {condition: {code: 4, operands: [{type: 4, value: 1000}, {type: 3, value: 1}]}, action: {code: 0}, otherwise: {code: 3, operands: [{type: 3, value: 2}]}},
    {condition: {code: 0}, action: {code: 56, operands: [{type: 1, value: -987654}]}},
    {condition: {code: 0}, action: {code: 2}},
  ]), '01000Synthetic.scr')
  const symbols = createSharedSymbolCatalog([{id: 1000, text: 'Author - Named feature'}], [], [value], {flags: {'1000': 'namedFeature'}})
  const generated = emitScript(value, symbols).text
  assert.match(generated, /ctx\.shared\.flag\(symbols\.flags\.namedFeature\)/)
  assert.match(generated, /ctx\.game\.actions\.toggleState\(ctx\.attachee\)/)
  assert.match(generated, /flow\.jump\(synthetic_returnAndRunDefault_2\)/)
  assert.match(generated, /originalEntryLines = \[0,1,2\]/)
  assert.doesNotMatch(generated, /switch\s*\(|programCounter|executeOpcode/)
})
test('generator preserves local references, packed PC scope, unsupported named operations, and falloff skip', () => {
  const value = parseScript(scr([
    {condition: {code: 0}, action: {code: 11, operands: [{type: 2, value: 0}, {type: 5, value: (12 << 16) | 17}, {type: 3, value: 1}]}},
    {condition: {code: 0}, action: {code: 58, operands: [{type: 11, value: 1}]}}
  ]), '01000Synthetic.scr')
  const generated = emitScript(value, createSharedSymbolCatalog([], [], [value])).text
  assert.match(generated, /const localNumber0 = ctx\.localNumber\(0\)/)
  assert.match(generated, /ctx\.playerState\(12\)\.variable\(17\)/)
  assert.match(generated, /ctx\.game\.actions\.kill\(ctx\.object\(localObject1\)\)/)
  assert.match(generated, /return flow\.skipDefault\(\)/)
})
test('empty and out-of-range original scripts explicitly skip default', () => {
  const zero = parseScript(empty, '01000Empty.scr')
  assert.match(emitScript(zero, createSharedSymbolCatalog([], [], [zero])).text, /empty_empty.*flow\.skipDefault/)
  const jump = parseScript(scr([{condition: {code: 0}, action: {code: 3, operands: [{type: 3, value: 19}]}}]), '01001Jump.scr')
  assert.equal(emitScript(jump, createSharedSymbolCatalog([], [], [jump])).diagnostics.length, 1)
})
test('literal special return -4 preserves its bypass of automatic script removal', () => {
  const source = scr([{condition: {code: 0}, action: {code: 3, operands: [{type: 3, value: -4}]}}])
  source.writeUInt32LE(4, 48)
  const special = parseScript(source, '01000Special.scr')
  const generated = emitScript(special, createSharedSymbolCatalog([], [], [special])).text
  assert.match(generated, /return flow\.jumpByLine\(-4\)/)
  assert.doesNotMatch(generated, /return flow\.runDefault\(\)/)
  const ordinary = parseScript(scr([{condition: {code: 0}, action: {code: 3, operands: [{type: 3, value: -3}]}}]), '01001Ordinary.scr')
  assert.match(emitScript(ordinary, createSharedSymbolCatalog([], [], [ordinary])).text, /return flow\.runDefault\(\)/)
})
test('reviewed per-script local aliases name references without changing their original indices', () => {
  const source = parseScript(scr([
    {condition: {code: 0}, action: {code: 11, operands: [{type: 2, value: 0}, {type: 2, value: 1}, {type: 3, value: 1}]}},
    {condition: {code: 0}, action: {code: 15, operands: [{type: 11, value: 2}, {type: 11, value: 3}]}}
  ]), '01000Synthetic.scr')
  const reviewed = {locals: {'arcanum:1000': {numbers: {'0': 'distance'}, objects: {'2': 'guard'}}}}
  const generated = emitScript(source, createSharedSymbolCatalog([], [], [source], reviewed), reviewed).text
  assert.match(generated, /const distance = ctx\.localNumber\(0\)/)
  assert.match(generated, /const localNumber1 = ctx\.localNumber\(1\)/)
  assert.match(generated, /ctx\.game\.actions\.add\(distance, ctx\.number\(localNumber1\), 1\)/)
  assert.match(generated, /const guard = ctx\.localObject\(2\)/)
  assert.match(generated, /const localObject3 = ctx\.localObject\(3\)/)
  assert.match(generated, /ctx\.game\.actions\.assignObj\(guard, ctx\.object\(localObject3\)\)/)
  assert.match(emitScript({...source, id: 1001}, createSharedSymbolCatalog([], [], [source]), reviewed).text, /const localNumber0 = ctx\.localNumber\(0\)/)
})
test('reviewed local aliases reject invalid indices/names, duplicate bindings, and generator name collisions', () => {
  const source = parseScript(returnScript, '01000Synthetic.scr'), symbols = createSharedSymbolCatalog([], [], [source])
  for (const numbers of [{'10': 'distance'}, {'0': 'bad name'}, {'0': 'ctx'}, {'0': 'const'}, {'0': 'flow'}, {'0': 'symbols'},
    {'0': 'same', '1': 'same'}, {'0': 'localNumber1'}, {'0': 'localObject0'}, {'0': 'synthetic_returnAndRunDefault_0'}]) {
    assert.throws(() => emitScript(source, symbols, {locals: {'arcanum:1000': {numbers}}}), /Invalid reviewed local|Duplicate reviewed local/)
  }
  assert.throws(() => emitScript(source, symbols, {locals: {'arcanum:1000': {numbers: {'0': 'sharedName'}, objects: {'0': 'sharedName'}}}}), /Duplicate reviewed local/)
  assert.throws(() => emitScript(source, symbols, {locals: {'arcanum:1000': {}, '1000': {}}}), /Duplicate reviewed local script/)
  assert.throws(() => emitScript(source, symbols, {locals: {'not-a-script': {}}}), /Invalid reviewed local script identity/)
})
test('DLG indexing preserves its separate condition/effect language and reports malformed records', () => {
  const value = indexDialogue(Buffer.from('{1}{hello}{hi}{0}{gf1000}{2}{gf1001 1}\nmalformed'), 'dlg/01000Synthetic.dlg')
  assert.equal(value.id, 1000); assert.equal(value.rows, 1)
  assert.deepEqual(value.dependencyText, [{line: 1, condition: 'gf1000', effect: 'gf1001 1'}])
  assert.equal(value.diagnostics.length, 1)
})
test('reimport is a true no-op and changed input stages comparison without overwriting human edits', async t => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'arcanum-script-import-')); t.after(() => fs.rm(output, {recursive: true, force: true}))
  const options = {archive: archive({'scr/01000Synthetic.scr': returnScript}), output, globalFlags: Buffer.alloc(0), globalVariables: Buffer.alloc(0)}
  const first = await importGameScripts(options); assert.equal(first.status, 'created')
  const filename = path.join(output, 'src/scripts/01000_synthetic.ts'), before = await fs.stat(filename, {bigint: true})
  const repeat = await importGameScripts(options); assert.equal(repeat.status, 'unchanged')
  assert.equal((await fs.stat(filename, {bigint: true})).mtimeNs, before.mtimeNs)
  await fs.appendFile(filename, '// human edit\n')
  const edited = await importGameScripts(options); assert.deepEqual(edited.editedFiles, ['src/scripts/01000_synthetic.ts'])
  const candidate = await importGameScripts({...options, archive: archive({'scr/01000Synthetic.scr': scr([{condition: {code: 0}, action: {code: 2}}], 1)})})
  assert.equal(candidate.status, 'candidate'); assert.match(await fs.readFile(filename, 'utf8'), /human edit/)
  const comparison = JSON.parse(await fs.readFile(path.join(candidate.candidate!, 'comparison.json'), 'utf8'))
  assert.deepEqual(comparison.editedFiles, ['src/scripts/01000_synthetic.ts'])
})
test('ambiguous source identities and changed opcode signatures are rejected', async t => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'arcanum-script-reject-')); t.after(() => fs.rm(output, {recursive: true, force: true}))
  const options = {output, globalFlags: Buffer.alloc(0), globalVariables: Buffer.alloc(0)}
  await assert.rejects(importGameScripts({...options, archive: archive({'scr/01000One.scr': returnScript, 'other/01000Two.scr': returnScript})}), /Ambiguous original script ID/)
  await assert.rejects(importGameScripts({...options, archive: archive({'semes/action.mes': Buffer.from('{0}{missing catalog}'), 'scr/01000One.scr': returnScript})}), /signature differs/)
})

function syntheticSector(scriptId: number, slot = 1): Buffer {
  const record = Buffer.alloc(116)
  record.writeUInt32LE(0x77); record.writeInt16LE(1, 4); record.writeUInt32LE(2029, 12)
  record.writeUInt32LE(1, 52); record.writeUInt16LE(3, 56)
  record.writeUInt32LE(0x80000002, 58); record.writeUInt32LE(0, 62); record.writeUInt32LE(1, 66)
  record[70] = 1; record.writeUInt32LE(94, 71); record.writeUInt32LE(95, 75)
  record[79] = 1; record.writeUInt32LE(12, 80); record.writeUInt32LE(1, 84)
  record.writeUInt32LE(0, 92); record.writeUInt32LE(0, 96); record.writeInt32LE(scriptId, 100)
  record.writeUInt32LE(1, 104); record.writeUInt32LE(1 << slot, 108); record.writeUInt32LE(0, 112)
  const prefix = Buffer.alloc(4 + 4096 * 4 + 4 + 4)
  prefix.writeUInt32LE(1, 4 + 4096 * 4); prefix.writeUInt32LE(0xaa0000, prefix.length - 4)
  const footer = Buffer.alloc(4); footer.writeUInt32LE(1)
  return Buffer.concat([prefix, record, footer])
}
test('sequential sector decoder preserves static null identity, slot, zero IDs, and source boundaries', () => {
  const data = syntheticSector(1162), value = parseSectorScriptBindings(data, 'maps/Example/67108865.sec')
  assert.deepEqual(value.sector, {x: 1, y: 1}); assert.equal(value.objects.length, 1)
  assert.equal(value.objects[0].serializedId, null); assert.equal(value.objects[0].sourceLength, 116)
  assert.deepEqual(value.objects[0].location, {x: 94, y: 95})
  assert.deepEqual(value.objects[0].scripts, [{slot: 1, flags: 0, counters: 0, scriptId: 1162}])
  assert.equal(parseSectorScriptBindings(syntheticSector(0), '1.sec').objects[0].scripts?.[0].scriptId, 0)
})
test('sector decoder rejects damaged override masks, sparse counts, and footer/object boundaries', () => {
  const mask = syntheticSector(1162); mask.writeUInt32LE(0x100, 4 + 4096 * 4 + 8 + 66)
  assert.throws(() => parseSectorScriptBindings(mask, '1.sec'), /override bits/)
  const sparse = syntheticSector(1162); sparse.writeUInt32LE(0, 4 + 4096 * 4 + 8 + 108)
  assert.throws(() => parseSectorScriptBindings(sparse, '1.sec'), /sparse array count/)
  const footer = syntheticSector(1162); footer.writeUInt32LE(0, footer.length - 4)
  assert.throws(() => parseSectorScriptBindings(footer, '1.sec'), /boundary\/footer/)
})
test('static correlation respects explicit zero versus inherited attachment and rejects ambiguity', () => {
  const sector = parseSectorScriptBindings(syntheticSector(0), 'maps/Example/67108865.sec')
  const converted = [{sourcePath: 'Example/Sector/1/1/Portal/owned.json', type: 'Portal', prototype: 2029, location: [95, 94] as const}]
  const prototypes = new Map([[2029, {id: 2029, type: 'Portal', sourceSha256: '0'.repeat(64), scripts: [{slot: 1, flags: 3, counters: 0x04030201, scriptId: 1000}]}]])
  const cleared = correlateSectorScriptBindings([sector], converted, prototypes, 'Example')
  assert.equal(cleared.bindings.objects[converted[0].sourcePath]['1'].scriptId, null)
  delete sector.objects[0].scripts
  const inherited = correlateSectorScriptBindings([sector], converted, prototypes, 'Example')
  assert.deepEqual(inherited.bindings.objects[converted[0].sourcePath]['1'], {scriptId: 'arcanum:1000', flags: 3, counters: [1, 2, 3, 4]})
  assert.throws(() => correlateSectorScriptBindings([sector], [...converted, {...converted[0], sourcePath: 'Example/Sector/1/1/Portal/other.json'}], prototypes, 'Example'), /Ambiguous/)
  assert.equal(correlateSectorScriptBindings([sector], [], prototypes, 'Example').unmatched.length, 1)
  assert.throws(() => correlateSectorScriptBindings([sector], converted, new Map(), 'Example'), /Missing\/mismatched/)
})
test('dependency index separates literal versus dynamic script calls and original dialogue identity', () => {
  const script = parseScript(scr([
    {condition: {code: 0}, action: {code: 7, operands: [{type: 3, value: 1001}, {type: 3, value: 0}, {type: 0, value: 0}, {type: 1, value: 0}]}},
    {condition: {code: 0}, action: {code: 6, operands: [{type: 2, value: 0}]}},
    {condition: {code: 0}, action: {code: 4, operands: [{type: 3, value: 1}]}}
  ]), '01000Synthetic.scr')
  assert.deepEqual(analyzeScriptDependencies(script).map(value => [value.kind, value.target, value.dynamic]),
    [['script', 1001, false], ['script', null, true], ['dialogue', 1000, false]])
})
