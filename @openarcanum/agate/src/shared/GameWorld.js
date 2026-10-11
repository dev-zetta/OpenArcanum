// @flow

import GameMap from './map/GameMap'
import type GameEngine from './GameEngine'
import Location from './Location';
import Entity from './entity/Entity';
import AiSystem from './entity/ai/System';
import Manager from './entity/Manager';

//import SimplePhysicsEngine from './physics/SimplePhysicsEngine'
import type AssetLoader from './assets/AssetLoader'
import type EventEmitter from './misc/EventEmitter'

/**
 * This class represents an instance of the game world,
 * where all data pertaining to the current state of the
 * world is saved.
 */
export default class GameWorld {
  id: string
  gameEngine: GameEngine
  entityManager: Manager
  aiSystem: AiSystem
  maps: Map<string, GameMap>
  settings: Object

  stepCount: number


  /**
   * Constructor of the World instance
   */
  constructor(gameEngine: GameEngine, settings: Object) {
    this.id = settings.id ? settings.id : 'default'

    this.gameEngine = gameEngine
    this.settings = settings

    this.aiSystem = new AiSystem(this)
    this.entityManager = new Manager(gameEngine)

    this.stepCount = 0


    /*this.physicsEngine = new SimplePhysicsEngine({
  gameEngine: this,
  collisions: {
    type: `brute`
  }
})*/

    this.events.on(`Map:Loading`, this.onMapLoading, this)
    this.events.on(`Map:Loaded`, this.onMapLoaded, this)
    this.events.on(`Map:NewEntity`, this.onNewEntity, this)



    this.maps = new Map()
  }

  /**
   *
   * @returns {AssetLoader}
   */
  get assetLoader(): AssetLoader {
    return this.gameEngine.assetLoader
  }

  /**
   *
   * @returns {EventEmitter}
   */
  get events(): EventEmitter {
    return this.gameEngine.events
  }

  get trace(): Trace {
    return this.gameEngine.trace
  }

  /**
   *
   * @param location
   * @returns {*}
   */
  findMapByLocation(location: Location): ?GameMap {
    for (const [id, map] of this.maps) {
      return map // TODO
    }
  }

  /**
   *
   * @param id
   * @returns {GameMap<>}
   */
  getMap(id: string): ?GameMap {
    return this.maps.get(id)
  }

  /**
   *
   * @param options
   * @returns {GameMap}
   */
  mapFactory(options: Object): GameMap {
    return new GameMap(this, options.id)
  }

  /**
   *
   * @returns {Promise<*>}
   * @param options
   */
  addMap(options: Object) {
    const map = this.mapFactory(options)
    this.maps.set(options.id, map)

    return map
  }

  /**
   *
   * @param id
   * @returns {Promise<null>}
   */
  async loadMap(id: string): Promise<?GameMap> {
    let path = AGate.getDataPath(id)
    const map = this.maps.get(id) || this.addMap({ id })
    await map.load(path)
    return map
  }


  /**
   * Add an object to the game world
   * @param {Object} object object to add
   */
  addObject(object) {
    object.onAddToWorld(this)
  }

  /**
   * Remove an object from the game world
   * @param {number} id id of the object to remove
   */
  removeObject(id) {
      //object.onRemoveFromWorld(this)
  }

  /**
   *
   * @returns {*}
   */
  getDynamicEntities(): Map<string, Entity> {
    return this.entityManager.getDynamicEntities()
  }

  /**
   *
   * @param id
   * @returns {?Entity}
   */
  getDynamicEntity(id: string): ?Entity {
    return this.entityManager.getDynamicEntity(id)
  }

  /**
   *
   * @param location
   * @returns {Promise<Entity>}
   */
  async addPlayer(location: Location): Promise<Entity> {
    let player = await this.loadPlayer()

    if (location && player[`Base`]) {
      player[`Base`].location = Location.transformToRaw(location)
    }

    //await this.sectors.load(location.sectorX, location.sectorY)

    let id = `0` // AGate.Utils.getFileBase(path)
    let entity = await this.entityManager.newEntity(id, player)

    const map = this.findMapByLocation(location)
    if (!map) throw new Error('Player requires a loaded map')
    entity.map = map
    const sector = map.getSectorFromLocation(entity.base.location)
    if (!sector) throw new Error('Player start sector is not loaded')
    sector.addEntity(entity)
    return entity
  }


  /**
   *
   * @returns {Promise<*>}
   */
  async loadPlayer(): Entity {
    let file = `16086.json`
    let path = AGate.getAppPath(file)

    let data = await this.assetLoader.loadJsonFile(path)

    if (!data || !data.Base) throw new Error(`Missing converted actor: ${file}`)
    return data
  }


  /**
   *
   * @param settings
   * @returns {Promise<void>}
   */
  async init(settings: Object) {
    await this.entityManager.loadPrototypes()
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async start() {
    this.entityManager.start()
  }

  /**
   *
   */
  async update(params: Object) {
    // if (!this.isLoaded) {
    //   return
    // }

    /*let promises = []
    for (let col = 0; col < this.height; col++) {
      for (let row = 0; row < this.width; row++) {
        let sector = this.sectors[col][row]
        if (!sector) {
          continue
        }

        promises.push(sector.update())
      }
    }

    await Promise.all(promises)
*/

    // for each object
    // - apply incremental bending
    // - refresh object positions after physics
    const entities = this.getDynamicEntities()
    for (const [id, entity] of entities) {
      if (typeof entity.refreshFromPhysics === `function`) {
        entity.refreshFromPhysics()
      }

      this.trace.trace(
        () =>
          `object[${entity.id}] after ${
            state.isReenact ? `reenact` : `step`
            } : ${entity.toString()}`
      )
    }

    await this.entityManager.update()
  }


  /**
   *
   * @param map
   */
  onMapLoading(map: GameMap) {

  }

  /**
   *
   * @param map
   */
  onMapLoaded(map: GameMap) {

  }

  /**
   *
   * @param map
   * @param entity
   */
  onNewEntity(map: GameMap, entity: Entity) {
    entity.onAddToWorld(this)
  }
}

