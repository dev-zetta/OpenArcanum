import type Manager from './Manager'
import type { GameObjectOptions } from '../serialize/GameObject'
import Components from './components'
import Entity from './Entity'
import Component from './components/Component'
import Utils from '../misc/Utils'
import { entityDocument, isRecord, type RawEntityDocument } from './EntityData'

const proxyTargets = new WeakMap<object, object>()

interface ProxyNode {
  _prototype?: ProxyNode
  _parent?: ProxyNode
  _originalData?: object
  _propName?: string
  entity?: Entity
}
interface Settable extends ProxyNode {
  set(value: unknown): unknown
  toPlainObject(): unknown
}
function isObject(value: unknown): value is object { return value !== null && typeof value === 'object' }
function node(value: unknown): ProxyNode | undefined { return isObject(value) ? value : undefined }
function property(object: object, key: PropertyKey): unknown { return Reflect.get(object, key) }
function componentClass(name: string) { return Object.prototype.hasOwnProperty.call(Components, name) ? Components[name as keyof typeof Components] : undefined }

export default class Prototype extends Entity {
  constructor(manager: Manager, options: GameObjectOptions = {}) { super(manager, options) }
  onAddComponent(name: string, data: Record<string, unknown>, component: Component, _prototype?: Prototype | null): Component {
    Prototype.setPropertiesFromData(name, data, component)
    return component
  }
  static addComponentsToEntity(entity: Entity, data: RawEntityDocument, prototype: Prototype): Record<string, Component> {
    const components: Record<string, Component> = {}
    for (const [key, raw] of Object.entries(data)) {
      const Constructor = componentClass(key)
      if (!Constructor) { Utils.logError(`Unknown component: ${key}`); continue }
      if (!isRecord(raw)) throw new TypeError(`Converted component ${key} must be an object.`)
      components[key] = entity.addComponent(Constructor, raw, prototype)
    }
    for (const Constructor of prototype.components) {
      if (entity.components.includes(Constructor)) continue
      const key = Constructor.componentName || Constructor.name
      components[key] = entity.addComponent(Constructor, {}, prototype)
    }
    return components
  }
  static createPrototypeComponentsFromData(prototype: Prototype, data: RawEntityDocument): Record<string, Component> {
    const components: Record<string, Component> = {}
    for (const [key, raw] of Object.entries(data)) {
      const Constructor = componentClass(key)
      if (!Constructor) { Utils.logError(`Unknown component: ${key}`); continue }
      if (!isRecord(raw)) throw new TypeError(`Converted component ${key} must be an object.`)
      if (key === 'Npc' && !raw.waypoints) raw.waypoints = []
      if (key === 'Visual') {
        if (!isRecord(raw.render)) raw.render = {}
        const render = raw.render as Record<string, unknown>
        if (!render.flags) render.flags = []
      }
      components[key] = prototype.addComponent(Constructor, raw, null)
    }
    return components
  }
  loadComponents(raw: unknown): void { Prototype.createPrototypeComponentsFromData(this, entityDocument(raw)) }
  static dispatchPropertyChange(object: ProxyNode, key: PropertyKey, value: unknown): void {
    if (typeof key !== 'string' || !Prototype.isSetableObject(object) && !Prototype.isPrototypeProperty(key, object._prototype)) return
    const path: string[] = []
    let current: ProxyNode | undefined = object
    let entity: Entity | undefined
    while (current) {
      const name = current._prototype?._propName
      if (name) path.unshift(name)
      if (current.entity) entity = current.entity
      current = current._parent
    }
    if (!entity) return
    let changes: Record<string, unknown> = entity.getUpdateState()
    for (const name of path) {
      if (!isRecord(changes[name])) changes[name] = {}
      changes = changes[name] as Record<string, unknown>
    }
    changes[key] = value
    entity.triggerUpdate()
  }
  static isSetableObject(value: unknown): value is Settable {
    return isObject(value) && typeof property(value, 'set') === 'function' && typeof property(value, 'toPlainObject') === 'function'
  }
  static setPropertyFromData(name: PropertyKey, value: unknown, target: object): void {
    const previous = property(target, name)
    if (Prototype.isSetableObject(previous)) previous.set(value)
    else Reflect.set(target, name, value)
  }
  static setPropertiesFromData(name: string, data: unknown, target: object): void {
    if (isRecord(data)) {
      for (const [key, value] of Object.entries(data)) {
        const previous = property(target, key)
        if (Prototype.isSetableObject(previous)) {
          previous.set(value)
          data[key] = previous.toPlainObject()
          Reflect.set(previous, '_originalData', data[key])
          Reflect.set(previous, '_propName', key)
        } else if (isObject(value)) {
          const nested = isObject(previous) ? previous : {}
          Reflect.set(target, key, nested)
          Prototype.setPropertiesFromData(key, value, nested)
        } else Reflect.set(target, key, value)
      }
    }
    Reflect.set(target, '_originalData', data)
    Reflect.set(target, '_propName', name)
  }
  wrapComponent(name: string, data: Record<string, unknown>, component: Component): Component {
    const prototype = node(property(this, name))
    if (!prototype) throw new Error(`Prototype is missing component ${name}.`)
    return Prototype.wrapComponentToProxy(name, data, component, prototype)
  }
  static canBeProxified(key: PropertyKey, value: unknown, prototype: unknown): boolean { return isObject(value) && Prototype.isPrototypeProperty(key, prototype) }
  static isValueObject(value: unknown): value is object { return isObject(value) }
  static isPrototypeProperty(key: PropertyKey, prototype: unknown): boolean {
    const original = node(prototype)?._originalData
    return !!original && key in original
  }
  static wrapComponentToProxy<T extends object>(name: string, raw: unknown, object: T, prototype: ProxyNode, parent: ProxyNode = object): T {
    // Pools return the previous proxy. Load its actual target so initialization
    // cannot publish changes through the old entity or stack proxy handlers.
    object = (proxyTargets.get(object) || object) as T
    parent = proxyTargets.get(parent) || parent
    if (Prototype.isSetableObject(prototype) && Prototype.isSetableObject(object)) object.set(raw)
    else {
      const data = isRecord(raw) ? raw : {}
      const prototypeData = prototype._originalData || {}
      for (const key of new Set([...Object.keys(prototypeData), ...Object.keys(data)])) {
        let value = data[key]
        if (value === undefined) {
          const inherited = property(prototype, key)
          if (Prototype.isSetableObject(inherited)) value = inherited._originalData || inherited.toPlainObject()
          else if (isRecord(property(prototypeData, key))) value = {}
          else { Reflect.deleteProperty(object, key); continue }
        }
        if (Prototype.canBeProxified(key, value, prototype)) {
          const parentPrototype = node(property(prototype, key))
          if (!parentPrototype) { Prototype.setPropertyFromData(key, value, object); continue }
          let nested = property(object, key)
          if (!isObject(nested)) {
            const Constructor: unknown = property(parentPrototype, 'constructor')
            nested = typeof Constructor === 'function' ? Reflect.construct(Constructor, []) : {}
          }
          Reflect.set(object, key, Prototype.wrapComponentToProxy(key, value, nested as object, parentPrototype, object))
        } else Prototype.setPropertyFromData(key, value, object)
      }
    }
    Reflect.set(object, '_prototype', prototype)
    if (object !== parent) Reflect.set(object, '_parent', parent)
    const handler: ProxyHandler<T> = {
      get(target, key) {
        const value = property(target, key)
        if (value !== undefined) return value
        const inherited = node(property(target, '_prototype'))
        return inherited ? property(inherited, key) : undefined
      },
      set(target, key, value: unknown) {
        const inherited = node(property(target, '_prototype'))
        if (isObject(value) && Prototype.isPrototypeProperty(key, inherited)) {
          const childPrototype = inherited && node(property(inherited, key))
          if (childPrototype) {
            const previous = property(target, key)
            Reflect.set(target, key, Prototype.wrapComponentToProxy(String(key), value, isObject(previous) ? previous : {}, childPrototype, target))
            return true
          }
        }
        Prototype.dispatchPropertyChange(target, key, value)
        Reflect.set(target, key, value)
        return true
      }
    }
    const result = new Proxy(object, handler)
    proxyTargets.set(result, object)
    return result
  }
  extendEntity(entity: Entity, data: RawEntityDocument): Entity { Prototype.addComponentsToEntity(entity, data, this); return entity }
}
