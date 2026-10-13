import { actionNames, conditionNames, type ActionName, type ConditionName } from './OperationCatalog'
import { validateBoundData } from './TypedData'
import { API_VERSION, type AttachmentContext, type DataSchema, type InvocationTargets, type JsonObject,
  type JsonValue, type NumberReference, type ObjectReference, type ObjectSelection, type PreparedHostWrites,
  type ScriptDefinition, type ScriptFlow, type ScriptHost, type ScriptInvocation, type ScriptObject,
  type ScriptObjectWrite, type ScriptOperand, type ScriptPresentation, type ScriptResolver,
  type ScriptSymbols, type ServerGameApi, type ServerHandler, type ServerScriptContext,
  type SourceLocation, type StateNamespace } from './ScriptApi'

export class ScriptError extends Error {
  constructor(readonly code: string, message: string, readonly source?: Readonly<SourceLocation>) {
    super(`${message}${source ? ` (${source.scriptId}:${source.line}${source.operation ? ` ${source.operation}` : ''})` : ''}`)
    this.name = 'ScriptError'
  }
}
export interface ScriptDataState { version: number; value: JsonObject }
export interface NamespaceState { variables: Record<string, number>; flags: Record<string, number>; data: Record<string, ScriptDataState> }
export interface AttachmentState { scriptId: string; flags: number; counters: number[]; data: JsonObject }
export interface ScheduledScriptCall { id: string; dueMs: number; invocation: ScriptInvocation }
export interface ScriptSnapshot {
  version: 1
  contentIdentity: string
  clockMs: number
  rng: number
  nextCall: number
  shared: NamespaceState
  players: Record<string, NamespaceState>
  attachments: Record<string, AttachmentState>
  data: Record<string, ScriptDataState>
  off: Record<string, boolean>
  scheduled: ScheduledScriptCall[]
}
export interface PreparedScriptTransaction {
  readonly runDefault: boolean
  readonly candidate: Readonly<ScriptSnapshot>
  readonly objectWrites: readonly ScriptObjectWrite[]
  commit(): void
  rollback(): void
  flushEffects(): void
}
export interface ScriptEngineOptions {
  host: ScriptHost
  resolver: ScriptResolver
  symbols?: ScriptSymbols
  playerSymbols?: ScriptSymbols
  seed?: number
  maxSteps?: number
  maxCallDepth?: number
  /** Trusted world bootstrap only; there is no client command for this. */
  initialFlags?: Readonly<Record<string, Readonly<Record<number, 0 | 1>>>>
}
interface Execution { candidate: ScriptSnapshot; effects: ScriptPresentation[]; steps: number; depth: number; source: SourceLocation }
const own = (value: object, key: PropertyKey): boolean => Object.hasOwn(value, key)
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const unsafeKey = (key: string): boolean => ['__proto__', 'constructor', 'prototype'].includes(key)
const namespace = (): NamespaceState => ({ variables: {}, flags: {}, data: {} })
const key = (value: string): string => {
  if (typeof value !== 'string' || !value || value.length > 1024 || unsafeKey(value) || /[\u0000-\u001f]/.test(value)) throw new ScriptError('INVALID_STATE', 'Invalid state identity')
  return value
}
const integer = (value: number, min = 0, max = Number.MAX_SAFE_INTEGER): number => {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new ScriptError('INVALID_STATE', 'Invalid integer')
  return value
}
const int32 = (value: number): number => { integer(value, Number.MIN_SAFE_INTEGER); return value | 0 }
const slot = (value: number, maximum: number): number => integer(value, 0, maximum)
export function validateMessage(text: unknown, targetId?: unknown): asserts text is string {
  if (typeof text !== 'string' || !text.trim() || text.length > 4096 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text) ||
    (targetId !== undefined && (typeof targetId !== 'string' || !targetId || targetId.length > 1024))) throw new ScriptError('INVALID_EFFECT', 'Invalid script message')
}

