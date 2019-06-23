// @flow
/**
 * Entity Component System module
 *
 * @module ecs
 */

import Entity from './Entity'
import System from './System'
import UID from './UID'
import Prototype from './Prototype'
import Utils from '../misc/Utils'

import Systems from './systems'
import type GameMap from '../map/GameMap'
import Components from './components'
import type GameEngine from '../GameEngine';

//const ClassTransformer = require('class-transformer')

class ComponentSystem {

  entities: Map<string, Entity>
  entitiesSystemsDirty: Map<string, Entity>
  systems: Map<string, System>
  updateCounter: number
  lastUpdate: number
  map: GameMap
  engine: GameEngine
  prototypes: Map<string, Prototype>
  components: Map<string, Object>


  /**
   *
   * @param map
   */
  constructor(map: GameMap) {
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

    this.lastUpdate = Utils.getCurrentTimestamp()

    this.map = map

    for (let key in Systems) {
      let system = Systems[key]
      lll(`Adding entity system: ${key}`)
      this.addSystem(new system(this.engine, this))
    }

    this.prototypes = new Map()
    this.components = new Map()

    //this.loadComponents()
  }

  get engine() {
    return this.map.engine
  }

  get events() {
    return this.map.engine.events
  }

  /**
   * Retrieve an entity by id
   * @param  {Number} id id of the entity to retrieve
   * @return {Entity} The entity if found null otherwise
   */
  getEntityById(id: string) {
    return this.entities.get(id)
  }
  /**
   * Add an entity to the ecs.
   *
   * @method addEntity
   * @param {Entity} entity The entity to add.
   */
  addEntity(entity: Entity) {
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
  removeEntity(entity: Entity) {
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
  removeEntityById(entityId: string) {
    let entity = this.entities.get(entityId)
    if (!entity) {
      return null
    }

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
  removeEntityIfDirty(entity: Entity) {
    entity = this.entitiesSystemsDirty.get(entity.id)

    if (entity) {
      this.entities.delete(entity.id)
    }
  }

  /**
   *
   * @param entity
   */
  addDirtyEntity(entity: Entity) {
    this.entitiesSystemsDirty.set(entity.id, entity)
  }

  /**
   * Add a system to the ecs.
   *
   * @method addSystem
   * @param {System} system system to add
   */
  addSystem(system: System) {
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
  getSystem(system: string) {
    return this.systems.get(system)
  }

  /**
   * Remove a system from the ecs.
   *
   * @method removeSystem
   * @param  {System} system system reference
   */
  removeSystem(system: string) {
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
    let now = Utils.getCurrentTimestamp()
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
  getNewId(entity: Entity) {
    return UID.DefaultUIDGenerator.next()
  }

  /**
   *
   */
  loadComponents() {
    for (let key in Components) {
      this.components.set(key, Components[key])
    }

    /*AGate.Utils.loadScripts('shared/entity/components', (name, script) => {
      let component = script.component;

      this.components.set(name, component)
    })*/
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async loadPrototypes(reload: boolean = false): Promise<*> {
    if (this.prototypes.size > 0 && !reload) {
      return
    }

    let assetLoader = this.engine.assetLoader
    let dataPath = AGate.getDataPath(`Prototypes`)

    let typeDirs = await assetLoader.findDirs(dataPath)
    for (let [type, entries] of typeDirs) {
      for (let [fileName, entry] of entries) {
        let meta = await assetLoader.loadJsonFile(
          `${dataPath}/${type}/${fileName}`
        )

        let key = Utils.getFileBase(fileName)

        let prototype = new Prototype(this.engine)
        prototype.loadComponents(meta)

        this.prototypes.set(key, prototype)
      }
    }
  }

  /**
   *
   * @param id
   * @param data
   * @returns {Promise<Entity>}
   */
  async newEntity(id: string, data: Object): Promise<Entity> {

    //baseComponent.location = new Location(baseComponent.location[0], baseComponent.location[1]);

    // Apply prototype
    let entity = null
    if (data[`Base`]) {
      let prototypeId = data[`Base`].prototype

      if (!data[`Base`].type) {
        lll('invalid entity type')
        data[`Base`].type = 'Wall'
      }

      if (prototypeId) {
        let prototype: Prototype = this.prototypes.get(`${prototypeId}`)
        if (!prototype) {
          console.log(`Invalid prototype: ${prototype}`)
        } else {
          entity = prototype.createEntity(this.engine, data)
        }
      }
    }

    // Load components' data and create instances
    if (!entity) {
      entity = new Entity(this.engine)
    }

    await entity.loadData()

    // Add to system
    entity.id = id
    this.addEntity(entity)
    return entity
  }
}

/*ComponentSystem.Entity = Entity
ComponentSystem.System = System*/

export default ComponentSystem
