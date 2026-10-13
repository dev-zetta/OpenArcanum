import type { DataSchema, JsonObject, JsonValue } from './ScriptApi'
import { ScriptError, validateJson } from './ScriptEngine'

export interface DataKeyDeclaration<Value extends JsonValue = JsonValue> {
  readonly default: Value
  readonly validate: (value: unknown) => value is Value
}
export type DataKeyDefinitions = Readonly<Record<string, DataKeyDeclaration>>
type DeclaredValue<Declaration> = Declaration extends DataKeyDeclaration<infer Value> ? Value : never
export type DeclaredData<Keys extends DataKeyDefinitions> = { [Name in keyof Keys]: DeclaredValue<Keys[Name]> }
export interface TypedDataStore<Keys extends DataKeyDefinitions> {
  get<Name extends keyof Keys & string>(name: Name): DeclaredValue<Keys[Name]>
  set<Name extends keyof Keys & string>(name: Name, value: DeclaredValue<Keys[Name]>): void
}

// Compiled trusted modules can contain their own bundled SDK copy. A stable
// non-enumerable symbol lets the host validate the same candidate scope across
// those copies. JSON/structuredClone omit this transient execution metadata.
const bindingKey = Symbol.for('openarcanum.script.declared-data.v1')
function bindings(data: JsonObject): DataKeyDefinitions[] {
  const descriptor = Object.getOwnPropertyDescriptor(data, bindingKey)
  if (descriptor) {
    if (!('value' in descriptor) || !Array.isArray(descriptor.value)) invalid('Invalid declared data metadata')
    return descriptor.value as DataKeyDefinitions[]
  }
  const values: DataKeyDefinitions[] = []
  Object.defineProperty(data, bindingKey, { value: values, enumerable: false, configurable: false, writable: false })
  return values
}
const invalid = (message: string): never => { throw new ScriptError('INVALID_DATA_KEY', message) }
const validName = (name: string): boolean => !!name && name.length <= 256 && !['__proto__', 'constructor', 'prototype'].includes(name) && !/[\x00-\x1f]/.test(name)
const freezeJson = <Value extends JsonValue>(value: Value): Value => {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freezeJson(child); Object.freeze(value) }
  return value
}
function validateValue(declaration: DataKeyDeclaration, name: string, value: unknown): void {
  validateJson(value)
  if (!declaration.validate(structuredClone(value))) invalid(`Custom data key ${name} has an invalid value`)
}

/** Declares exact typed names, immutable independent defaults and runtime guards.
 * These declarations are module code, never client-supplied save metadata. */
export function defineDataKeys<Keys extends DataKeyDefinitions>(definitions: Keys): Readonly<Keys> {
  if (!definitions || typeof definitions !== 'object' || Array.isArray(definitions) ||
    Object.getPrototypeOf(definitions) !== Object.prototype) invalid('Expected plain custom data key declarations')
  const copy: Record<string, DataKeyDeclaration> = {}
  for (const name of Object.keys(definitions)) {
    const descriptor = Object.getOwnPropertyDescriptor(definitions, name)
    if (!validName(name) || !descriptor || !('value' in descriptor)) invalid('Invalid custom data key declaration')
    const declaration = definitions[name]
    if (!declaration || typeof declaration.validate !== 'function') invalid(`Custom data key ${name} requires a runtime guard`)
    validateValue(declaration, name, declaration.default)
    copy[name] = Object.freeze({ default: freezeJson(structuredClone(declaration.default)), validate: declaration.validate })
  }
  return Object.freeze(copy) as Readonly<Keys>
}

/** Builds a complete versioned schema, so declared keys/defaults are also
 * enforced during checkpoint restore, before any module executes. */
export function schemaFromDataKeys<Keys extends DataKeyDefinitions>(keys: Keys, version = 1): DataSchema<DeclaredData<Keys>> {
  if (!Number.isSafeInteger(version) || version < 1) invalid('Invalid custom data schema version')
  const defaults: JsonObject = {}
  for (const [name, declaration] of Object.entries(keys)) defaults[name] = structuredClone(declaration.default)
  return {
    version, defaults: defaults as DeclaredData<Keys>,
    validate(value: unknown): value is DeclaredData<Keys> {
      try {
        validateJson(value)
        if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== Object.keys(keys).length) return false
        for (const [name, declaration] of Object.entries(keys)) {
          if (!Object.hasOwn(value, name)) return false
          validateValue(declaration, name, (value as JsonObject)[name])
        }
        return true
      } catch (_) { return false }
    },
  }
}

/** Opts one persistent scope into typed access. Existing malformed values are
 * rejected; missing values receive cloned defaults. Object reads and writes are
 * copies: changes must be explicitly set and cannot leak through references. */
export function bindDataStore<Keys extends DataKeyDefinitions>(data: JsonObject, keys: Keys): TypedDataStore<Keys> {
  validateJson(data)
  const checked = (name: string): DataKeyDeclaration => {
    if (!Object.hasOwn(keys, name)) invalid(`Custom data key ${name} is not declared`)
    return keys[name]
  }
  // Preflight every existing key before applying any defaults.
  for (const [name, declaration] of Object.entries(keys)) {
    if (Object.hasOwn(data, name)) validateValue(declaration, name, data[name])
    else validateValue(declaration, name, declaration.default)
  }
  for (const [name, declaration] of Object.entries(keys)) if (!Object.hasOwn(data, name)) data[name] = structuredClone(declaration.default)
  const validators = bindings(data)
  if (!validators.includes(keys)) validators.push(keys)
  return {
    get(name) {
      const declaration = checked(name)
      validateValue(declaration, name, data[name])
      return structuredClone(data[name]) as DeclaredValue<Keys[typeof name]>
    },
    set(name, value) {
      const declaration = checked(name)
      validateValue(declaration, name, value)
      data[name] = structuredClone(value)
    },
  }
}

/** Engine hook: raw compatibility access cannot invalidate a declared key after
 * binding and still commit. Execution metadata is omitted from snapshots. */
export function validateBoundData(data: JsonObject): void {
  const descriptor = Object.getOwnPropertyDescriptor(data, bindingKey)
  if (!descriptor) return
  for (const keys of bindings(data)) for (const [name, declaration] of Object.entries(keys)) {
    if (!Object.hasOwn(data, name)) invalid(`Declared custom data key ${name} disappeared`)
    validateValue(declaration, name, data[name])
  }
}