/** JSON state is deliberately bounded, acyclic and free of accessors/prototypes. */
export function validateJson(value: unknown): asserts value is JsonValue {
  let nodes = 0
  const seen = new Set<object>()
  const visit = (item: unknown, depth: number): void => {
    if (++nodes > 20000 || depth > 32) throw new ScriptError('INVALID_STATE', 'Custom data exceeds its limits')
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return
    if (typeof item === 'number' && Number.isFinite(item)) return
    if (!item || typeof item !== 'object' || seen.has(item)) throw new ScriptError('INVALID_STATE', 'Custom data must be finite acyclic JSON')
    if (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) throw new ScriptError('INVALID_STATE', 'Custom data must use plain JSON objects')
    seen.add(item)
    if (Array.isArray(item)) {
      for (let i = 0; i < item.length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(item, i)
        if (!descriptor || !('value' in descriptor)) throw new ScriptError('INVALID_STATE', 'Sparse arrays/accessors are not JSON state')
        visit(descriptor.value, depth + 1)
      }
    } else {
      for (const name of Object.keys(item)) {
        if (unsafeKey(name)) throw new ScriptError('INVALID_STATE', 'Unsafe custom data key')
        const descriptor = Object.getOwnPropertyDescriptor(item, name)
        if (!descriptor || !('value' in descriptor)) throw new ScriptError('INVALID_STATE', 'Custom data accessors are not supported')
        visit(descriptor.value, depth + 1)
      }
    }
    seen.delete(item)
  }
  visit(value, 0)
  if (JSON.stringify(value).length > 1024 * 1024) throw new ScriptError('INVALID_STATE', 'Custom data exceeds its byte limit')
}
export function validateDefinition(definition: ScriptDefinition, realm: 'server' | 'client'): void {
  if (!record(definition) || definition.realm !== realm || (definition.apiVersion ?? API_VERSION) !== API_VERSION ||
      typeof definition.id !== 'string' || !/^[a-z][a-z0-9_-]*:[a-zA-Z0-9_.-]+$/.test(definition.id) ||
      typeof definition.name !== 'string' || !definition.name || !record(definition.entryPoints) || !Object.keys(definition.entryPoints).length) throw new ScriptError('INVALID_SCRIPT', 'Invalid script definition or realm/API mismatch')
  for (const [line, handler] of Object.entries(definition.entryPoints)) {
    if (!/^(0|[1-9][0-9]*)$/.test(line) || !Number.isSafeInteger(Number(line)) || Number(line) > 1000000 || typeof handler !== 'function') throw new ScriptError('INVALID_SCRIPT', 'Invalid script entry point')
  }
  if (definition.template) {
    integer(definition.template.flags, 0, 0xffffffff)
    if (!Array.isArray(definition.template.counters) || definition.template.counters.length !== 4) throw new ScriptError('INVALID_SCRIPT', 'Invalid default script counters')
    definition.template.counters.forEach(value => integer(value, 0, 255))
  }
  if (definition.scriptFlags !== undefined) integer(definition.scriptFlags, 0, 0xffffffff)
  for (const schema of [definition.dataSchema, definition.sharedSchema, definition.playerSchema, definition.attachmentSchema]) {
    if (schema) {
      integer(schema.version, 1)
      validateJson(schema.defaults)
      if (!record(schema.defaults) || typeof schema.validate !== 'function' || !schema.validate(structuredClone(schema.defaults))) throw new ScriptError('INVALID_SCHEMA', 'Invalid script data schema/defaults')
    }
  }
}

/** One engine per authority world. Trusted modules receive transactional context;
 * this is an API boundary, not a JavaScript sandbox. */
