// @flow
/**
 * Entity Component System module
 *
 * @module ecs
 */

import Entity from './Entity'
import UID from './UID'
import Prototype from './Prototype'
import Utils from '../misc/Utils'
import EntityUtils from './Utils'

import Systems from './systems'
//import Components from './components'
import type GameEngine from '../GameEngine'
import ObjectPool from './ObjectPool'
import Messenger from './Messenger'
import type EventEmitter from '../misc/EventEmitter'
import type System from './System'
import type AssetLoader from '../assets/AssetLoader'

//const ClassTransformer = require('class-transformer')

export default class Manager {
  gameEngine: GameEngine
  updateCounter: number
  lastUpdate: number

  entities: Map<string, Entity>
  prototypes: Map<string, Prototype>
  //components: Map<string, Object>

  systems: Map<string, System>
  dirtyEntities: Map<string, Entity>

  messenger: Messenger
  componentPools: Map<string, ObjectPool>
  entityPool: ObjectPool

  tags: Map<string, Map<string, Entity>>
  groups: Map<string, Object>

  dynamicEntities: Map<string, Object>


  /**
   * Fired AFTER an entity has be created.
   * @event
   */
  static ENTITY_CREATED = `Manager#ENTITY_CREATED`

  /**
   * Fired BEFORE an entity has been removed.
   * @event
   */
  static ENTITY_REMOVE = `Manager#ENTITY_REMOVE`

  /**
   * Fired AFTER a component has been removed.
   * @event
   */
  static COMPONENT_ADDED = `Manager#COMPONENT_ADDED`

  /**
   * Fired BEFORE a component has been removed.
   * @event
   */
  static COMPONENT_REMOVE = `Manager#COMPONENT_REMOVE`

  /**
   *
   * @param gameEngine
   */
  constructor(gameEngine: GameEngine) {
    this.gameEngine = gameEngine


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
     * @property dirtyEntities
     * @type {Map}
     */
    this.dirtyEntities = new Map()

    this.dynamicEntities = new Map()

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

    this.prototypes = new Map()
    //this.components = new Map()

    /**
     * Event messenger, injected
     * @type {Messenger}
     * @private
     */
    this.messenger = new Messenger()

    /**
     * Map of tags to the list of their entities.
     * @private
     */
    this.tags = new Map()

    /**
     * @type {Array.<Group>}
     * @private
     */
    this.groups = new Map()

    /**
     * Pool entities.
     * @private
     */
    this.entityPool = new ObjectPool(Entity, this)

    /**
     * Map of component names to their respective object pools.
     * @private
     */
    this.componentPools = new Map()

    this.lastUpdate = 0


    for (let key in Systems) {
      // The offline map checkpoint animates visuals, but does not activate the
      // legacy two-GUID AI/combat experiment as campaign behavior.
      if (gameEngine.options.standaloneMode === true && key !== 'Render') continue
      let system = Systems[key]
      lll(`Adding entity system: ${key}`)
      this.addSystem(new system(this.gameEngine, this))
    }
  }

  /**
   *
   * @returns {EventEmitter}
   */
  get events(): EventEmitter {
    return this.gameEngine.events
  }

  /**
   *
   * @returns {AssetLoader}
   */
  get assetLoader(): AssetLoader {
    return this.gameEngine.assetLoader
  }

  /**
   * Retrieve an entity by id
   * @param  {Number} id id of the entity to retrieve
   * @return {Entity} The entity if found null otherwise
   */
  getEntityById(id: string): ?Entity {
    return this.entities.get(id)
  }

  /**
   *
   * @returns {Map<string, Object>}
   */
  getDynamicEntities(): Map<string, Entity> {
    return this.dynamicEntities
  }

  /**
   *
   * @param id
   * @returns {Object}
   */
  getDynamicEntity(id: string): ?Entity {
    return this.dynamicEntities.get(id)
  }

  /**
   * Drop an entity. Returns it to the pool and fires all events for removing
   * components as well.
   * @param {Entity} entity
   */
  removeEntity(entity: ?Entity) {
    entity = this.getEntityById(entity.id)

    if (!entity) {
      throw new Error(`Tried to remove entity not in list`)
    }

    this.removeAllComponentsFromEntity(entity)

    // Remove from entity list
    this.triggerEvent(Manager.ENTITY_REMOVE, entity)
    this.entities.delete(entity.id)

    // Remove entity from any tag groups and clear the on-entity ref
    entity.tags.length = 0
    for (const [tag, entities] of this.tags) {
      entities.delete(entity.id)
    }

    for (let system of entity.systems) {
      system.removeEntity(v)
    }

    this.entityPool.release(entity)

    this.removeEntityIfDirty(entity)
  }

