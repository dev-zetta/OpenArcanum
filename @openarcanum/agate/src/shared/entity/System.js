// @flow
import type Manager from './Manager'
import type GameEngine from '../GameEngine'
import type Entity from './Entity'


/**
 * @class  Manager
 *
 * @description  A system update all eligible entities at a given frequency.
 * This class is not meant to be used directly and should be sub-classed to
 * define specific logic.
 */
export default class System {

  frequency: number
  entities: Map<string, Entity>
  engine: GameEngine
  manager: Manager
  totalElapsed: number


  /**
   * @class  Manager
   * @constructor
   * @param engine
   * @param manager
   * @param [frequency=1] {Number} Frequency of execution.
   */
  constructor(
    engine: GameEngine,
    manager: Manager,
    frequency: number = 1
  ) {
    this.engine = engine
    this.manager = manager
    this.totalElapsed = 0

    /**
     * Frequency of update execution, a frequency of `1` run the system every
     * update, `2` will run the system every 2 updates, ect.
     * @property {Number} frequency
     */
    this.frequency = frequency

    /**
     * Entities of the system.
     *
     * @property {Array[Entity]} entities
     */
    this.entities = new Map()
  }

  /**
   *
   * @returns {*}
   */
  get map() {
    return this.engine.map
  }

  /**
   * Add an entity to the system entities.
   *
   * @param {Entity} entity The entity to add to the system.
   */
  addEntity(entity: Entity) {
    entity.addSystem(this)
    this.entities.set(entity.id, entity)

    this.enter(entity)
  }
  /**
   * Remove an entity from the system entities. exit() handler is executed
   * only if the entity actually exists in the system entities.
   *
   * @param  {Entity} entity Reference of the entity to remove.
   */
  removeEntity(entity: Entity) {
    this.entities.delete(entity.id)
    entity.removeSystem(this)
    this.exit(entity)
  }

  /**
   * dispose the system by exiting all the entities
   *
   * @method  dispose
   */
  dispose() {
    for (let entity of this.entities) {
      entity.removeSystem(this)
      this.exit(entity)
    }
  }
  // methods to be extended by subclasses
  /**
   * Abstract method to subclass. Called once per update, before entities
   * iteration.
   *
   * @method  preUpdate
   */
  preUpdate() {}
  /**
   * Abstract method to subclass. Called once per update, after entities
   * iteration.
   *
   * @method  postUpdate
   */
  postUpdate() {}
  /**
   * Abstract method to subclass. Should return true if the entity is eligible
   * to the system, false otherwise.
   *
   * @method  test
   * @param  {Entity} entity The entity to test.
   */
  test(entity: Entity) {
    return false
  }
  /**
   * Abstract method to subclass. Called when an entity is added to the system.
   *
   * @method  enter
   * @param  {Entity} entity The added entity.
   */
  enter(entity: Entity) {}
  /**
   * Abstract method to subclass. Called when an entity is removed from the system.
   *
   * @method  exit
   * @param  {Entity} entity The removed entity.
   */
  exit(entity: Entity) {}

  /**
   * Abstract method to subclass. Called for each entity to update. This is
   * the only method that should actual mutate entity state.
   *
   * @method  update
   * @param  {Entity} entity The entity to update.
   * @param elapsed
   */
  update(entity: Entity, elapsed: number) {
    this.totalElapsed += elapsed
  }

  /**
   * Apply update to each entity of this system.
   *
   * @method  updateAll
   */
  updateAll(elapsed: number) {
    this.preUpdate()

    let promises = []
    for (let [key, entity] of this.entities) {
      this.update(entity, elapsed)
    }

    this.postUpdate()
  }
}
