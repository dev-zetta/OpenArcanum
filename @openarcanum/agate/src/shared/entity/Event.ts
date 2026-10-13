import type { ComponentConstructor } from './Entity'
export type EventCallback = (entity: unknown, option: unknown) => unknown

export default class Event {
  _name: string
  _callback: EventCallback
  _components: (ComponentConstructor | string)[] = []
  _entity: unknown = null
  constructor(name: string, callback: EventCallback) { this._name = name || 'name'; this._callback = callback }
  fire(name: string, entity: unknown, option?: unknown): boolean {
    if (name !== this._name) return false
    if (this._components.length && entity && typeof entity === 'object') {
      const match: unknown = Reflect.get(entity, 'hasAllComponents')
      if (typeof match === 'function' && !Reflect.apply(match, entity, [this._components])) return false
    }
    if (this._entity !== null && this._entity !== entity) return false
    this._callback(entity, option)
    return true
  }
  whereEntity(entity: unknown): this { if (this._entity) throw new Error('Cannot call whereEntity twice'); this._entity = entity; return this }
  whereComponent(component: ComponentConstructor | string): this { this._components.push(component); return this }
  whereComponents(components: (ComponentConstructor | string)[]): this { this._components.push(...components); return this }
}
