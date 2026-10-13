import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { actionCatalog, conditionCatalog } from './OpcodeCatalog.cjs'
import { digest, indexDialogue, parseMes, parseScript, type OriginalScript } from './BinaryScript.cjs'
import { createSharedSymbolCatalog, emitSharedSymbols, type ReviewedAliases } from './SharedSymbolCatalog.cjs'
import { emitScript, GENERATOR_VERSION } from './TypeScriptGenerator.cjs'
import { analyzeScriptDependencies } from './ScriptAnalysis.cjs'

export interface ScriptArchive {names(): Promise<string[]>; read(entry: string): Promise<Uint8Array>}
export interface ImportOptions {archive: ScriptArchive; output: string; globalFlags: Uint8Array; globalVariables: Uint8Array; reviewedAliases?: ReviewedAliases}
interface ImportedFile {path: string; sha256: string}
interface ImportState {version: 1; sourceIdentity: string; files: ImportedFile[]; scripts: number; dialogues: number}
export interface ImportResult {status: 'created' | 'unchanged' | 'candidate'; output: string; sourceIdentity: string;
  scripts: number; dialogues: number; rows: number; editedFiles: string[]; diagnostics: string[]; candidate?: string}
async function optionalRead(filename: string): Promise<Buffer | null> {
  try {return await fs.readFile(filename)} catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}
