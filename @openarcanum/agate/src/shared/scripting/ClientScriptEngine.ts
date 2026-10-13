import { type ClientScriptContext, type ClientScriptDefinition, type JsonObject, type ScriptPresentation } from './ScriptApi'
import { ScriptError, validateDefinition, validateJson, validateMessage } from './ScriptEngine'
import { validateBoundData } from './TypedData'

/** Presentation-only trusted modules: fresh invocation context, persistent local
 * module data, and effects published only when the entire handler succeeds. */
export default class ClientScriptEngine {
  private readonly scripts = new Map<string, ClientScriptDefinition>()
  private readonly states = new Map<string, JsonObject>()
  private disposed = false
  private readonly emit: (effect: ScriptPresentation) => void
  constructor({ scripts, emitPresentation }: { scripts: readonly ClientScriptDefinition[]; emitPresentation(effect: ScriptPresentation): void }) {
    this.emit = emitPresentation
    for (const script of scripts) {
      validateDefinition(script, 'client')
      if (this.scripts.has(script.id)) throw new ScriptError('INVALID_SCRIPT', 'Duplicate client script identity')
      this.scripts.set(script.id, script)
    }
  }
  snapshot(): Record<string, JsonObject> { return Object.fromEntries([...this.states].map(([id, data]) => [id, structuredClone(data)])) }
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.states.clear()
    this.scripts.clear()
  }
  private assertAlive(): void {
    if (this.disposed) throw new ScriptError('SCRIPT_DISPOSED', 'Client script session has been disposed')
  }
  run(scriptId: string, entryLine = 0, event: JsonObject = {}): void {
    this.assertAlive()
    const script = this.scripts.get(scriptId)
    if (!script) throw new ScriptError('SCRIPT_NOT_FOUND', `Client script ${scriptId} is unavailable`)
    validateJson(event)
    const effects: ScriptPresentation[] = []
    const data = structuredClone(this.states.get(scriptId) ?? script.dataSchema?.defaults ?? {})
    const source = { scriptId, line: entryLine, operation: undefined as string | undefined, opcode: undefined as number | undefined }
    const context: ClientScriptContext = { realm: 'client', source, data, event: structuredClone(event),
      at: (line, operation, opcode) => { if (!Number.isSafeInteger(line) || line < 0) throw new ScriptError('INVALID_ENTRY', 'Invalid source line'); source.line = line; source.operation = operation; source.opcode = opcode },
      ui: { message: (text, targetId) => {
        validateMessage(text, targetId)
        if (effects.length >= 1000) throw new ScriptError('INVALID_EFFECT', 'Too many client messages')
        effects.push({ type: 'message', text, ...(targetId === undefined ? {} : { targetId }) })
      } },
    }
    let line = entryLine
    try {
      for (let steps = 0; ; steps++) {
        if (steps >= 1000) throw new ScriptError('SCRIPT_BUDGET', 'Client instruction budget exceeded')
        const handler = script.entryPoints[line]
        if (!handler) throw new ScriptError('INVALID_ENTRY', 'Client script entry is unavailable')
        context.at(line)
        const result = handler(context)
        if (result === undefined || result.kind === 'next') { if (!Object.hasOwn(script.entryPoints, line + 1)) break; line++; continue }
        if (result.kind === 'skip-default' || result.kind === 'run-default') break
        if (result.kind === 'jump-line') { line = result.line; continue }
        if (result.kind === 'jump') {
          const target = Object.entries(script.entryPoints).find(([, fn]) => fn === result.handler)
          if (!target) throw new ScriptError('INVALID_ENTRY', 'Client jump is outside this script')
          line = Number(target[0]); continue
        }
        throw new ScriptError('INVALID_FLOW', 'Invalid client flow')
      }
      validateJson(data)
      this.assertAlive()
      validateBoundData(data)
      if (script.dataSchema && !script.dataSchema.validate(data)) throw new ScriptError('INVALID_SCHEMA', 'Client script data does not match its schema')
      this.states.set(scriptId, structuredClone(data))
      for (const effect of effects) this.emit(effect)
    } catch (error) { throw error instanceof ScriptError && error.source ? error : new ScriptError(error instanceof ScriptError ? error.code : 'SCRIPT_FAILED', error instanceof Error ? error.message : String(error), { ...source }) }
  }
}