export default class ScriptEngine {
  private state: ScriptSnapshot
  private revision = 0
  private disposed = false
  private readonly baselineOff = new Map<string, boolean>()
  private readonly schemas = new Map<string, DataSchema>()
  readonly host: ScriptHost
  readonly resolver: ScriptResolver
  private readonly symbols: ScriptSymbols
  private readonly playerSymbols: ScriptSymbols
  private readonly maxSteps: number
  private readonly maxCallDepth: number
  constructor(options: ScriptEngineOptions) {
    this.host = options.host; this.resolver = options.resolver
    this.symbols = options.symbols || {}; this.playerSymbols = options.playerSymbols || {}
    this.maxSteps = integer(options.maxSteps ?? 1000, 1, 100000)
    this.maxCallDepth = integer(options.maxCallDepth ?? 32, 1, 128)
    this.state = { version: 1, contentIdentity: options.resolver.contentIdentity, clockMs: 0,
      rng: integer(options.seed ?? 0x6d2b79f5, 1, 0xffffffff), nextCall: 1,
      shared: namespace(), players: {}, attachments: {}, data: {}, off: {}, scheduled: [] }
    for (const [moduleId, flags] of Object.entries(options.initialFlags ?? {})) {
      if (!/^[a-z][a-z0-9_-]*$/.test(moduleId)) throw new ScriptError('INVALID_STATE', 'Invalid module identity')
      for (const [id, value] of Object.entries(flags)) this.state.shared.flags[`${moduleId}:${slot(Number(id), 65535)}`] = integer(value, 0, 1)
    }
  }
  snapshot(): ScriptSnapshot { return structuredClone(this.state) }
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.revision++
    this.state = { version: 1, contentIdentity: this.state.contentIdentity, clockMs: 0,
      rng: 1, nextCall: 1, shared: namespace(), players: {}, attachments: {}, data: {}, off: {}, scheduled: [] }
    this.baselineOff.clear()
    this.schemas.clear()
    this.resolver.dispose?.()
  }
  private assertAlive(): void {
    if (this.disposed) throw new ScriptError('SCRIPT_DISPOSED', 'Script world has been disposed')
  }
  objects(): ReadonlyMap<string, boolean> { return new Map(Object.entries(this.state.off)) }
  binding(id: string): Readonly<AttachmentState> | undefined { const state = this.state.attachments[key(id)]; return state && structuredClone(state) }
  peekBinding(id: string): Readonly<AttachmentState> | undefined { return this.binding(id) }
  registerAttachment(id: string, binding: { scriptId: string; flags?: number; counters?: readonly number[]; data?: JsonObject }): void {
    this.assertAlive()
    key(id)
    if (own(this.state.attachments, id)) throw new ScriptError('INVALID_STATE', 'Attachment identity already exists')
    const definition = this.definition(binding.scriptId)
    const data = structuredClone(binding.data ?? definition.attachmentSchema?.defaults ?? {})
    this.validateData(data, definition.attachmentSchema)
    const counters = [...(binding.counters ?? definition.template?.counters ?? [0, 0, 0, 0])]
    if (counters.length !== 4) throw new ScriptError('INVALID_STATE', 'Attachments have four counters')
    counters.forEach(value => integer(value, 0, 255))
    this.state.attachments[id] = { scriptId: binding.scriptId, flags: integer(binding.flags ?? definition.template?.flags ?? 0, 0, 0xffffffff), counters, data }
    this.revision++
  }
  private definition(id: string) {
    const definition = this.resolver.resolve(key(id), 'server')
    if (!definition) throw new ScriptError('SCRIPT_NOT_FOUND', `Script ${id} is unavailable`)
    validateDefinition(definition, 'server')
    if (definition.realm !== 'server') throw new ScriptError('WRONG_REALM', 'Server cannot execute a client script')
    const moduleId = id.split(':')[0]
    for (const [scope, schema] of [['shared', definition.sharedSchema], ['player', definition.playerSchema]] as const) {
      if (!schema) continue
      const schemaKey = `${scope}:${moduleId}`, previous = this.schemas.get(schemaKey)
      if (previous && (previous.version !== schema.version || JSON.stringify(previous.defaults) !== JSON.stringify(schema.defaults))) throw new ScriptError('INVALID_SCHEMA', 'Module scripts declare conflicting shared data schemas')
      this.schemas.set(schemaKey, schema)
    }
    return definition
  }
  private validateData(data: unknown, schema?: DataSchema, version?: number): asserts data is JsonObject {
    validateJson(data)
    if (!record(data) || (!schema && version !== undefined && version !== 1) || (schema && ((version !== undefined && schema.version !== version) || !schema.validate(data)))) throw new ScriptError('INVALID_SCHEMA', 'Script custom data does not match its schema')
    validateBoundData(data as JsonObject)
  }
  private data(store: Record<string, ScriptDataState>, id: string, schema?: DataSchema): JsonObject {
    if (!own(store, id)) store[id] = { version: schema?.version ?? 1, value: structuredClone(schema?.defaults ?? {}) }
    this.validateData(store[id].value, schema, store[id].version)
    return store[id].value
  }
  private reference(get: () => number, set: (value: number) => void): NumberReference {
    return { kind: 'number-reference', get value() { return get() }, set value(value: number) { set(value) } }
  }
  private stateNamespace(state: NamespaceState, moduleId: string, symbols: ScriptSymbols, scope: 'shared' | 'player'): StateNamespace {
    const reference = (flag: boolean, id: number): NumberReference => {
      slot(id, 65535); const values = flag ? state.flags : state.variables
      const stateId = `${moduleId}:${id}`
      return this.reference(() => values[stateId] ?? 0, value => { values[stateId] = flag ? integer(value, 0, 1) : int32(value) })
    }
    const aliases = (flag: boolean, names: Readonly<Record<string, number>> = {}): Record<string, number> => {
      const result: Record<string, number> = {}
      for (const [name, id] of Object.entries(names)) {
        key(name); slot(id, 65535)
        const cell = reference(flag, id)
        Object.defineProperty(result, name, { enumerable: true, get: () => cell.value, set: (value: number) => { cell.value = value } })
      }
      return Object.preventExtensions(result)
    }
    return { data: this.data(state.data, moduleId, this.schemas.get(`${scope}:${moduleId}`)),
      variable: id => reference(false, id), flag: id => reference(true, id),
      variables: aliases(false, symbols.variables), flags: aliases(true, symbols.flags) }
  }
  private object(id?: string | null): ScriptObject | null {
    if (id === undefined || id === null) return null
    const object = this.host.getObject(key(id))
    if (!object || object.id !== id) throw new ScriptError('OBJECT_NOT_FOUND', `Script target ${id} is unavailable`)
    const copy = { ...object, ...(object.location ? { location: Object.freeze([...object.location]) as readonly [number, number] } : {}) }
    return Object.freeze(copy)
  }
  private invocation(raw: unknown): ScriptInvocation {
    if (!record(raw) || typeof raw.scriptId !== 'string' ||
      Object.keys(raw).some(name => !['scriptId', 'entryLine', 'attachmentId', 'attachmentPoint', 'triggererId', 'attacheeId', 'extraId', 'playerId'].includes(name)) ||
      [raw.triggererId, raw.attacheeId, raw.extraId, raw.playerId].some(value => value !== undefined && value !== null && typeof value !== 'string') ||
      (raw.attachmentId !== undefined && typeof raw.attachmentId !== 'string')) throw new ScriptError('INVALID_INVOCATION', 'Expected a script invocation')
    const invocation = raw as unknown as ScriptInvocation
    this.definition(invocation.scriptId); integer(invocation.entryLine ?? 0, 0, 1000000)
    if (invocation.attachmentId !== undefined) key(invocation.attachmentId)
    if (invocation.attachmentPoint !== undefined) integer(invocation.attachmentPoint, 0, 35)
    for (const id of [invocation.triggererId, invocation.attacheeId, invocation.extraId, invocation.playerId]) this.object(id)
    return Object.fromEntries(Object.entries(invocation).filter(([, value]) => value !== undefined)) as unknown as ScriptInvocation
  }
  prepare(invocation: ScriptInvocation): PreparedScriptTransaction {
    this.assertAlive()
    const execution: Execution = { candidate: this.snapshot(), effects: [], steps: 0, depth: 0, source: { scriptId: invocation.scriptId, line: invocation.entryLine ?? 0 } }
    try {
      const runDefault = this.execute(this.invocation(invocation), execution)
      this.validateSnapshot(execution.candidate)
      return this.transaction(execution.candidate, execution.effects, runDefault)
    } catch (error) { throw this.diagnostic(error, execution.source) }
  }
  private diagnostic(error: unknown, source: SourceLocation): ScriptError {
    return error instanceof ScriptError && error.source ? error : new ScriptError(error instanceof ScriptError ? error.code : 'SCRIPT_FAILED', error instanceof Error ? error.message : String(error), { ...source })
  }
  private execute(invocation: ScriptInvocation, execution: Execution): boolean {
    if (++execution.depth > this.maxCallDepth) throw new ScriptError('SCRIPT_BUDGET', 'Script call depth exceeded')
    const definition = this.definition(invocation.scriptId), candidate = execution.candidate
    const moduleId = definition.id.split(':')[0]
    const attachment = invocation.attachmentId ? candidate.attachments[invocation.attachmentId] : undefined
    if (invocation.attachmentId && (!attachment || attachment.scriptId !== definition.id)) throw new ScriptError('INVALID_ATTACHMENT', 'Script binding changed or is missing')
    // Direct calls have independent template state and scratch slots. Attached
    // invocations borrow the persistent attachment's header and custom data.
    const binding: AttachmentState = attachment ?? { scriptId: definition.id, flags: definition.template?.flags ?? 0, counters: [...(definition.template?.counters ?? [0, 0, 0, 0])], data: structuredClone(definition.attachmentSchema?.defaults ?? {}) }
    let replacement: string | undefined
    const finish = (runDefault: boolean, applyAutoRemoval = true): boolean => {
      if (applyAutoRemoval && ((definition.scriptFlags ?? 0) & 4) !== 0) binding.scriptId = ''
      if (replacement !== undefined) binding.scriptId = replacement
      return runDefault
    }
    const numbers = Array.from({ length: 10 }, () => 0), objects: (ScriptObject | null)[] = Array.from({ length: 10 }, () => null)
    const numberRefs = numbers.map((_, i) => this.reference(() => numbers[i], value => { numbers[i] = int32(value) }))
    const objectRefs: ObjectReference[] = objects.map((_, i) => ({ kind: 'object-reference', get value() { return objects[i] }, set value(value: ScriptObject | null) { objects[i] = value } }))
    const source: SourceLocation = { scriptId: definition.id, line: invocation.entryLine ?? 0 }
    const currentTargets = (): InvocationTargets => ({ triggererId: invocation.triggererId, attacheeId: invocation.attacheeId, extraId: invocation.extraId, playerId: invocation.playerId })
    const playerState = (id?: string | null): StateNamespace => {
      if (!id) throw new ScriptError('PLAYER_REQUIRED', 'Script requires an explicit player object')
      if (this.object(id)?.type !== 'Pc') throw new ScriptError('PLAYER_REQUIRED', 'PC variables require a PC object')
      if (!own(candidate.players, id)) candidate.players[id] = namespace()
      return this.stateNamespace(candidate.players[id], moduleId, this.playerSymbols, 'player')
    }
    const select = (selector: number, localIndex = 0): ObjectSelection => {
      slot(selector, 23)
      let values: readonly ScriptObject[]
      if (selector === 0) values = context.triggerer ? [context.triggerer] : []
      else if (selector === 1) values = context.attachee ? [context.attachee] : []
      else if (selector === 11) values = objects[slot(localIndex, 9)] ? [objects[localIndex]!] : []
      else if (selector === 12) values = context.extra ? [context.extra] : []
      else if (selector === 21) values = context.playerObject ? [context.playerObject] : []
      else {
        if (!this.host.select) throw new ScriptError('UNSUPPORTED_SELECTOR', `Object selector ${selector} is unavailable`)
        values = this.host.select(selector, invocation).map(object => this.object(object.id)!)
      }
      return Object.freeze({ kind: 'selection', selector, objects: Object.freeze([...values]), any: [3, 5, 7, 9, 14, 16, 18, 20, 23].includes(selector) })
    }
    const number = (value: ScriptOperand | undefined): number => {
      if (typeof value === 'number') return int32(value)
      if (value && typeof value === 'object' && 'kind' in value && value.kind === 'number-reference') return int32(value.value)
      throw new ScriptError('INVALID_OPERAND', 'Expected a numeric operand')
    }
    const singleObject = (value: ScriptOperand | undefined): ScriptObject | null => {
      if (value === null) return null
      if (value && typeof value === 'object') {
        if ('id' in value) return this.object(value.id)
        if ('kind' in value && value.kind === 'object-reference') return value.value && this.object(value.value.id)
        if ('kind' in value && value.kind === 'selection') {
          if (value.objects.length > 1) throw new ScriptError('INVALID_OPERAND', 'Expected one object, not a quantified set')
          return value.objects[0] ?? null
        }
      }
      throw new ScriptError('INVALID_OPERAND', 'Expected an object operand')
    }
    const objectSet = (value: ScriptOperand | undefined): readonly ScriptObject[] => value && typeof value === 'object' && 'kind' in value && value.kind === 'selection' ? value.objects : [singleObject(value)].filter((object): object is ScriptObject => object !== null)
    const requireObject = (value: ScriptOperand | undefined): ScriptObject => { const object = singleObject(value); if (!object) throw new ScriptError('OBJECT_REQUIRED', 'Expected a present object'); return object }
    const write = (target: ScriptOperand | undefined, value: number): void => {
      if (!target || typeof target !== 'object' || !('kind' in target) || target.kind !== 'number-reference') throw new ScriptError('INVALID_OPERAND', 'Numeric destination is not writable')
      target.value = value
    }
    const targets = (overrides?: InvocationTargets): InvocationTargets => ({ ...currentTargets(), ...overrides })
    const off = (object: ScriptObject): boolean => own(candidate.off, object.id) ? candidate.off[object.id] : this.host.isOff(object.id)
    const toggleOff = (object: ScriptObject, value?: boolean): void => {
      const resolved = requireObject(object)
      if (value !== undefined && typeof value !== 'boolean') throw new ScriptError('INVALID_OPERAND', 'Off state must be boolean')
      const next = value ?? !off(resolved)
      // Capability checks apply to the requested target even for equal-valued
      // writes. Preparing is side-effect free; the real transaction applies the
      // eventual changed writes only after the entire script succeeds.
      this.host.prepareObjectWrites([{ targetId: resolved.id, off: next }])
      if (!this.baselineOff.has(resolved.id)) this.baselineOff.set(resolved.id, this.host.isOff(resolved.id))
      candidate.off[resolved.id] = next
    }
    const schedule = (scriptId: string, delaySeconds: number, entryLine = 0, overrides?: InvocationTargets, attachmentPoint = invocation.attachmentPoint): string => {
      if (!Number.isFinite(delaySeconds) || delaySeconds < 0 || delaySeconds > 315360000) throw new ScriptError('INVALID_TIMER', 'Invalid script delay')
      if (candidate.scheduled.length >= 4096) throw new ScriptError('SCRIPT_BUDGET', 'Too many scheduled calls')
      const call = this.invocation({ scriptId, entryLine, attachmentPoint, ...targets(overrides) })
      const dueMs = candidate.clockMs + Math.round(delaySeconds * 1000)
      integer(dueMs)
      const id = `call:${candidate.nextCall++}`
      candidate.scheduled.push({ id, dueMs, invocation: call }); return id
    }
    const game: ServerGameApi = {
      actions: {} as ServerGameApi['actions'], conditions: {} as ServerGameApi['conditions'],
      toggleOff, isOff: object => off(requireObject(object)),
      isNamed: (object, nameId) => { if (!this.host.isNamed) throw new ScriptError('UNSUPPORTED_OPERATION', 'Object names are unavailable'); return this.host.isNamed(requireObject(object).id, integer(nameId)) },
      select, call: (scriptId, entryLine = 0, overrides) => { this.execute(this.invocation({ scriptId, entryLine, attachmentPoint: invocation.attachmentPoint, ...targets(overrides) }), execution) },
      schedule, cancelScheduled: id => { candidate.scheduled = candidate.scheduled.filter(call => call.id !== id) },
      random: (min, max) => {
        integer(min, -2147483648, 2147483647); integer(max, min, 2147483647)
        let value = candidate.rng; value ^= value << 13; value ^= value >>> 17; value ^= value << 5; candidate.rng = value >>> 0
        return min + Math.floor((candidate.rng / 0x100000000) * (max - min + 1))
      },
    }
    const attachmentContext: AttachmentContext = {
      id: invocation.attachmentId ?? '', data: binding.data,
      flag: id => { slot(id, 31); return this.reference(() => (binding.flags >>> id) & 1, value => { integer(value, 0, 1); binding.flags = ((binding.flags & ~(1 << id)) | (value << id)) >>> 0 }) },
      counter: id => { slot(id, 3); return this.reference(() => binding.counters[id], value => { binding.counters[id] = int32(value) & 0xff }) },
      remove: () => { replacement = '' }, replace: id => { this.definition(id); replacement = id },
    }
    const context: ServerScriptContext = {
      realm: 'server', source,
      shared: this.stateNamespace(candidate.shared, moduleId, this.symbols, 'shared'),
      get player() { return playerState(invocation.playerId) },
      attachment: attachmentContext, data: this.data(candidate.data, definition.id, definition.dataSchema),
      triggerer: this.object(invocation.triggererId), attachee: this.object(invocation.attacheeId), extra: this.object(invocation.extraId), playerObject: this.object(invocation.playerId),
      locals: { numbers: numberRefs, objects: objectRefs }, localNumber: index => numberRefs[slot(index, 9)], localObject: index => objectRefs[slot(index, 9)],
      playerState: selector => { const values = select(selector); if (values.objects.length !== 1) throw new ScriptError('PLAYER_REQUIRED', 'PC state requires exactly one selected object'); return playerState(values.objects[0].id) },
      number: value => number(value), object: value => singleObject(value), game,
      ui: { message: (text, targetId = invocation.playerId ?? undefined) => {
        validateMessage(text, targetId)
        if (execution.effects.length >= 1000) throw new ScriptError('INVALID_EFFECT', 'Too many script messages')
        if (targetId !== undefined) this.object(targetId)
        execution.effects.push({ type: 'message', text, ...(targetId ? { targetId } : {}) })
      } },
      at: (line, operation, opcode) => { integer(line, 0, 1000000); if (opcode !== undefined) integer(opcode); source.line = line; source.operation = operation; source.opcode = opcode; execution.source = { ...source } },
    }
    const unsupported = (name: string): never => { context.at(source.line, name, source.opcode); throw new ScriptError('UNSUPPORTED_OPERATION', `Script operation ${name} is not implemented`, { ...source }) }
    const actions = game.actions as Record<ActionName, (...args: ScriptOperand[]) => void>
    for (const name of actionNames) actions[name] = (...args) => {
      context.at(source.line, name, actionNames.indexOf(name))
      switch (name) {
        case 'doNothing': return
        case 'removeThisScript': return attachmentContext.remove()
        case 'changeThisScriptToScript': return attachmentContext.replace(`${moduleId}:${number(args[0])}`)
        case 'setLocalFlag': attachmentContext.flag(number(args[0])).value = 1; return
        case 'clearLocalFlag': attachmentContext.flag(number(args[0])).value = 0; return
        case 'setGlobalFlag': context.shared.flag(number(args[0])).value = 1; return
        case 'clearGlobalFlag': context.shared.flag(number(args[0])).value = 0; return
        case 'assignNum': write(args[0], number(args[1])); return
        case 'add': write(args[0], (number(args[1]) + number(args[2])) | 0); return
        case 'subtract': write(args[0], (number(args[1]) - number(args[2])) | 0); return
        case 'multiply': write(args[0], Math.imul(number(args[1]), number(args[2]))); return
        case 'divide': {
          const dividend = number(args[1]), divisor = number(args[2])
          // Original 004474F6 skips the destination write for a zero divisor;
          // 00447500/00447501 use CDQ + IDIV, not CE's mistaken addition.
          if (divisor === 0) return
          if (dividend === -2147483648 && divisor === -1) throw new ScriptError('ARITHMETIC_OVERFLOW', 'Signed division exceeds the 32-bit integer range')
          write(args[0], Math.trunc(dividend / divisor)); return
        }
        case 'assignObj': {
          const ref = args[0]
          if (!ref || typeof ref !== 'object' || !('kind' in ref) || ref.kind !== 'object-reference') throw new ScriptError('INVALID_OPERAND', 'Object destination is not writable')
          ref.value = singleObject(args[1]); return
        }
        case 'toggleState': for (const object of objectSet(args[0])) toggleOff(object); return
        case 'random': write(args[2], game.random(number(args[0]), number(args[1]))); return
        case 'callScript': {
          for (const triggerer of objectSet(args[2])) for (const attachee of objectSet(args[3])) game.call(`${moduleId}:${number(args[0])}`, number(args[1]), { triggererId: triggerer.id, attacheeId: attachee.id, extraId: null })
          return
        }
        // Original timeevent callbacks use SAP_USE and no extra object, even
        // when queued from a Heartbeat. Authored schedule() retains its caller.
        case 'callScriptIn': schedule(`${moduleId}:${number(args[0])}`, number(args[4]) * 8, number(args[1]), { triggererId: singleObject(args[2])?.id ?? null, attacheeId: singleObject(args[3])?.id ?? null, extraId: null }, 1); return
        default: return unsupported(name)
      }
    }
    const conditions = game.conditions as Record<ConditionName, (...args: ScriptOperand[]) => boolean>
    for (const name of conditionNames) conditions[name] = (...args) => {
      context.at(source.line, name, conditionNames.indexOf(name))
      switch (name) {
        case 'true': return true
        case 'eq': return number(args[0]) === number(args[1])
        case 'le': return number(args[0]) <= number(args[1])
        case 'localFlag': return attachmentContext.flag(number(args[0])).value === 1
        case 'globalFlag': return context.shared.flag(number(args[0])).value === 1
        case 'objIsSwitchedOff':
        case 'objIsNamed': {
          const set = objectSet(args[0]), count = set.filter(object => name === 'objIsSwitchedOff' ? off(object) : game.isNamed(object, number(args[1]))).length
          const any = args[0] && typeof args[0] === 'object' && 'kind' in args[0] && args[0].kind === 'selection' && args[0].any
          return count > 0 && (any || count === set.length)
        }
        default: return unsupported(name)
      }
    }
    try {
      let line = invocation.entryLine ?? 0
      while (true) {
        if (++execution.steps > this.maxSteps) throw new ScriptError('SCRIPT_BUDGET', 'Script instruction budget exceeded')
        const handler: ServerHandler | undefined = definition.entryPoints[line]
        if (!handler) return false
        context.at(line)
        const result = handler(context)
        if (result === undefined || result.kind === 'next') {
          if (!own(definition.entryPoints, line + 1)) return finish(false)
          line++; continue
        }
        if (result.kind === 'run-default') return finish(true)
        if (result.kind === 'skip-default') return finish(false)
        if (result.kind === 'jump-line') {
          if (result.line === -1) { if (!own(definition.entryPoints, line + 1)) return finish(false); line++; continue }
          if (result.line === -2) return finish(false)
          if (result.line === -3) return finish(true)
          // Original 00444BD9 branches -4 straight to run-default, bypassing
          // the normal SF_AUTO_REMOVING branch at00444BEB.
          if (result.line === -4) return finish(true, false)
          if (!Number.isSafeInteger(result.line) || result.line < 0 || result.line > 1000000) return false
          line = result.line; continue
        }
        if (result.kind === 'jump') {
          const entry = Object.entries(definition.entryPoints).find(([, fn]) => fn === result.handler)
          if (!entry) throw new ScriptError('INVALID_ENTRY', 'Jump handler is outside this script')
          line = Number(entry[0]); continue
        }
        throw new ScriptError('INVALID_FLOW', 'Script returned an invalid control flow value')
      }
    } catch (error) { throw this.diagnostic(error, source) }
    finally { execution.depth-- }
  }
  prepareAdvance(elapsedMs: number): PreparedScriptTransaction {
    this.assertAlive()
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new ScriptError('INVALID_CLOCK', 'Invalid elapsed game time')
    const execution: Execution = { candidate: this.snapshot(), effects: [], steps: 0, depth: 0, source: { scriptId: 'engine:clock', line: 0 } }
    execution.candidate.clockMs += Math.round(Math.min(elapsedMs, 250) * 8)
    let calls = 0
    while (true) {
      execution.candidate.scheduled.sort((a, b) => a.dueMs - b.dueMs || Number(a.id.slice(5)) - Number(b.id.slice(5)))
      const call = execution.candidate.scheduled[0]
      if (!call || call.dueMs > execution.candidate.clockMs) break
      if (++calls > this.maxSteps) throw new ScriptError('SCRIPT_BUDGET', 'Scheduled call budget exceeded')
      execution.candidate.scheduled.shift()
      this.execute(this.invocation(call.invocation), execution)
    }
    this.validateSnapshot(execution.candidate)
    return this.transaction(execution.candidate, execution.effects, false)
  }
  prepareRestore(document: unknown): PreparedScriptTransaction {
    this.assertAlive()
    this.validateSnapshot(document)
    return this.transaction(structuredClone(document), [], false)
  }
  private validateSnapshot(document: unknown): asserts document is ScriptSnapshot {
    validateJson(document)
    if (!record(document) || Object.keys(document).sort().join(',') !== ['version', 'contentIdentity', 'clockMs', 'rng', 'nextCall', 'shared', 'players', 'attachments', 'data', 'off', 'scheduled'].sort().join(',') || document.version !== 1 || document.contentIdentity !== this.resolver.contentIdentity || !record(document.shared) ||
      !record(document.players) || !record(document.attachments) || !record(document.data) || !record(document.off) || !Array.isArray(document.scheduled)) throw new ScriptError('INVALID_SNAPSHOT', 'Invalid or incompatible script checkpoint')
    integer(document.clockMs as number); integer(document.rng as number, 1, 0xffffffff); integer(document.nextCall as number, 1)
    if (Object.keys(document.attachments).sort().join('\0') !== Object.keys(this.state.attachments).sort().join('\0')) throw new ScriptError('INVALID_SNAPSHOT', 'Script checkpoint attachment identities differ from this world')
    const validateStore = (store: unknown, scope: 'shared' | 'player'): void => {
      if (!record(store) || !record(store.variables) || !record(store.flags) || !record(store.data)) throw new ScriptError('INVALID_SNAPSHOT', 'Invalid script namespace')
      for (const [isFlag, entries] of [[false, store.variables], [true, store.flags]] as const) for (const [id, value] of Object.entries(entries)) {
        if (!/^[a-z][a-z0-9_-]*:(0|[1-9][0-9]*)$/.test(id)) throw new ScriptError('INVALID_SNAPSHOT', 'Invalid numeric state identity')
        slot(Number(id.split(':')[1]), 65535); integer(value as number, isFlag ? 0 : -2147483648, isFlag ? 1 : 2147483647)
      }
      for (const [id, value] of Object.entries(store.data)) {
        key(id); if (!record(value)) throw new ScriptError('INVALID_SNAPSHOT', 'Invalid module data')
        integer(value.version as number, 1); this.validateData(value.value, this.schemas.get(`${scope}:${id}`), value.version as number)
      }
    }
    // Load schemas before validating any custom state, including shared module data.
    for (const id of Object.keys(document.data)) this.definition(id)
    validateStore(document.shared, 'shared')
    for (const [id, store] of Object.entries(document.players)) {
      if (this.object(id)?.type !== 'Pc') throw new ScriptError('INVALID_SNAPSHOT', 'PC state belongs to a non-PC object')
      validateStore(store, 'player')
    }
    for (const [id, data] of Object.entries(document.data)) {
      if (!record(data)) throw new ScriptError('INVALID_SNAPSHOT', 'Invalid script custom data')
      const definition = this.definition(id); integer(data.version as number, 1); this.validateData(data.value, definition.dataSchema, data.version as number)
    }
    for (const [id, attachment] of Object.entries(document.attachments)) {
      key(id)
      if (!record(attachment) || typeof attachment.scriptId !== 'string' || !Array.isArray(attachment.counters) || attachment.counters.length !== 4) throw new ScriptError('INVALID_SNAPSHOT', 'Invalid script attachment')
      const definition = attachment.scriptId ? this.definition(attachment.scriptId) : undefined
      integer(attachment.flags as number, 0, 0xffffffff); attachment.counters.forEach(value => integer(value as number, 0, 255)); this.validateData(attachment.data, definition?.attachmentSchema)
    }
    for (const [id, off] of Object.entries(document.off)) { this.object(id); if (typeof off !== 'boolean') throw new ScriptError('INVALID_SNAPSHOT', 'Invalid object Off state') }
    const seen = new Set<string>()
    if (document.scheduled.length > 4096) throw new ScriptError('INVALID_SNAPSHOT', 'Too many scheduled calls')
    for (const call of document.scheduled) {
      if (!record(call) || typeof call.id !== 'string' || !/^call:[1-9][0-9]*$/.test(call.id) || seen.has(call.id) || Number(call.id.slice(5)) >= (document.nextCall as number)) throw new ScriptError('INVALID_SNAPSHOT', 'Invalid scheduled call identity')
      seen.add(call.id); integer(call.dueMs as number); this.invocation(call.invocation)
    }
  }
  private transaction(candidate: ScriptSnapshot, effects: ScriptPresentation[], runDefault: boolean): PreparedScriptTransaction {
    const expectedRevision = this.revision, previous = this.state
    const writes: ScriptObjectWrite[] = []
    for (const id of new Set([...Object.keys(previous.off), ...Object.keys(candidate.off)])) {
      if (!this.baselineOff.has(id)) this.baselineOff.set(id, this.host.isOff(id))
      const off = own(candidate.off, id) ? candidate.off[id] : this.baselineOff.get(id)!
      if (this.host.isOff(id) !== off) writes.push({ targetId: id, off })
    }
    const host: PreparedHostWrites = this.host.prepareObjectWrites(writes)
    let status: 'prepared' | 'committed' | 'rolled-back' = 'prepared', flushed = false
    const transaction: PreparedScriptTransaction = {
      runDefault, candidate: structuredClone(candidate), objectWrites: structuredClone(writes),
      commit: () => {
        this.assertAlive()
        if (status !== 'prepared' || this.revision !== expectedRevision) throw new ScriptError('STALE_TRANSACTION', 'Script transaction is no longer current')
        try { host.apply(); this.assertAlive() } catch (error) { try { host.rollback() } catch (_) { /* Preserve the original host error. */ } throw error }
        this.state = structuredClone(candidate); this.revision++; status = 'committed'
      },
      rollback: () => {
        this.assertAlive()
        if (flushed) throw new ScriptError('STALE_TRANSACTION', 'Published script effects cannot be rolled back')
        if (status === 'committed') {
          if (this.revision !== expectedRevision + 1) throw new ScriptError('STALE_TRANSACTION', 'A newer script transaction already committed')
          host.rollback(); this.state = previous; this.revision++
        }
        status = 'rolled-back'
      },
      flushEffects: () => {
        this.assertAlive()
        if (status !== 'committed') throw new ScriptError('UNCOMMITTED_EFFECT', 'Script effects require a committed transaction')
        if (flushed) return
        flushed = true
        for (const effect of effects) this.host.emitPresentation?.(structuredClone(effect))
      },
    }
    return transaction
  }
}