  /**
   * Remove an entity from the ecs by entity id.
   *
   * @method removeEntityById
   * @param  {string} id id of the entity to remove
   * @return {Entity}          removed entity if any
   */
  removeEntityById(id: string): ?Entity {
    let entity = this.getEntityById(id)
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
  removeEntityIfDirty(entity: ?Entity) {
    debugger
    entity = this.dirtyEntities.get(entity.id)

    if (entity) {
      this.entities.delete(entity.id)
    }
  }

  /**
   * @param {Entity} entity
   * @param {String} tag
   */
  addTagToEntity(entity: Entity, tag: string) {
    let entities = this.tags.get(tag)

    if (!entities) {
      entities = new Map()

      this.tags.set(tag, entities)
    } else {
      // Don't add if already there
      if (entities.has(entity.id)) {
        return
      }
    }

    // Add to our tag index AND the list on the entity
    entities.set(entity.id, entity)
    entity.tags.push(tag)
  }

  /**
   * @param {Entity} entity
   * @param {String} tag
   */
  removeTagFromEntity(entity, tag) {
    const entities = this.tags.get(tag)
    if (!entities) {
      return
    }

    if (!entities.has(entity.id)) {
      return
    }

    // Remove from our index AND the list on the entity
    entities.delete(entity.id)
    entity.tags.delete(entity.id)
  }

  /*getComponentPool(cName) {
    let cPool = this.componentPools.get(cName)
    if (!cPool) {
      cPool = new ObjectPool(Component)

      this.componentPools.set(cName, cPool)
    }

    return cPool
  }*/

  /**
   * @param {Entity} entity
   * @param componentClass
   * @param componentData
   * @param prototype
   */
  addComponentToEntity(entity: Entity, componentClass, componentData, prototype) {
    if (entity.components.includes(componentClass)) {
      debugger
    }

    entity.components.push(componentClass)

    // Create the reference on the entity to this (aquired) component
    const componentName = Entity.componentToName(componentClass)
    let componentPool = this.componentPools.get(componentName)
    if (!componentPool) {
      componentPool = new ObjectPool(componentClass)

      this.componentPools.set(componentName, componentPool)
    }

    //lll(entity, componentClass, componentData, prototype)

    let component = componentPool.aquire({ entity })

    component = entity.onAddComponent(
      componentName,
      componentData,
      component,
      prototype
    )
    //lll(component)

    entity.setComponent(componentName, component)

    if (!(entity instanceof Prototype)) {
      entity.setDirty()
    }

    // Check each indexed group to see if we need to add this entity to the list
    for (const [groupName, group] in this.groups) {
      // Only add this entity to a group index if this component is in the group,
      // this entity has all the components of the group, and its not already in
      // the index.
      if (!group.components.includes(componentClass)) {
        continue
      }

      if (!entity.hasAllComponents(group.components)) {
        continue
      }

      if (group.entities.includes(entity)) {
        continue
      }

      group.entities.push(entity)
    }

    this.triggerEvent(Manager.COMPONENT_ADDED, entity, componentClass)

    return component
  }

  /**
   * Drop all components on an entity. Avoids loop issues.
   * @param {Entity} entity
   */
  removeAllComponentsFromEntity(entity: Entity) {
    const components = entity.components

    for (let j = components.length - 1; j >= 0; j--) {
      const component = components[j]
      entity.removeComponent(component)
    }
  }

  /**
   * @param {Entity} entity
   * @param {Function} Class
   */
  removeComponentFromEntity(entity: Entity, Class: string) {
    const index = entity.components.indexOf(Class)
    if (!~index) {
      return
    }

    this.triggerEvent(Manager.COMPONENT_REMOVE, entity, Class)

    // Check each indexed group to see if we need to remove it
    for (const [groupName, group] of this.groups) {
      if (!group.components.includes(Class)) {
        continue
      }
      if (!entity.hasAllComponents(group.components)) {
        continue
      }

      group.entities.remove(entity.id)
    }

    // Remove T listing on entity and property ref, then free the component.
    const propName = Entity.componentToName(Class)
    entity.components.splice(index, 1)

    const component = entity[propName]
    delete entity[propName]
    this.componentPools.get(propName).release(component)

    entity.setDirty()
  }

  /**
   * Get a list of entities that have a certain set of components.
   * @return {Array.<Entity>}
   * @param componentClasses
   */
  queryComponents(componentClasses: Array<string>): Array<Entity> {
    let group = this.groups.get(Manager._groupKey(componentClasses))

    if (!group) {
      group = this._indexGroup(componentClasses)
    }

    return group.entities
  }

  /**
   * Get a list of entities that all have a certain tag.
   * @param {String} tag
   * @return {Array.<Entity>}
   */
  queryTag(tag: string): Array<Entity> {
    let entities = this.tags.get(tag)

    if (!entities) {
      return []
    }

    return entities.values()
  }

  /**
   * Get information about the object pools of the entities and the various
   * components. NOT optimized or garbage collector friendly.
   * @return {Object}
   */
  poolStats() {
    const stats = {}
    const e = this.entityPool
    stats.entity = {
      used: this.entityPool.totalUsed(),
      size: this.entityPool.count
    }

    for (const name in this.componentPools) {
      const pool = this.componentPools[name]
      stats[name] = {
        used: pool.totalUsed(),
        size: pool.count
      }
    }

    return stats
  }

  /**
   * Create an index of entities with a set of components.
   * @param {Array.<Function>} Components
   * @private
   */
  _indexGroup(componentClasses: Array<string>) {
    const key = Manager._groupKey(componentClasses)

    if (this.groups.has(key)) {
      return
    }

    const group = new Group(componentClasses)

    this.groups.set(key, group)

    for (let [id, entity] of this.entities) {
      if (entity.hasAllComponents(componentClasses)) {
        group.entities.push(entity)
      }
    }

    return group
  }

  /**
   * Trigger the messenger if we have one.
   * @param {String} event
   * @param {Object=} a
   * @param {Object=} b
   */
  triggerEvent(event, a, b) {
    if (this.messenger) {
      this.messenger.trigger(event, a, b)
    }
  }

  /**
   *
   * @param entity
   */
  addDirtyEntity(entity: Entity) {
    this.dirtyEntities.set(entity.id, entity)
  }

  /**
   * Add a system to the ecs.
   *
   * @method addSystem
   * @param {Manager} system system to add
   */
  addSystem(system: Manager) {
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
   * @param  {Manager} system system reference
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

    for (let [id, entity] of this.dirtyEntities) {
      for (let [name, system] of this.systems) {
       // if (id == 'E505FDB0-0E4E-11D4-8F1D-00E02920220C')
       //   debugger

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

      entity.dirtyEntities = false
    }
    // jshint maxdepth: 3

    this.dirtyEntities.clear()
  }

  /**
   *
   */
  start() {

  }

  /**
   * Update the ecs.
   *
   * @method update
   */
  update(t: number, dt: number) {
    let now = Utils.getCurrentTimestamp()
    //lll(now, elapsed)

    for (let [name, system] of this.systems) {
      if (this.updateCounter % system.frequency > 0) {
        continue
      }

      this.cleanDirtyEntities()
      system.updateAll(dt)
    }

    this.updateCounter += 1
    this.lastUpdate = t
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
  // loadComponents() {
  //   for (let key in Components) {
  //     this.components.set(key, Components[key])
  //   }
  //
  //   /*AGate.Utils.loadScripts('shared/entity/components', (name, script) => {
  //     let component = script.component;
  //
  //     this.components.set(name, component)
  //   })*/
  // }

  /**
   *
   * @param key
   * @param fileName
   * @returns {Promise<void>}
   */
  async loadPrototype(key: string, fileName: string) {
    let meta = await this.assetLoader.loadJsonFile(fileName)

    let prototype = new Prototype(this)
    prototype.loadComponents(meta)

    //if (key == 4045) {
    //  lll('sdfsfs', prototype, meta)
    //}

    this.prototypes.set(key, prototype)
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async loadPrototypes(reload: boolean = false): Promise<*> {
    if (this.prototypes.size > 0 && !reload) {
      return
    }

    let dataPath = AGate.getDataPath(`Prototypes`)

    let promises = []

    let typeDirs = await this.assetLoader.findDirs(dataPath)
    for (let [type, entries] of typeDirs) {
      for (let [fileName, entry] of entries) {
        let key = Utils.getFileBase(fileName)

        promises.push(
          this.loadPrototype(key, `${dataPath}/${type}/${fileName}`)
        )
      }
    }

    return Promise.all(promises)
  }

  /**
   *
   * @param id
   * @param data
   * @returns {Promise<Entity>}
   */
  async newEntity(id: string, data: Object): Promise<Entity> {
    // Apply prototype
    let entity = this.entityPool.aquire(this)

    if (this.entities.get(id)) {
      console.warn(`Duplicate converted entity ID ${id}; retaining both records`)
      entity.sourceId = id
      do { id = '!' + id } while (this.entities.has(id))
    }

    entity.id = id

    if (data[`Base`]) {
      let prototypeId = data[`Base`].prototype


      if (prototypeId) {
        let prototype: ?Prototype = this.prototypes.get(`${prototypeId}`)
        if (!prototype) {
          throw new Error(`Missing converted prototype: ${prototypeId}`)
        } else {
          prototype.extendEntity(entity, data)
        }
      }
    }

    // Load components' data and create instances
    if (!entity) {
      debugger
      //entity = new Entity(this.gameEngine)
    }

    //await entity.loadData()

    // Add to manager

    //entity.setdirtyEntities()
    this.entities.set(entity.id, entity)

    if (EntityUtils.isDynamic(entity)) {
      this.dynamicEntities.set(entity.id, entity)
    }

    this.triggerEvent(Manager.ENTITY_CREATED, entity)

    //if (id == '44681452-6AD6-B342-9C16-23E68416F47E') {
    //  lll('sdfsfsdfsd', entity)
    //}

    return entity
  }

  /**
   * @param {Array.<Function>} Classes
   * @return {String}
   * @private
   */
  static _groupKey(Classes: Array<string>): string {
    const names = []
    for (let n = 0; n < Classes.length; n++) {
      const T = Classes[n]
      names.push(Utils.getClassName(T))
    }

    return names
      .map(x => x.toLowerCase())
      .sort()
      .join(`-`)
  }
}
