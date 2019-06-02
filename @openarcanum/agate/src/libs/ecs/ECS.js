/**
 * Entity Component System module
 *
 * @module ecs
 */

import Entity from './Entity'
import System from './System'
import Performance from './Performance'
import UID from './UID'

/**
 * @class  ECS
 */
class ECS {
  /**
   * @constructor
   * @class  ECS
   */
  constructor() {
    /**
     * Store all entities of the ECS.
     *
     * @property entities
     * @type {Map}
     */
    this.entities = new Map()

    /**
     * Store entities which need to be tested at beginning of next tick.
     *
     * @property entitiesSystemsDirty
     * @type {Map}
     */
    this.entitiesSystemsDirty = new Map()

    /**
     * Store all systems of the ECS.
     *
     * @property systems
     * @type {Map}
     */
    this.systems = new Map()

    /**
     * Count how many updates have been done.
     *
     * @property updateCounter
     * @type {Number}
     */
    this.updateCounter = 0

    this.lastUpdate = Performance.now()
  }
  /**
   * Retrieve an entity by id
   * @param  {Number} id id of the entity to retrieve
   * @return {Entity} The entity if found null otherwise
   */
  getEntityById(id) {
    return this.entities.get(id)
  }
  /**
   * Add an entity to the ecs.
   *
   * @method addEntity
   * @param {Entity} entity The entity to add.
   */
  addEntity(entity) {
    this.entities.set(entity.id, entity)
    entity.addToECS(this)
  }
  /**
   * Remove an entity from the ecs by reference.
   *
   * @method removeEntity
   * @param  {Entity} entity reference of the entity to remove
   * @return {Entity}        the remove entity if any
   */
  removeEntity(entity) {
    this.entities.delete(entity.id)

    entity.dispose()
    this.removeEntityIfDirty(entity)
  }
  /**
   * Remove an entity from the ecs by entity id.
   *
   * @method removeEntityById
   * @param  {Entity} entityId id of the entity to remove
   * @return {Entity}          removed entity if any
   */
  removeEntityById(entityId) {
    let entity = this.entities.get(entityId)
    if (!entity) {return null}

    this.removeEntity(entity)

    return entity
  }
  /**
   * Remove an entity from dirty entities by reference.
   *
   * @private
   * @method removeEntityIfDirty
   * @param  {[type]} entity entity to remove
   */
  removeEntityIfDirty(entity) {
    entity = this.entitiesSystemsDirty.get(entity.id)

    if (entity) {
      this.entities.delete(entity.id)
    }
  }

  /**
   *
   * @param entity
   */
  addDirtyEntity(entity) {
    this.entitiesSystemsDirty.set(entity.id, entity)
  }

  /**
   * Add a system to the ecs.
   *
   * @method addSystem
   * @param {System} system system to add
   */
  addSystem(system) {
    this.systems.set(system.constructor.name, system)

    // iterate over all entities to eventually add system
    for (let [key, value] of this.entities) {
      if (system.test(value)) {
        system.addEntity(value)
      }
    }
  }

  /**
   *
   * @param system
   * @returns {any}
   */
  getSystem(system) {
    return this.systems.get(system)
  }


  /**
   * Remove a system from the ecs.
   *
   * @method removeSystem
   * @param  {System} system system reference
   */
  removeSystem(system) {
    let instance = this.systems.get(system)
     this.systems.delete(system)

    if (instance) {
      instance.dispose()
    }
  }
  /**
   * "Clean" entities flagged as dirty by removing unecessary systems and
   * adding missing systems.
   *
   * @private
   * @method cleanDirtyEntities
   */
  cleanDirtyEntities() {
    // jshint maxdepth: 4

    for (let [id, entity] of this.entitiesSystemsDirty) {
      for (let [name, system] of this.systems) {
        // for each dirty entity for each system
        let index = entity.systems.indexOf(system)
        let entityTest = system.test(entity)

        if (index === -1 && entityTest) {
          // if the entity is not added to the system yet and should be, add it
          system.addEntity(entity)
        } else if (index !== -1 && !entityTest) {
          // if the entity is added to the system but should not be, remove it
          system.removeEntity(entity)
        }
        // else we do nothing the current state is OK
      }

      entity.systemsDirty = false
    }
    // jshint maxdepth: 3

    this.entitiesSystemsDirty.clear()
  }
  /**
   * Update the ecs.
   *
   * @method update
   */
  update() {
    let now = Performance.now()
    let elapsed = now - this.lastUpdate

    for (let [name, system] of this.systems) {
      if (this.updateCounter % system.frequency > 0) {
        break
      }

      if (this.entitiesSystemsDirty.size > 0) {
        // if the last system flagged some entities as dirty check that case
        this.cleanDirtyEntities()
      }

      system.updateAll(elapsed)
    }

    this.updateCounter += 1
    this.lastUpdate = now
  }

  /**
   *
   * @param entity
   * @returns {*}
   */
  getNewId(entity) {
    return UID.DefaultUIDGenerator.next()
  }
}

// expose user stuff
ECS.Entity = Entity
ECS.System = System

export default ECS
