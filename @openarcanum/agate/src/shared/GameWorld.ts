import type Trace from './misc/Trace'
export interface RawEntityDocument { Base: Record<string, unknown>; [key: string]: Record<string, unknown> }
import type GameEngine from './GameEngine'
import type AssetLoader from './assets/AssetLoader'
import type EventEmitter from './misc/EventEmitter'

import GameMap from './map/GameMap'

import Location from './Location';
import Entity from './entity/Entity';
import AiSystem from './entity/ai/System';
import Manager from './entity/Manager';

//import SimplePhysicsEngine from './physics/SimplePhysicsEngine'

/**
 * This class represents an instance of the game world,
 * where all data pertaining to the current state of the
 * world is saved.
 */
export default class GameWorld {
  declare id: string
  declare gameEngine: GameEngine
  declare entityManager: Manager
  declare aiSystem: AiSystem
  declare maps: Map<string, GameMap>
  declare settings: { id?: string; [key: string]: unknown }
  declare stepCount: number


  /**
   * Constructor of the World instance
   */
  constructor(gameEngine: GameEngine, settings: { id?: string; [key: string]: unknown } = {}) {
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
  findMapByLocation(location: Location): GameMap | null | undefined {
    for (const [id, map] of this.maps) {
      return map // TODO
    }
  }

  /**
   *
   * @param id
   * @returns {GameMap<>}
   */
  getMap(id: string): GameMap | null | undefined {
    return this.maps.get(id)
  }

  /**
   *
   * @param options
   * @returns {GameMap}
   */
  mapFactory(options: { id: string }): GameMap {
    return new GameMap(this, options.id)
  }

  /**
   *
   * @returns {Promise<*>}
   * @param options
   */
  addMap(options: { id: string }) {
    const map = this.mapFactory(options)
    this.maps.set(options.id, map)

    return map
  }

  /**
   *
   * @param id
   * @returns {Promise<null>}
   */
  async loadMap(id: string): Promise<GameMap | null | undefined> {
    let path = AGate.getDataPath(id)
    const map = this.maps.get(id) || this.addMap({ id })
    await map.load(path)
    return map
  }

  /**
   * Add an object to the game world
   * @param {Object} object object to add
   */
  addObject(object: { onAddToWorld(world: GameWorld): unknown }) {
    object.onAddToWorld(this)
  }

  /**
   * Remove an object from the game world
   * @param {number} id id of the object to remove
   */
  removeObject(id: number) {
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
  getDynamicEntity(id: string): Entity | null | undefined {
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
    // The controlled actor uses a fixed content template outside map MOBs.
    // Identity does not imply recovered inventory when that metadata is absent.
    entity.sourcePath = '16086.json'

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
  async loadPlayer(): Promise<RawEntityDocument> {
    let file = `16086.json`
    let path = AGate.getAppPath(file)

    let data = await this.assetLoader.loadJsonFile(path) as RawEntityDocument | null

    if (!data || !data.Base) throw new Error(`Missing converted actor: ${file}`)
    return data
  }

  /**
   *
   * @param settings
   * @returns {Promise<void>}
   */
  async init(settings: { id?: string; [key: string]: unknown } = {}) {
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
  async update(params: Record<string, unknown>) {
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
            params.isReenact ? `reenact` : `step`
            } : ${entity.toString()}`
      )
    }

    await this.entityManager.update(0, 0)
  }

  moveEntity(entity: Entity, origin: { x: number; y: number }, target: { x: number; y: number }): void {
    entity.map.moveEntity(entity, origin instanceof Location ? origin : new Location(origin),
      target instanceof Location ? target : new Location(target))
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
