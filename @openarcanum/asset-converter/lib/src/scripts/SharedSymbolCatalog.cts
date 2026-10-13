import type { MesRecord, OriginalScript } from './BinaryScript.cjs'

export type SymbolKind = 'flags' | 'variables'
export interface SharedSymbol {id: number; alias: string; descriptions: string[]; reviewed: boolean; conflicted: boolean}
export interface ReviewedLocalAliases {numbers?: Record<string, string>; objects?: Record<string, string>}
export interface ReviewedAliases {
  flags?: Record<string, string>
  variables?: Record<string, string>
  /** Keys are stable original IDs, e.g. "arcanum:1000" (or "1000"). */
  locals?: Record<string, ReviewedLocalAliases>
}
export interface SharedSymbolCatalog {flags: SharedSymbol[]; variables: SharedSymbol[]; diagnostics: string[]}
const reserved = new Set(['__proto__', 'prototype', 'constructor'])
const localReserved = new Set(`ctx flow symbols arguments eval await break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof let new null return super switch this throw true try typeof var void while with yield implements interface package private protected public static`.split(' '))
function localNames(aliases: ReviewedLocalAliases, additionalReserved: readonly string[] = []): {numbers: string[]; objects: string[]} {
  if (!aliases || typeof aliases !== 'object' || Array.isArray(aliases) || Object.keys(aliases).some(key => !['numbers', 'objects'].includes(key))) throw new Error('Invalid reviewed local alias table')
  const result = {numbers: Array.from({length: 10}, (_, index) => `localNumber${index}`),
    objects: Array.from({length: 10}, (_, index) => `localObject${index}`)}
  for (const kind of ['numbers', 'objects'] as const) {
    const records = aliases[kind]
    if (records === undefined) continue
    if (!records || typeof records !== 'object' || Array.isArray(records)) throw new Error('Invalid reviewed local alias table')
    for (const [index, name] of Object.entries(records)) {
      if (!/^[0-9]$/.test(index) || typeof name !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(name) ||
          reserved.has(name) || localReserved.has(name) || additionalReserved.includes(name)) {
        throw new Error(`Invalid reviewed local ${kind} alias at index${index}`)
      }
      result[kind][Number(index)] = name
    }
  }
  const names = [...result.numbers, ...result.objects]
  if (new Set(names).size !== names.length) throw new Error('Duplicate reviewed local alias (including default slot names)')
  return result
}
function reviewedLocals(reviewed: ReviewedAliases): Map<number, ReviewedLocalAliases> {
  const result = new Map<number, ReviewedLocalAliases>()
  if (reviewed.locals === undefined) return result
  if (!reviewed.locals || typeof reviewed.locals !== 'object' || Array.isArray(reviewed.locals)) throw new Error('Invalid reviewed per-script local aliases')
  for (const [key, aliases] of Object.entries(reviewed.locals)) {
    const match = key.match(/^(?:arcanum:)?(0|[1-9][0-9]*)$/)
    if (!match || Number(match[1]) > 99999) throw new Error(`Invalid reviewed local script identity${key}`)
    const id = Number(match[1])
    if (result.has(id)) throw new Error(`Duplicate reviewed local script identity${id}`)
    localNames(aliases)
    result.set(id, aliases)
  }
  return result
}
export function resolveLocalAliases(scriptId: number, reviewed: ReviewedAliases = {}, additionalReserved: readonly string[] = []): {numbers: string[]; objects: string[]} {
  return localNames(reviewedLocals(reviewed).get(scriptId) || {}, additionalReserved)
}
export function identifier(text: string, fallback: string): string {
  const words = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').match(/[A-Za-z0-9]+/g) || []
  const name = words.map((word, index) => index ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word.toLowerCase()).join('')
  return /^[A-Za-z_$]/.test(name) ? name : fallback
}
function descriptionAlias(description: string, fallback: string): string {
  const text = description.replace(/^[\w .]+\s*-\s*/, '').replace(/^\s*1\s*=\s*/, '')
  return identifier(text, fallback).slice(0, 96)
}
export function createSharedSymbolCatalog(flags: readonly MesRecord[], variables: readonly MesRecord[],
    scripts: readonly OriginalScript[], reviewed: ReviewedAliases = {}): SharedSymbolCatalog {
  reviewedLocals(reviewed)
  const result: SharedSymbolCatalog = {flags: [], variables: [], diagnostics: []}
  for (const kind of ['flags', 'variables'] as const) {
    const records = kind === 'flags' ? flags : variables
    const descriptions = new Map<number, string[]>()
    for (const record of records) {
      const values = descriptions.get(record.id) || []
      if (!values.includes(record.text)) values.push(record.text)
      descriptions.set(record.id, values)
    }
    for (const script of scripts) for (const row of script.rows) for (const operation of [row.condition, row.action, row.otherwise]) {
      for (const operand of operation.operands) {
        if (operand.kind.startsWith('number') && operand.type === (kind === 'flags' ? 4 : 1) && !descriptions.has(operand.value)) descriptions.set(operand.value, [])
      }
      if (kind === 'flags' && ['globalFlag', 'setGlobalFlag', 'clearGlobalFlag'].includes(operation.name)) {
        const operand = operation.operands[0]
        if (operand?.type === 3 && !descriptions.has(operand.value)) descriptions.set(operand.value, [])
      }
    }
    const aliases = new Map<string, number>()
    for (const [id, texts] of [...descriptions].sort(([a], [b]) => a - b)) {
      const fallback = `${kind === 'flags' ? 'globalFlag' : 'globalVariable'}${id}`
      const conflicted = texts.length > 1, approved = reviewed[kind]?.[String(id)]
      if (approved !== undefined && (!/^[A-Za-z_$][\w$]*$/.test(approved) || reserved.has(approved))) throw new Error(`Invalid reviewed ${kind} alias for${id}`)
      // Conflicting developer descriptions never silently choose a meaning.
      let alias = conflicted ? fallback : approved || (texts[0] ? descriptionAlias(texts[0], fallback) : fallback)
      if (reserved.has(alias)) alias = fallback
      if (aliases.has(alias) && aliases.get(alias) !== id) alias += `Id${id}`
      if (aliases.has(alias)) throw new Error(`Duplicate ${kind} alias${alias}`)
      aliases.set(alias, id)
      result[kind].push({id, alias, descriptions: texts, reviewed: !!approved && !conflicted, conflicted})
      if (conflicted) result.diagnostics.push(`Conflicting ${kind} ID${id}: kept generic alias ${fallback}; ${texts.length} developer descriptions`)
    }
  }
  return result
}
export function emitSharedSymbols(catalog: SharedSymbolCatalog): string {
  const values = Object.fromEntries((['flags', 'variables'] as const).map(kind => [kind, Object.fromEntries(catalog[kind].map(value => [value.alias, value.id]))]))
  return '// Private original-game identifiers. Names preserve numeric identity.\n' +
    `export const symbols = ${JSON.stringify(values, null, 2)} as const\n` +
    `export const SharedSymbolCatalog = ${JSON.stringify(catalog, null, 2)} as const\n`
}
