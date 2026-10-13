import type { ActionName, ConditionName } from './OperationCatalog'
export { defineDataKeys, schemaFromDataKeys, bindDataStore } from './TypedData'
export type { DataKeyDeclaration, DataKeyDefinitions, DeclaredData, TypedDataStore } from './TypedData'

export const API_VERSION = 1 as const
export type ScriptRealm = 'server' | 'client'
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
export interface JsonObject { [key: string]: JsonValue }
export interface DataSchema<Data extends JsonObject = JsonObject> {
  version: number
  defaults: Data
  validate(value: unknown): value is Data
}
export interface SourceLocation { scriptId: string; line: number; operation?: string; opcode?: number }
export interface NumberReference { readonly kind: 'number-reference'; value: number }
export interface ObjectReference { readonly kind: 'object-reference'; value: ScriptObject | null }
/** An immutable identity view. All mutation goes through transactional game APIs. */
export interface ScriptObject {
  readonly id: string
  readonly name?: string
  readonly type?: string
  readonly prototype?: number
  readonly location?: readonly [number, number]
}
export interface ObjectSelection { readonly kind: 'selection'; readonly selector: number; readonly objects: readonly ScriptObject[]; readonly any: boolean }
export type ScriptOperand = number | boolean | string | null | ScriptObject | NumberReference | ObjectReference | ObjectSelection
export interface StateNamespace {
  readonly data: JsonObject
  variable(id: number): NumberReference
  flag(id: number): NumberReference
  /** Named aliases resolve to the same cells as their original numeric IDs. */
  readonly variables: Record<string, number>
  readonly flags: Record<string, number>
}
export interface AttachmentContext {
  readonly id: string
  readonly data: JsonObject
  flag(id: number): NumberReference
  counter(id: number): NumberReference
  remove(): void
  replace(scriptId: string): void
}
export interface PresentationApi {
  message(text: string, targetId?: string): void
}
export interface ServerGameApi {
  readonly actions: { readonly [Name in ActionName]: (...args: ScriptOperand[]) => void }
  readonly conditions: { readonly [Name in ConditionName]: (...args: ScriptOperand[]) => boolean }
  toggleOff(target: ScriptObject, off?: boolean): void
  isOff(target: ScriptObject): boolean
  isNamed(target: ScriptObject, nameId: number): boolean
  select(selector: number, localIndex?: number): ObjectSelection
  call(scriptId: string, entryLine?: number, targets?: InvocationTargets): void
  schedule(scriptId: string, delaySeconds: number, entryLine?: number, targets?: InvocationTargets): string
  cancelScheduled(callId: string): void
  random(min: number, max: number): number
}
export interface InvocationTargets { triggererId?: string | null; attacheeId?: string | null; extraId?: string | null; playerId?: string | null }
export interface ServerScriptContext<Data extends JsonObject = JsonObject> {
  readonly realm: 'server'
  readonly source: SourceLocation
  readonly shared: StateNamespace
  readonly player: StateNamespace
  readonly attachment: AttachmentContext
  readonly data: Data
  readonly triggerer: ScriptObject | null
  readonly attachee: ScriptObject | null
  readonly extra: ScriptObject | null
  readonly playerObject: ScriptObject | null
  readonly locals: { readonly numbers: NumberReference[]; readonly objects: ObjectReference[] }
  playerState(selector: number): StateNamespace
  localNumber(index: number): NumberReference
  localObject(index: number): ObjectReference
  number(value: number | NumberReference): number
  object(value: ScriptObject | ObjectReference | null): ScriptObject | null
  readonly game: ServerGameApi
  readonly ui: PresentationApi
  /** Marks the exact source row before an API call, including unsupported calls. */
  at(line: number, operation?: string, opcode?: number): void
}
export interface ClientScriptContext<Data extends JsonObject = JsonObject> {
  readonly realm: 'client'
  readonly source: SourceLocation
  readonly data: Data
  readonly event: Readonly<JsonObject>
  readonly ui: PresentationApi
  at(line: number, operation?: string, opcode?: number): void
}
export type ServerHandler = (context: ServerScriptContext) => ScriptFlow | void
export type ClientHandler = (context: ClientScriptContext) => ScriptFlow | void
export type ScriptHandler = ServerHandler | ClientHandler
export type ScriptFlow = { readonly kind: 'next' | 'run-default' | 'skip-default' }
  | { readonly kind: 'jump'; readonly handler: ScriptHandler }
  | { readonly kind: 'jump-line'; readonly line: number }
export const flow = Object.freeze({
  next: (): ScriptFlow => ({ kind: 'next' }),
  runDefault: (): ScriptFlow => ({ kind: 'run-default' }),
  skipDefault: (): ScriptFlow => ({ kind: 'skip-default' }),
  jump: (handler: ScriptHandler): ScriptFlow => ({ kind: 'jump', handler }),
  jumpByLine: (line: number): ScriptFlow => ({ kind: 'jump-line', line }),
})
interface DefinitionBase {
  apiVersion?: typeof API_VERSION
  id: string
  name: string
  description?: string
  dataSchema?: DataSchema
  sharedSchema?: DataSchema
  playerSchema?: DataSchema
  attachmentSchema?: DataSchema
  /** Default original header for direct calls; live attached headers are separate. */
  template?: { flags: number; counters: readonly number[] }
  scriptFlags?: number
}
export interface ServerScriptDefinition extends DefinitionBase { realm: 'server'; entryPoints: Readonly<Record<number, ServerHandler>> }
export interface ClientScriptDefinition extends DefinitionBase { realm: 'client'; entryPoints: Readonly<Record<number, ClientHandler>> }
export type ScriptDefinition = ServerScriptDefinition | ClientScriptDefinition
export function defineScript<Definition extends ScriptDefinition>(definition: Definition): Definition {
  return definition
}
export interface ScriptSymbols { variables?: Readonly<Record<string, number>>; flags?: Readonly<Record<string, number>> }
export interface ScriptInvocation extends InvocationTargets {
  scriptId: string
  entryLine?: number
  attachmentId?: string
  attachmentPoint?: number
}
export interface ScriptPresentation { type: 'message'; text: string; targetId?: string }
export interface ScriptObjectWrite { targetId: string; off: boolean }
/** Host checks that writes remain possible before returning an apply/rollback pair. */
export interface PreparedHostWrites { apply(): void; rollback(): void }
export interface ScriptHost {
  getObject(id: string): ScriptObject | null
  isOff(id: string): boolean
  isNamed?(id: string, nameId: number): boolean
  select?(selector: number, invocation: ScriptInvocation): readonly ScriptObject[]
  prepareObjectWrites(writes: readonly ScriptObjectWrite[]): PreparedHostWrites
  emitPresentation?(effect: ScriptPresentation): void
}
export interface ScriptResolver {
  resolve(id: string, realm: ScriptRealm): ScriptDefinition | undefined
  readonly contentIdentity: string
  dispose?(): void
}
