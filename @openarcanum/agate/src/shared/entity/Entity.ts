import type Base from './components/Base'
import type Visual from './components/Visual'
import type Critter from './components/Critter'
import type Portal from './components/Portal'
import type Container from './components/Container'
import type Item from './components/Item'
import type Npc from './components/Npc'
import type Generic from './components/Generic'
import type Key from './components/Key'
import type Gold from './components/Gold'
import type Projectile from './components/Projectile'
import type Weapon from './components/Weapon'
import type Armor from './components/Armor'
import type Ammo from './components/Ammo'
import type Scenery from './components/Scenery'
import type Wall from './components/Wall'
import type Trap from './components/Trap'
import type Written from './components/Written'
import type Spell from './components/Spell'
import type Pc from './components/Pc'
import type Component from './components/Component'
import type System from './System'
import type Prototype from './Prototype'
import type Manager from './Manager'
import type { GameObjectParameters, GameObjectOptions } from '../serialize/GameObject'
export interface ComponentConstructor { new(): Component; componentName?: string; readonly name: string }

import GameObject from '../serialize/GameObject'
import Utils from '../misc/Utils'

import State from './State'

export default class Entity extends GameObject {
  declare light?: import("../../client/Light").default | null
  declare id: string
  declare sourcePath: string
  declare sourceId: string
  declare sourceComponent: string
  declare ground: boolean
  declare groundInitialLocation: [number, number]
  declare portalOpen: boolean
  declare instanceData: Record<string, unknown>
  declare prototype: Prototype
  declare _update: { _totalUpdates: number; [key: string]: unknown }
  declare base: Base
  declare visual?: Visual
  declare critter?: Critter
  declare portal?: Portal
  declare container?: Container
  declare item?: Item
  declare npc?: Npc
  declare generic?: Generic
  declare key?: Key
  declare gold?: Gold
  declare projectile?: Projectile
  declare weapon?: Weapon
  declare armor?: Armor
  declare ammo?: Ammo
  declare scenery?: Scenery
  declare wall?: Wall
  declare trap?: Trap
  declare written?: Written
  declare spell?: Spell
  declare pc?: Pc


  declare manager: Manager
  declare moved: boolean
  declare systems: Array<System>
  declare systemsDirty: boolean
  declare components: Array<ComponentConstructor>
  declare tags: Array<string>
  declare state: State

  /**
   *
   */

  /**
   *
   */

  /**
   * Systems applied to the entity.
   *
   * @property {Array[System]} systems
   */

  /**
   * Indiquate a change in components (a component was removed or added)
   * which require to re-compute entity eligibility to all systems.
   *
   * @property {Boolean} systemsDirty
   */

  /**
   * Components of the entity stored as key-value pairs.
   *
   * @property {Object} components
   */
                       // Class

  /**
   * All tags that this entity currently has.
   * @type {Array.<String>}
   * @private
   */

  /**
   * @class Entity
   * @constructor
   *
   * @param manager
   * @param options
   */
  constructor(manager: Manager, options: GameObjectOptions = {}) {
    super(manager, options)

    //this.id = options.id || null

    this.systems = []
    this.components = []
    this.tags = []
    this.state = new State()
  }

  /*get id() {
    return this.base.id
  }

  set id(id) {
    this.base.id = id
  }*/

  /**
   * Re-init for pooling purposes.
   * @private
   */
  init(params: GameObjectParameters, data?: unknown) {
    //this.id = null
    this.components.length = 0
    this.tags.length = 0
    this.systems.length = 0

    this.systemsDirty = false
  }

  /**
   *
   * @param componentName
   * @param component
   */
  setComponent(componentName: string, component: Component) {
    Reflect.set(this, componentName, component)
  }

  /**
   * Set the systems dirty flag so the ECS knows this entity
   * needs to recompute eligibility at the beginning of next
   * tick.
   */
  setDirty() {
    if (!this.systemsDirty) {
      this.systemsDirty = true

      // notify to parent ECS that this entity needs to be tested next tick
      this.manager.addDirtyEntity(this)
    }
  }
  /**
   * Add a system to the entity.
   *
   * @private
   * @param {System} system The system to add.
   */
  addSystem(system: System) {
    this.systems.push(system)
  }
  /**
   * Remove a system from the entity.
   *
   * @private
   * @param  {Manager} system The system reference to remove.
   */
  removeSystem(system: System) {
    let index = this.systems.indexOf(system)

    if (index !== -1) {
      Utils.fastSplice(this.systems, index, 1)
    }
  }

  /**
   *
   * @param component
   * @returns {string | *}
   */
  static componentToName(component: ComponentConstructor | string | Component): string {
    const name = typeof component === 'string' ? component : typeof component === 'function' ? component.componentName || component.name : component.constructor.name
    return Utils.camelCase(name)
  }

