// @flow

import GameObject from '../serialize/GameObject'
import Utils from '../misc/Utils'

import type Manager from './Manager'
import State from './State'

export default class Entity extends GameObject {
  /**
   *
   */
  manager: Manager

  /**
   *
   */
  moved: boolean

  /**
   * Systems applied to the entity.
   *
   * @property {Array[System]} systems
   */
  systems: Array<System>

  /**
   * Indiquate a change in components (a component was removed or added)
   * which require to re-compute entity eligibility to all systems.
   *
   * @property {Boolean} systemsDirty
   */
  systemsDirty: boolean

  /**
   * Components of the entity stored as key-value pairs.
   *
   * @property {Object} components
   */
  components: Array<*> // Class

  /**
   * All tags that this entity currently has.
   * @type {Array.<String>}
   * @private
   */
  tags: Array<string>

  state: State

  /**
   * @class Entity
   * @constructor
   *
   * @param manager
   * @param options
   */
  constructor(manager: Manager, options: Object = {}) {
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
  init(params, data) {
    //this.id = null
    this.components.length = 0
    this.tags.length = 0
    this.systems.length = 0

    this.systemsDirty = false
  }

  setComponent(componentName, component) {
    this[componentName] = component
  }

  /**
   * Set the systems dirty flag so the ECS knows this entity
   * needs to recompute eligibility at the beginning of next
   * tick.
   */
  setSystemsDirty() {
    if (!this.systemsDirty && this.manager) {
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
  static componentToName(component: Object): string {
    let name = Utils.isString(component)
      ? component
      : component.name
      ? component.name
      : component.constructor.name
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
  onAddComponent(componentName, componentData, component, prototype) {
    //lll(componentName, componentData, component, prototype)

    return prototype.wrapComponent(componentName, componentData, component)
  }

  /**
   * Add a component to the entity.
   *
   * @param componentClass
   * @param componentData
   * @param prototype
   */
  addComponent(
    componentClass: Object,
    componentData: Object,
    prototype: Object
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
   * @param  {String} name Name of the component to remove.
   */
  removeComponent(componentClass: Object | string) {
    this.manager.removeComponentFromEntity(this, componentClass)
  }

  /**
   * Drop all components.
   */
  removeAllComponents() {
    return this.manager.removeAllComponentsFromEntity(this)
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
  updateComponent(name: string, data: Object) {
    let component = this[name]

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
  updateComponents(components: Array<Object>) {
    for (let key in components) {
      this.updateComponent(key, components[key])
    }
  }

  /**
   * Check whether this game object has a certain component
   * @param componentClass the comp
   * @returns {Boolean} true if the gameObject contains this component
   */
  hasComponent(componentClass: Object | string): boolean {
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
  hasAllComponents(componentClasses) {
    for (let c of componentClasses) {
      if (!this.components.includes(c)) {
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
  getComponent(componentClass: Object | string): Object {
    const className =
      typeof componentClass === `string` ? componentClass : componentClass.name
    return this[className]
  }

  /**
   * @param {String} tag
   * @return {boolean} True if entity has tag.
   */
  hasTag(tag) {
    return this.tags.includes(tag)
  }

  /**
   * @param {String} tag
   * @return {Entity} This entity.
   */
  addTag(tag) {
    this.manager.entityAddTag(this, tag)
    return this
  }

  /**
   * @param {String} tag
   * @return {Entity} This entity.
   */
  removeTag(tag) {
    this.manager.entityRemoveTag(this, tag)
    return this
  }

  /**
   * Fire off an event on the messanger with this entity as the first parameter.
   * @param {String} eventName
   * @param {Object=} option
   */
  trigger(eventName, option) {
    this.manager.trigger(eventName, this, option)
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

  getUpdateState() {
    if (!this._update) {
      this._update = {
        _totalUpdates: 0
      }
    }

    this._update._totalUpdates++

    return this._update
  }

  triggerUpdate() {
    //lll('fdfdfd', this._update)
  }

  syncTo(other) {
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