function uniqueEntry(names: readonly string[], suffix: string): string {
  const matches = names.filter(name => name.toLowerCase() === suffix.toLowerCase() || name.toLowerCase().endsWith(`/${suffix.toLowerCase()}`))
  if (matches.length !== 1) throw new Error(`Expected exactly one archive entry for ${suffix}, found${matches.length}`)
  return matches[0]
}
function validateCatalog(input: Uint8Array, catalog: typeof actionCatalog, condition: boolean): void {
  const records = parseMes(input), byId = new Map(records.map(record => [record.id, record.text]))
  if (byId.size !== records.length) throw new Error('Duplicate opcode MES key')
  for (const definition of catalog) {
    if (condition && definition.code === 0 && !byId.has(0)) continue
    const text = byId.get(definition.code)
    const kinds = text === undefined ? null : [...text.matchAll(/\((num|obj)\)/g)].map(match => match[1])
    if (!kinds || kinds.length !== definition.operands.length || kinds.some((kind, index) =>
      kind !== (definition.operands[index].startsWith('number') ? 'num' : 'obj'))) {
      throw new Error(`Opcode MES signature differs from reviewed ${condition ? 'condition' : 'action'}${definition.code}/${definition.name}`)
    }
  }
  if (records.some(record => !catalog[record.id])) throw new Error('Opcode MES contains an unknown key')
}
function parseState(input: Uint8Array): ImportState {
  const value: unknown = JSON.parse(Buffer.from(input).toString('utf8'))
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1 ||
      !('sourceIdentity' in value) || typeof value.sourceIdentity !== 'string' || !('files' in value) || !Array.isArray(value.files)) {
    throw new Error('Existing import state is invalid; refusing to overwrite editable sources')
  }
  for (const file of value.files) {
    if (!file || typeof file !== 'object' || typeof file.path !== 'string' || typeof file.sha256 !== 'string' ||
      path.isAbsolute(file.path) || file.path.split(/[\\/]/).some((part: string) => part === '..' || !part)) {
      throw new Error('Existing import state contains an invalid relative path')
    }
  }
  return value as ImportState
}
export async function importGameScripts(options: ImportOptions): Promise<ImportResult> {
  const output = path.resolve(options.output), names = (await options.archive.names()).sort()
  const actionEntry = uniqueEntry(names, 'semes/action.mes'), conditionEntry = uniqueEntry(names, 'semes/condition.mes')
  const [actionMes, conditionMes] = await Promise.all([options.archive.read(actionEntry), options.archive.read(conditionEntry)])
  validateCatalog(actionMes, actionCatalog, false); validateCatalog(conditionMes, conditionCatalog, true)
  const scripts: OriginalScript[] = [], dialogues: ReturnType<typeof indexDialogue>[] = [], ids = new Set<number>()
  for (const name of names) {
    if (/\.scr$/i.test(name)) {
      const script = parseScript(await options.archive.read(name), name)
      if (ids.has(script.id)) throw new Error(`Ambiguous original script ID${script.id}`)
      ids.add(script.id); scripts.push(script)
    } else if (/\.dlg$/i.test(name)) dialogues.push(indexDialogue(await options.archive.read(name), name))
  }
  if (!scripts.length) throw new Error('Archive contains no original SCR files')
  const catalog = createSharedSymbolCatalog(parseMes(options.globalFlags), parseMes(options.globalVariables), scripts, options.reviewedAliases)
  const files = new Map<string, string>(), diagnostics = [...catalog.diagnostics]
  files.set('src/symbols/SharedSymbolCatalog.ts', emitSharedSymbols(catalog))
  const scriptIndex = scripts.map(script => {
    const generated = emitScript(script, catalog, options.reviewedAliases)
    files.set(`src/scripts/${generated.filename}`, generated.text)
    diagnostics.push(...generated.diagnostics.map(message => `${script.sourceEntry}: ${message}`))
    return {id: `arcanum:${script.id}`, originalId: script.id, sourceEntry: script.sourceEntry, sourceSha256: script.sha256,
      editableSource: `src/scripts/${generated.filename}`, originalHeader: script.header, originalFileFlags: script.fileFlags,
      entryLines: script.rows.map(row => row.line), operations: generated.operations, dependencies: analyzeScriptDependencies(script)}
  })
  const sourceIdentity = digest(JSON.stringify({generatorVersion: GENERATOR_VERSION, scripts: scripts.map(script => [script.sourceEntry, script.sha256]),
    dialogues: dialogues.map(dialogue => [dialogue.sourceEntry, dialogue.sha256]), actionMes: digest(actionMes), conditionMes: digest(conditionMes),
    flags: digest(options.globalFlags), variables: digest(options.globalVariables), reviewed: options.reviewedAliases || {}}))
  const report = {version: 1, sourceIdentity, scripts: scripts.length, dialogues: dialogues.length,
    rows: scripts.reduce((count, script) => count + script.rows.length, 0), catalog: {conditions: conditionCatalog.length, actions: actionCatalog.length},
    observed: {conditions: [...new Set(scripts.flatMap(script => script.rows.map(row => row.condition.name)))].sort(),
      actions: [...new Set(scripts.flatMap(script => script.rows.flatMap(row => [row.action.name, row.otherwise.name])))].sort()},
    runtimeSupport: 'Named SDK operations are capability-checked at execution; successful conversion does not imply gameplay support.',
    diagnostics, dialogueDiagnostics: dialogues.flatMap(dialogue => dialogue.diagnostics.map(message => `${dialogue.sourceEntry}: ${message}`))}
  files.set('script-index.json', JSON.stringify(scriptIndex, null, 2) + '\n')
  files.set('dialogue-index.json', JSON.stringify(dialogues, null, 2) + '\n')
  files.set('import-report.json', JSON.stringify(report, null, 2) + '\n')
  files.set('symbol-catalog.json', JSON.stringify(catalog, null, 2) + '\n')
  const state: ImportState = {version: 1, sourceIdentity, scripts: scripts.length, dialogues: dialogues.length,
    files: [...files].map(([name, contents]) => ({path: name, sha256: digest(contents)}))}
  const existingBytes = await optionalRead(path.join(output, 'import-state.json'))
  const existing = existingBytes ? parseState(existingBytes) : null
  const editedFiles: string[] = []
  if (existing) for (const file of existing.files) {
    const contents = await optionalRead(path.join(output, file.path))
    if (!contents || digest(contents) !== file.sha256) editedFiles.push(file.path)
  }
  const result = {output, sourceIdentity, scripts: scripts.length, dialogues: dialogues.length, rows: report.rows, editedFiles, diagnostics}
  if (existing?.sourceIdentity === sourceIdentity) return {status: 'unchanged', ...result}
  const destination = existing ? path.join(output, 'candidates', sourceIdentity) : output
  // Even a first import refuses to replace a pre-existing human-authored file.
  for (const [name, contents] of files) {
    const filename = path.join(destination, name), old = await optionalRead(filename)
    if (old && old.toString('utf8') !== contents) throw new Error(`Refusing to overwrite existing source: ${filename}`)
  }
  for (const [name, contents] of files) {
    const filename = path.join(destination, name)
    if (await optionalRead(filename)) continue
    await fs.mkdir(path.dirname(filename), {recursive: true}); await fs.writeFile(filename, contents, {flag: 'wx'})
  }
  if (existing) {
    const comparison = {version: 1, previousSourceIdentity: existing.sourceIdentity, candidateSourceIdentity: sourceIdentity, editedFiles,
      added: state.files.filter(file => !existing.files.some(old => old.path === file.path)).map(file => file.path),
      removed: existing.files.filter(file => !state.files.some(next => next.path === file.path)).map(file => file.path),
      changed: state.files.filter(file => existing.files.some(old => old.path === file.path && old.sha256 !== file.sha256)).map(file => file.path),
      instructions: 'Review candidate against editable src. Apply selected changes manually; importer never overwrites edits.'}
    const filename = path.join(destination, 'comparison.json')
    if (!await optionalRead(filename)) await fs.writeFile(filename, JSON.stringify(comparison, null, 2) + '\n', {flag: 'wx'})
  }
  const stateFilename = path.join(destination, 'import-state.json')
  if (!await optionalRead(stateFilename)) await fs.writeFile(stateFilename, JSON.stringify(state, null, 2) + '\n', {flag: 'wx'})
  return existing ? {status: 'candidate', ...result, candidate: destination} : {status: 'created', ...result}
}