  /**
   *
   * @param component
   * @param componentName
   * @param componentData
   * @param prototype
   * @returns {Proxy<Object>}
   */
  onAddComponent(componentName: string, componentData: Record<string, unknown>, component: Component, prototype?: Prototype | null) {
    //lll(componentName, componentData, component, prototype)

    return prototype ? prototype.wrapComponent(componentName, componentData, component) : Object.assign(component, componentData)
  }

  /**
   * Add a component to the entity.
   *
   * @param componentClass
   * @param componentData
   * @param prototype
   */
  addComponent(
    componentClass: ComponentConstructor | string,
    componentData: Record<string, unknown>,
    prototype?: Prototype | null
  ) {
    return this.manager.addComponentToEntity(
      this,
      componentClass,
      componentData,
      prototype
    )
  }

  /**
   * Remove a component from the entity. To preserve performances, we
   * simple set the component property to `undefined`. Therefore the
   * property is still enumerable after a call to removeComponent()
   *
   * @param componentClass
   */
  removeComponent(componentClass: ComponentConstructor | string) {
    this.manager.removeComponentFromEntity(this, componentClass)
  }

  /**
   * Update a component field by field, NOT recursively. If the component
   * does not exists, this method create it silently.
   *
   * @method updateComponent
   * @param  {String} name Name of the component
   * @param  {Object} data Dict of attributes to update
   * @example
   *   entity.addComponent('kite', {vel: 0, pos: {x: 1}});
   *   // entity.component.pos is '{vel: 0, pos: {x: 1}}'
   *   entity.updateComponent('kite', {angle: 90, pos: {y: 1}});
   *   // entity.component.pos is '{vel: 0, angle: 90, pos: {y: 1}}'
   */
  updateComponent(name: string, data: Record<string, unknown>) {
    let component = Reflect.get(this, name) as Record<string, unknown> | undefined

    if (!component) {
      this.addComponent(name, data)
    } else {
      for (let key in data) {
        component[key] = data[key]
      }
    }
  }
  /**
   * Update a set of components.
   *
   * @param  {Object} components Dict of components to update.
   */
  updateComponents(components: Record<string, Record<string, unknown>>) {
    for (let key in components) {
      this.updateComponent(key, components[key])
    }
  }

  /**
   * Check whether this game object has a certain component
   * @param componentClass the comp
   * @returns {Boolean} true if the gameObject contains this component
   */
  hasComponent(componentClass: ComponentConstructor | string): boolean {
    const className =
      typeof componentClass === `string` ? componentClass : componentClass.name
    return className in this
  }

  /**
   * Drop all components.
   */
  removeAllComponents() {
    return this.manager.removeAllComponentsFromEntity(this)
  }

  /**
   * @param {Array.<Function>} Components
   * @return {boolean} True if entity has all Components.
   */
  hasAllComponents(componentClasses: (ComponentConstructor | string)[]) {
    for (let c of componentClasses) {
      if (!this.components.some(owned => Entity.componentToName(owned) === Entity.componentToName(c))) {
        return false
      }
    }

    return true
  }

  /**
   *
   * @param componentClass
   * @returns {*}
   */
  getComponent(componentClass: ComponentConstructor | string): Component | undefined {
    const className =
      typeof componentClass === `string` ? componentClass : componentClass.name
    return Reflect.get(this, className) as Component | undefined
  }

  /**
   * @param {String} tag
   * @return {boolean} True if entity has tag.
   */
  hasTag(tag: string) {
    return this.tags.includes(tag)
  }

  /**
   * @param {String} tag
   * @return {Entity} This entity.
   */
  addTag(tag: string) {
    this.manager.addTagToEntity(this, tag)
    return this
  }

  /**
   * @param {String} tag
   * @return {Entity} This entity.
   */
  removeTag(tag: string) {
    this.manager.removeTagFromEntity(this, tag)
    return this
  }

  /**
   * Fire off an event on the messanger with this entity as the first parameter.
   * @param {String} eventName
   * @param {Object=} option
   */
  trigger(eventName: string, option: Record<string, unknown>) {
    this.manager.triggerEvent(eventName, this, option)
  }

  /**
   * Dispose the entity.
   *
   * @private
   */
  dispose() {
    return this.manager.removeEntity(this)
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async loadData() {
    //this.updateComponents(data)
  }

  /**
   *
   * @returns {{_totalUpdates: number}|*}
   */
  getUpdateState() {
    if (!this._update) {
      this._update = {
        _totalUpdates: 0
      }
    }

    this._update._totalUpdates++

    return this._update
  }

  /**
   *
   */
  triggerUpdate() {
    //lll('fdfdfd', this._update)

    this.world.events.emit('Object:Update', this)
  }

  /**
   *
   * @param other
   */
  syncTo(other: Entity) {
    super.syncTo(other)
    /*this.position.copy(other.position)
    this.velocity.copy(other.velocity)
    this.width = other.width
    this.height = other.height
    this.bendingAngle = other.bendingAngle
    this.rotationSpeed = other.rotationSpeed
    this.acceleration = other.acceleration
    this.deceleration = other.deceleration*/
  }
}
