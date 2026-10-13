import type { OriginalScript, ScriptOperation, ScriptOperand } from './BinaryScript.cjs'
import { identifier, resolveLocalAliases, type ReviewedAliases, type SharedSymbolCatalog, type SymbolKind } from './SharedSymbolCatalog.cjs'

export interface GeneratedScript {filename: string; text: string; operations: {actions: string[]; conditions: string[]}; diagnostics: string[]}
export const GENERATOR_VERSION = 3
/** Named continuations preserve arbitrary original entry lines without a PC
 * switch or recursive execution. The SDK trampoline bounds instruction count. */
export function emitScript(script: OriginalScript, catalog: SharedSymbolCatalog, reviewed: ReviewedAliases = {}): GeneratedScript {
  const prefix = identifier(script.name, `script${script.id}`), diagnostics: string[] = []
  const functions = script.rows.map(row => `${prefix}_${row.condition.name === 'true' ? row.action.name : `check${row.condition.name[0].toUpperCase()}${row.condition.name.slice(1)}Then${row.action.name[0].toUpperCase()}${row.action.name.slice(1)}`}_${row.line}`)
  const locals = resolveLocalAliases(script.id, reviewed, functions)
  const actions = new Set<string>(), conditions = new Set<string>()
  const alias = (kind: SymbolKind, id: number): string => {
    const symbol = catalog[kind].find(value => value.id === id)
    if (!symbol) throw new Error(`Missing ${kind} symbol${id}`)
    return `symbols.${kind}.${symbol.alias}`
  }
  function numeric(value: ScriptOperand, target = false): string {
    let expression: string
    switch (value.type) {
      case 0: expression = `ctx.attachment.counter(${value.value})`; break
      case 1: expression = `ctx.shared.variable(${alias('variables', value.value)})`; break
      case 2: expression = locals.numbers[value.value]; break
      case 3: return String(value.value)
      case 4: expression = `ctx.shared.flag(${alias('flags', value.value)})`; break
      case 5: case 6: expression = `ctx.playerState(${value.value >>> 16}).${value.type === 5 ? 'variable' : 'flag'}(${value.value & 65535})`; break
      default: throw new Error('Invalid parsed numeric operand')
    }
    return target ? expression : `ctx.number(${expression})`
  }
  function operand(value: ScriptOperand): string {
    if (value.kind === 'number' || value.kind === 'numberTarget') return numeric(value, value.kind === 'numberTarget')
    if (value.type === 11) return value.kind === 'objectTarget' ? locals.objects[value.value] : `ctx.object(${locals.objects[value.value]})`
    const direct: Record<number, string> = {0: 'ctx.triggerer', 1: 'ctx.attachee', 12: 'ctx.extra', 21: 'ctx.playerObject'}
    return direct[value.type] || `ctx.game.select(${value.type})`
  }
  const next = (line: number) => line + 1 < functions.length ? `flow.jump(${functions[line + 1]})` : 'flow.skipDefault()'
  function action(operation: ScriptOperation, line: number, indent: string): string[] {
    actions.add(operation.name)
    const lines = [`${indent}ctx.at(${line}, ${JSON.stringify(operation.name)}, ${operation.code})`]
    if (operation.name === 'returnAndRunDefault') return [...lines, `${indent}return flow.runDefault()`]
    if (operation.name === 'returnAndSkipDefault') return [...lines, `${indent}return flow.skipDefault()`]
    if (operation.name === 'goto') {
      const value = operation.operands[0]
      let jump: string
      if (value.type !== 3) jump = `flow.jumpByLine(${numeric(value)})`
      else if (value.value === -1) jump = next(line)
      else if (value.value === -2) jump = 'flow.skipDefault()'
      else if (value.value === -3) jump = 'flow.runDefault()'
      else if (value.value === -4) jump = 'flow.jumpByLine(-4)'
      else if (functions[value.value]) jump = `flow.jump(${functions[value.value]})`
      else { jump = 'flow.skipDefault()'; diagnostics.push(`Line${line}: jump outside original rows (${value.value}) returns skipDefault`) }
      return [...lines, `${indent}return ${jump}`]
    }
    if (operation.name !== 'doNothing') {
      const args = operation.operands.map(operand)
      if (['globalFlag', 'setGlobalFlag', 'clearGlobalFlag'].includes(operation.name) && operation.operands[0]?.type === 3) args[0] = alias('flags', operation.operands[0].value)
      lines.push(`${indent}ctx.game.actions.${operation.name}(${args.join(', ')})`)
    }
    lines.push(`${indent}return ${operation.name === 'dialog' ? 'flow.skipDefault()' : next(line)}`)
    return lines
  }
  const lines = ['// Editable private conversion of original game script. Reimport never overwrites this file.',
    `// Original: ${script.sourceEntry.replace(/[\r\n\u2028\u2029]/g, ' ')}; SHA256:${script.sha256}`,
    "import { defineScript, flow, type ServerScriptContext, type ScriptFlow } from '@openarcanum/agate/script-api'",
    "import { symbols } from '../symbols/SharedSymbolCatalog'", '',
    `export const originalHeader = ${JSON.stringify(script.header)} as const`,
    `export const originalFileFlags = ${script.fileFlags}`,
    `export const originalEntryLines = ${JSON.stringify(script.rows.map(row => row.line))} as const`, '']
  for (const row of script.rows) {
    const operations = [row.condition, row.action, row.otherwise]
    const localNumbers = new Set<number>(), localObjects = new Set<number>()
    for (const operation of operations) for (const value of operation.operands) {
      if (value.kind.startsWith('number') && value.type === 2) localNumbers.add(value.value)
      if (value.kind.startsWith('object') && value.type === 11) localObjects.add(value.value)
    }
    lines.push(`// Original entry line${row.line}.`, `function ${functions[row.line]}(ctx: ServerScriptContext): ScriptFlow {`)
    for (const index of [...localNumbers].sort()) lines.push(`  const ${locals.numbers[index]} = ctx.localNumber(${index})`)
    for (const index of [...localObjects].sort()) lines.push(`  const ${locals.objects[index]} = ctx.localObject(${index})`)
    if (row.condition.name === 'true') {
      conditions.add('true'); lines.push(...action(row.action, row.line, '  '))
    } else {
      conditions.add(row.condition.name)
      const args = row.condition.operands.map(operand)
      if (row.condition.name === 'globalFlag' && row.condition.operands[0]?.type === 3) args[0] = alias('flags', row.condition.operands[0].value)
      lines.push(`  ctx.at(${row.line}, ${JSON.stringify(row.condition.name)}, ${row.condition.code})`,
        `  if (ctx.game.conditions.${row.condition.name}(${args.join(', ')})) {`, ...action(row.action, row.line, '    '),
        '  } else {', ...action(row.otherwise, row.line, '    '), '  }')
    }
    lines.push('}', '')
  }
  if (!functions.length) lines.push(`function ${prefix}_empty(_ctx: ServerScriptContext): ScriptFlow { return flow.skipDefault() }`, '')
  lines.push('export default defineScript({', '  apiVersion: 1,', `  id: ${JSON.stringify(`arcanum:${script.id}`)},`,
    `  name: ${JSON.stringify(script.name)},`, "  realm: 'server',",
    `  template: { flags: ${script.header.flags}, counters: [${[0, 1, 2, 3].map(index => (script.header.counters >>> (index * 8)) & 255).join(', ')}] },`,
    `  scriptFlags: ${script.fileFlags},`, '  entryPoints: {',
    ...functions.map((name, line) => `    ${line}: ${name},`),
    ...(!functions.length ? [`    0: ${prefix}_empty,`] : []), '  }', '})', '')
  return {filename: `${String(script.id).padStart(5, '0')}_${prefix}.ts`, text: lines.join('\n'),
    operations: {actions: [...actions].sort(), conditions: [...conditions].sort()}, diagnostics}
}
