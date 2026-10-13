import { createHash } from 'node:crypto'
import { actionCatalog, conditionCatalog, type OpcodeDefinition } from './OpcodeCatalog.cjs'

export interface ScriptOperand {kind: 'number' | 'numberTarget' | 'object' | 'objectTarget'; type: number; value: number}
export interface ScriptOperation {code: number; name: string; operands: ScriptOperand[]}
export interface ScriptRow {line: number; condition: ScriptOperation; action: ScriptOperation; otherwise: ScriptOperation}
export interface OriginalScript {
  id: number; name: string; sourceEntry: string; sha256: string
  header: {flags: number; counters: number}; fileFlags: number; description: string
  maxEntries: number; rows: ScriptRow[]
}
export const digest = (bytes: import('node:crypto').BinaryLike): string => createHash('sha256').update(bytes).digest('hex')
const decoder = new TextDecoder('windows-1252')

/** Retail SCR has no magic: 8-byte attachment defaults, 56-byte file header,
 * then 132-byte condition/true-action/false-action rows. The serialized pointer
 * and unused operand slots contain historical memory garbage, not instructions.
 * Primary: arcanum-ce script.h / script_file_load_code, commit36cd712d. */
export function parseScript(input: Uint8Array, sourceEntry: string): OriginalScript {
  const bytes = Buffer.from(input)
  const match = sourceEntry.replaceAll('\\', '/').match(/(?:^|\/)(\d{5})([^/]*)\.scr$/i)
  if (!match) throw new Error(`SCR filename has no five-digit identity: ${sourceEntry}`)
  if (bytes.length < 64) throw new Error(`Truncated SCR header: ${sourceEntry}`)
  const count = bytes.readInt32LE(52), maxEntries = bytes.readInt32LE(56)
  if (count < 0 || count > 100000 || maxEntries < count || bytes.length !== 64 + count * 132) {
    throw new Error(`Invalid SCR entry count/size: ${sourceEntry}`)
  }
  function operation(offset: number, catalog: readonly OpcodeDefinition[], line: number): ScriptOperation {
    const code = bytes.readInt32LE(offset), definition = catalog[code]
    if (!definition || definition.code !== code) throw new Error(`Unknown SCR opcode${code} at ${sourceEntry}:${line}`)
    const operands = definition.operands.map((kind, index): ScriptOperand => {
      const type = bytes[offset + 4 + index], value = bytes.readInt32LE(offset + 12 + index * 4)
      const object = kind === 'object' || kind === 'objectTarget'
      if (type > (object ? 23 : 6)) throw new Error(`Invalid consumed operand type${type} at ${sourceEntry}:${line}/${definition.name}`)
      // Only local-object selectors consume their index. Most object operand
      // value slots are uninitialized in original files and must be ignored.
      if ((object && type === 11 && (value < 0 || value > 9)) ||
          (!object && type === 2 && (value < 0 || value > 9)) ||
          (!object && type === 0 && (value < 0 || value > 3))) {
        throw new Error(`Invalid consumed local/counter index at ${sourceEntry}:${line}/${definition.name}`)
      }
      return {kind, type, value}
    })
    return {code, name: definition.name, operands}
  }
  const rows = Array.from({length: count}, (_, line): ScriptRow => ({line,
    condition: operation(64 + line * 132, conditionCatalog, line),
    action: operation(108 + line * 132, actionCatalog, line),
    otherwise: operation(152 + line * 132, actionCatalog, line)}))
  const description = decoder.decode(bytes.subarray(8, 48)).split('\0', 1)[0].replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')
  return {id: Number(match[1]), name: match[2] || `Script${match[1]}`, sourceEntry,
    sha256: digest(bytes), header: {flags: bytes.readUInt32LE(0), counters: bytes.readUInt32LE(4)},
    fileFlags: bytes.readUInt32LE(48), description, maxEntries, rows}
}

export interface MesRecord {id: number; text: string}
export function parseMes(input: Uint8Array | string): MesRecord[] {
  const text = typeof input === 'string' ? input : decoder.decode(input)
  // Comments are stripped outside braces so URLs/quoted text in values survive.
  const records: MesRecord[] = []
  const pattern = /\{(\d+)\}\s*\{([^{}]*)\}|\/\/[^\r\n]*/g
  for (const match of text.matchAll(pattern)) if (match[1] !== undefined) records.push({id: Number(match[1]), text: match[2]})
  return records
}

export interface DialogueIndex {
  sourceEntry: string; sha256: string; id: number | null; rows: number
  lineNumbers: number[]; dependencyText: {line: number; condition: string; effect: string}[]
  diagnostics: string[]
}
/** DLG remains a separate language; this indexes its conditions/effects without
 * claiming that conversion of SCR implements original conversations. */
export function indexDialogue(input: Uint8Array, sourceEntry: string): DialogueIndex {
  const text = decoder.decode(input), lineNumbers: number[] = [], dependencyText: DialogueIndex['dependencyText'] = [], diagnostics: string[] = []
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim() || line.trimStart().startsWith('//')) continue
    const fields = [...line.matchAll(/\{([^{}]*)\}/g)].map(match => match[1])
    if (fields.length !== 7 || !/^\d+$/.test(fields[0].trim())) {
      diagnostics.push(`Unparsed DLG physical line${index + 1}`); continue
    }
    const number = Number(fields[0]); lineNumbers.push(number)
    dependencyText.push({line: number, condition: fields[4], effect: fields[6]})
  }
  const match = sourceEntry.match(/(?:^|\/)(\d+)[^/]*\.dlg$/i)
  return {sourceEntry, sha256: digest(input), id: match ? Number(match[1]) : null,
    rows: lineNumbers.length, lineNumbers, dependencyText, diagnostics}
}
