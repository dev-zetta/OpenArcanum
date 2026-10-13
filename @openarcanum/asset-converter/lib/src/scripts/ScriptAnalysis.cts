import type {OriginalScript, ScriptOperation} from './BinaryScript.cjs'

export interface ScriptDependency {line: number; branch: 'then' | 'else'; kind: 'script' | 'dialogue' | 'map' | 'prototype' | 'sound';
  operation: string; target: number | null; dynamic: boolean}
export function analyzeScriptDependencies(script: OriginalScript): ScriptDependency[] {
  const result: ScriptDependency[] = []
  function action(operation: ScriptOperation, line: number, branch: 'then' | 'else') {
    let kind: ScriptDependency['kind'] | undefined, index = 0
    if (['callScript', 'callScriptIn', 'callScriptAt', 'changeThisScriptToScript'].includes(operation.name)) kind = 'script'
    else if (operation.name === 'changeScript') {kind = 'script'; index = 2}
    else if (['dialog', 'floatLine', 'printLine'].includes(operation.name)) {
      result.push({line, branch, kind: 'dialogue', operation: operation.name, target: script.id, dynamic: false}); return
    } else if (operation.name === 'teleport') {kind = 'map'; index = 1}
    else if (['createObject', 'createItem', 'transformAttacheeIntoBasicPrototype'].includes(operation.name)) kind = 'prototype'
    else if (['playSound', 'playSoundOn'].includes(operation.name)) kind = 'sound'
    if (!kind) return
    const value = operation.operands[index], dynamic = !value || value.type !== 3
    result.push({line, branch, kind, operation: operation.name, target: dynamic ? null : value.value, dynamic})
  }
  for (const row of script.rows) {
    action(row.action, row.line, 'then')
    if (row.condition.name !== 'true') action(row.otherwise, row.line, 'else')
  }
  return result
}
