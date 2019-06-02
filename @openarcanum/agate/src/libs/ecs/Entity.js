/**
 * @module  ecs
 */

import * as Utils from './Utils'
import Lance from '../Lance'

/**
 * An entity.
 *
 * @class  Entity
 */
class Entity {
  /**
   * @class Entity
   * @constructor
   *
   * @param  {Number|UID.UIDGenerator} [idOrUidGenerator=null] The entity id if
   * a Number is passed. If an UID.UIDGenerator is passed, the entity will use
   * it to generate a new id. If nothing is passed, the entity will use
   * the default UID.UIDGenerator.
   *
   * @param {Array[Component]} [components=[]] An array of initial components.
   */
  constructor(options = {}) {
    //super()
    /**
     * Unique identifier of the entity.
     *
     * @property {Number} id
     */
    this.id = options.id || null

    /**
     * Systems applied to the entity.
     *
     * @property {Array[System]} systems
     */
    this.systems = []

    /**
     * Indiquate a change in components (a component was removed or added)
     * which require to re-compute entity eligibility to all systems.
     *
     * @property {Boolean} systemsDirty
     */
    this.systemsDirty = false

    /**
     * Components of the entity stored as key-value pairs.
     *
     * @property {Object} components
     */
    /*this.components = {};

    // components initialisation
    for (let i = 0, component; component = components[i]; i += 1) {
      // if a getDefaults method is provided, use it. First because let the
      // runtime allocate the component is way more faster than using a copy
      // function. Secondly because the user may want to provide some kind
      // of logic in components initialisation ALTHOUGH these kind of
      // initialisation should be done in enter() handler
      if (component.getDefaults) {
        this.components[component.name] = component.getDefaults();
      } else {
        this.components[component.name] = Object.assign({},
          components[i].defaults);
      }
    }*/

    /**
     * A reference to parent ECS class.
     * @property {ECS} ecs
     */
    this.ecs = null
  }
  /**
   * Set the parent ecs reference.
   *
   * @private
   * @param {ECS} ecs An ECS class instance.
   */
  addToECS(ecs) {
    this.ecs = ecs
    if (!this.id) {
      this.id = ecs.getNewId(this)
    }

    this.setSystemsDirty()
  }
  /**
   * Set the systems dirty flag so the ECS knows this entity
   * needs to recompute eligibility at the beginning of next
   * tick.
   */
  setSystemsDirty() {
    if (!this.systemsDirty && this.ecs) {
      this.systemsDirty = true

      // notify to parent ECS that this entity needs to be tested next tick
      this.ecs.addDirtyEntity(this)
    }
  }
  /**
   * Add a system to the entity.
   *
   * @private
   * @param {System} system The system to add.
   */
  addSystem(system) {
    this.systems.push(system)
  }
  /**
   * Remove a system from the entity.
   *
   * @private
   * @param  {System} system The system reference to remove.
   */
  removeSystem(system) {
    let index = this.systems.indexOf(system)

    if (index !== -1) {
      Utils.fastSplice(this.systems, index, 1)
    }
  }

  static componentInstanceToName(component) {
    return AGate.Utils.camelCase(component.constructor.name)
  }

  /**
   * Add a component to the entity. WARNING this method does not copy
   * components data but assign directly the reference for maximum
   * performances. Be sure not to pass the same component reference to
   * many entities.
   *
   * @param {String} name Attribute name of the component to add.
   * @param {Object} data Component data.
   */
  addComponent(component) {
    this[Entity.componentInstanceToName(component)] = component
    this.setSystemsDirty()
  }
  /**
   * Remove a component from the entity. To preserve performances, we
   * simple set the component property to `undefined`. Therefore the
   * property is still enumerable after a call to removeComponent()
   *
   * @param  {String} name Name of the component to remove.
   */
  removeComponent(name) {
    if (!this[name]) {
      return
    }

    delete this[name]
    this.setSystemsDirty()
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
  updateComponent(name, data) {
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
  updateComponents(components) {
    for (let key in components) {
      this.updateComponent(key, components[key])
    }
  }

  /**
   * Check whether this game object has a certain component
   * @param componentClass the comp
   * @returns {Boolean} true if the gameObject contains this component
   */
  hasComponent(componentClass) {
    const className =
      typeof componentClass === `string` ? componentClass : componentClass.name
    return className in this
  }

  getComponent(componentClass) {
    const className =
      typeof componentClass === `string` ? componentClass : componentClass.name
    return this[className]
  }

  /**
   * Dispose the entity.
   *
   * @private
   */
  dispose() {
    for (let system of this.systems) {
      system.removeEntity(this)
    }
  }
}

export default Entity
