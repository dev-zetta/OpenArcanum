//@flow

import Manager from '../entity/Manager'
import Location from '../Location'
import Sector from './Sector'

import PathFind from './PathFind'

import Entity from '../entity/Entity'

import { SectorGrid } from './SectorGrid'
import Utils from '../misc/Utils'

import * as Enums from '../entity/Enums'
import GameWorld from '../GameWorld'

import type GameEngine from '../GameEngine'
import type AssetLoader from '../assets/AssetLoader'
import type EventEmitter from '../misc/EventEmitter'

export default class GameMap {
  id: string
  world: GameWorld
  pathFind: PathFind

  isLoaded: boolean
  isLoading: boolean
  width: number
  height: number
  sectors: SectorGrid
  center: Location
  path: string
  name: string
  width: number
  height: number

  /**
   *
   * @param world
   * @param id
   */
  constructor(world: GameWorld, id: string) {
    this.world = world
    this.id = id

    this.pathFind = new PathFind(this)
    this.isLoaded = false

    this.sectors = new SectorGrid(this)
  }

  /**
   *
   * @returns {GameEngine}
   */
  get gameEngine(): GameEngine {
    return this.world.gameEngine
  }

  /**
   *
   * @returns {Manager}
   */
  get entityManager(): Manager {
    return this.world.entityManager
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

  /**
   *
   * @returns {number[]}
   */
  getCenterLocation(): Location {
    return this.center
  }

  /**
   *
   * @returns {number[]}
   */
  getStartLocation(): Location {
    return new Location(92, 99)
  }

  /**
   *
   * @param x
   * @param y
   * @returns {string}
   */
  getSectorPath(x: number, y: number): string {
    return `${this.path}/Sector/${x}/${y}`
  }

  /**
   *
   * @param path
   * @returns {Promise<boolean>}
   */
  async load(path: string): Promise<boolean> {
    this.path = path
    this.name = ``
    this.isLoading = true
    this.isLoaded = false

    this.events.emit(`Map:Loading`, this)

    console.info(`Loading map: ${path}`)
    let data = await this.assetLoader.loadJsonFile(`${path}/Map.json`)

    if (!data || !Number.isInteger(data.width) || !Number.isInteger(data.height) || data.width < 1 || data.height < 1) {
      throw new Error(`Invalid or missing converted map: ${path}/Map.json`)
    }
    this.width = data.width
    this.height = data.height
    this.center = new Location([(this.width / 2) * 64, (this.height / 2) * 64])

    this.sectors.clear()

    /*let promises = []
    for (let col = 0; col < this.height; col++) {
      this.sectors[col] = []
      for (let row = 0; row < this.width; row++) {
        promises.push(this.loadSector(row, col))
      }
    }

    await Promise.all(promises)
*/

    await this.sectors.load(this.center.sectorX, this.center.sectorY)

    this.isLoading = false
    this.isLoaded = true

    this.events.emit(`Map:Loaded`, this)
    return true
  }

  /**
   *
   * @param x
   * @param y
   * @returns {Promise<void>}
   */
  async loadSector(x: number, y: number): Promise<Sector> {
    let sector = new Sector(this)
    // The original converter writes Sector/y/x; world coordinates stay x/y.
    await sector.load(this.getSectorPath(y, x), x, y)
    return sector
  }

  /**
   *
   * @param path
   * @param target
   * @returns {Promise<void>}
   */
  async loadEntities(path: string, target: Function | Object) {
    console.debug(`Loading entities: ${path}`)

    let entityTypes = await this.assetLoader.findDirs(`${path}/`)

    let dirFiles = []
    for (let [key, value] of entityTypes) {
      dirFiles.push(this.assetLoader.findFiles(`${path}/${key}`, `.json`))
    }

    dirFiles = await Promise.all(dirFiles)

    let entityList = []
    for (let entityFiles of dirFiles) {
      for (let [key, value] of entityFiles) {
        entityList.push(this.loadEntity(value.name))
      }
    }

    entityList = await Promise.all(entityList)

    for (let entity of entityList) {
      if (typeof target === `function`) {
        target(entity)
      } else {
        target.addEntity(entity)
      }
    }
  }

  /**
   *
   * @param path
   * @returns {Promise<Entity>}
   */
  async loadEntity(path: string) {
    //AGate.Utils.logError(`Loading entity: ${path}`)

    let data = await this.assetLoader.loadJsonFile(`${path}`)

    let id = Utils.getFileBase(path)
    let entity = await this.entityManager.newEntity(id, data)
    entity.map = this

    this.events.emit('Map:NewEntity', this, entity)

    return entity
  }

  /**
   *
   * @param location/x
   * @param y
   * @returns {boolean}
   */
  isTileBlocked(location: Location|number, y: number): boolean {

    if (!(location instanceof Location)) {
      location = new Location(location, y)
    }

    let sector = this.getSectorFromLocation(location)
    if (!sector) {
      return true
    }

    let tile = sector.getTileFromLocation(location)
    if (!tile) {
      lll(`tile not found`)
      return true
    }

    if (!tile.type || tile.blocked) {
      return true
    }

    const entities = sector.getTileEntities(tile, [Enums.Entity.Wall, Enums.Entity.Portal,
      Enums.Entity.Npc, Enums.Entity.Pc, Enums.Entity.Scenery, Enums.Entity.Container])
    for (const entity of Object.values(entities)) {
      if (entity.base.flags.hasAny(['Inventory', 'Off', 'Destroyed', 'NoBlock'])) continue
      // Until portal state and interactions are implemented, a closed/unknown
      // portal and occupied object tiles are conservatively nonwalkable.
      return true
    }

    return false
  }

  /**
   *
   * @param x
   * @param y
   * @returns {*}
   */
  getSector(x: number, y: number): Sector {
    return this.sectors.get(x, y)
  }

  /**
   *
   * @param location
   * @returns {Sector}
   */
  getSectorFromLocation(location) {
    return this.getSector(location.sectorX, location.sectorY)
  }

  /**
   *
   * @param x
   * @param y
   * @returns {*}
   */
  getTile(x: number, y: number): Object {
    let location = new Location(x, y)

    let sector = this.getSectorFromLocation(location)
    if (!sector) {
      return null
    }

    return sector.getTileFromLocation(location)
  }

  /**
   *
   */
  getActiveSectors(): Array<Sector> {
    return this.sectors.getAll()
  }

  /**
   *
   * @param options
   * @returns {Array}
   */
  getEntitiesInRange(options: Object): Array<Entity> {
    let { types, center, range, ignore, filter } = options

    let names = []
    if (types) {
      for (let i = 0; i < types.length; i++) {
        let name = String(types[i])
        names.push(name)
      }
    }

    let tilesX = this.width * Sector.Width
    let startX = center.x - range
    let endX = center.x + range

    if (startX < 0) {
      startX = 0
    }

    if (endX >= tilesX) {
      endX = tilesX - 1
    }

    let tilesY = this.height * Sector.Height
    let startY = center.y - range
    let endY = center.y + range

    if (startY < 0) {
      startY = 0
    }

    if (endY >= tilesY) {
      endY = tilesY - 1
    }

    let result = []
    for (let y = startY; y <= endY; y++) {
      let tileY = y % Sector.Height
      let sectorY = Math.floor(y / Sector.Height)

      for (let x = startX; x <= endX; x++) {
        let tileX = x % Sector.Width
        let sectorX = Math.floor(x / Sector.Width)

        let sector = this.getSector(sectorX, sectorY)
        if (!sector) {
          continue
        }

        let tile = sector.getTile(tileX, tileY)
        if (!tile) {
          continue
        }

        if (types) {
            // Has tile the entity of given type
            let entityList = sector.getTileEntities(tile, names)
            if (!entityList) {
              continue
            }
            for (let id in entityList) {
              let entity = entityList[id]

              // Is entity being ignored?
              if (ignore) {
                let ignored = false
                for (let other of ignore) {
                  if (other.id == entity.id) {
                    ignored = true
                    break
                  }
                }

                if (ignored) {
                  continue
                }
              }

              if (filter && !filter(entity)) {
                continue
              }

              // Put entity into list
              entity._distanceToCenter = center.distanceTo(
                entity.base.location
              )
              result.push(entity)
            }
        } else {
          //tile
          debugger
        }
      }
    }

    result.sort((a, b) => a._distanceToCenter - b._distanceToCenter) // sort, from shorter distance to longer

    return result
  }


  /**
   * Returns all the game world objects which match a criteria
   * @param {Object} query The query object
   * @param {Object} [query.id] object id
   * @param {Object} [query.playerId] player id
   * @param {Class} [query.instanceType] matches whether `object instanceof instanceType`
   * @param {Array} [query.components] An array of component names
   * @param {Boolean} [query.returnSingle] Return the first object matched
   * @returns {Array} All game objects which match all the query parameters
   */
  queryEntities(query: Object): Array<Entity> {
    let queriedObjects = []

    for (const type in query) {
      const params = query[type]

      let entity = null
      switch (type) {
        case 'id': {
          entity = this.entityManager.getEntityById(params)
          break
        }
      }

      if (entity) {
        queriedObjects.push(entity)
      }
    }

    return queriedObjects
  }

  /**
   * Returns The first game object encountered which matches a criteria.
   * Syntactic sugar for {@link queryObject} with `returnSingle: true`
   * @param query See queryObjects
   * @returns {Entity}
   */
  queryEntity(query: Object): ?Entity {
    const result = this.queryEntities(
      Object.assign(query, {
        returnSingle: true
      })
    )

    return result.length ? result[0] : null
  }

  /**
   *
   * @param entity
   * @param origin
   * @param target
   */
  moveEntity(entity: Entity, origin: Location, target: Location) {
    //lll(`moving entity to different tile`, { entity, origin, target })

    const ex = origin.sectorX
    const ey = origin.sectorY
    const wx = target.sectorX
    const wy = target.sectorY

    let originSector = this.getSector(ex, ey)
    let targetSector = this.getSector(wx, wy)

    if (ex !== wx || ey !== wy) {
      this.events.emit(`Entity:MoveToSector`, {
        entity,
        originSector,
        targetSector
      })
      /*entity.onSectorLeave(originSector)
      entity.onSectorEnter(targetSector)

      originSector.onEntityLeave(entity)
      targetSector.onEntityEnter(entity)*/
    }

    let originTile = originSector.getTileFromLocation(origin)
    let targetTile = targetSector.getTileFromLocation(target)

    originSector.removeEntityFromTile(originTile, entity)
    targetSector.addEntityToTile(targetTile, entity)
  }


}
