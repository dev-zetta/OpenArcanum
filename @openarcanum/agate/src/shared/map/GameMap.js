//@flow

import ComponentSystem from '../entity/ComponentSystem'
import Location from '../Location'
import Sector from './Sector'
import AiSystem from '../entity/ai/System'
import PathFind from '../PathFind'

import Entity from '../entity/Entity'

import { SectorGrid } from './SectorGrid'
import Utils from '../misc/Utils'

import type GameEngine from '../GameEngine'
import type AssetLoader from '../assets/AssetLoader'
import type EventEmitter from '../misc/EventEmitter'

export default class GameMap {
  engine: GameEngine
  entitySystem: ComponentSystem
  aiSystem: AiSystem
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

  constructor(engine: GameEngine) {
    this.engine = engine
    this.entitySystem = new ComponentSystem(this)
    this.aiSystem = new AiSystem(this)
    this.pathFind = new PathFind(this)
    this.isLoaded = false

    this.sectors = new SectorGrid(this)
  }

  get assetLoader(): AssetLoader {
    return this.engine.assetLoader
  }

  get events(): EventEmitter {
    return this.engine.events
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
   * @returns {Promise<void>}
   */
  async load(path: string) {
    this.path = path
    this.name = ``
    this.isLoading = true
    this.isLoaded = false

    this.events.emit(`Map:Loading`, this)

    await this.entitySystem.loadPrototypes()

    Utils.logError(`Loading map: ${path}`)
    let data = await this.assetLoader.loadJsonFile(`${path}/Map.json`)

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
  }

  /**
   *
   */
  async update(params: Object) {
    if (!this.isLoaded) {
      return
    }

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
    await this.entitySystem.update()
  }

  /**
   *
   * @param x
   * @param y
   * @returns {Promise<void>}
   */
  async loadSector(x: number, y: number): Promise<Sector> {
    let sector = new Sector(this)
    await sector.load(this.getSectorPath(y, x), y, x)
    return sector
  }

  /**
   *
   * @param path
   * @param target
   * @returns {Promise<void>}
   */
  async loadEntities(path: string, target: Function | Object) {
    Utils.logError(`Loading entities...`)

    let entityTypes = await this.assetLoader.findDirs(`${path}/`)

    for (let [key, value] of entityTypes) {
      let entityFiles = await this.assetLoader.findFiles(
        `${path}/${key}`,
        `.json`
      )

      for (let [key, value] of entityFiles) {
        let entity = await this.loadEntity(value.name)

        if (typeof target === `function`) {
          target(entity)
        } else {
          target.addEntity(entity)
        }
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
    let entity = await this.entitySystem.newEntity(id, data)

    //this.events.emit('Map.NewEntity', entity)
    if (this.onNewEntity) {
      await this.onNewEntity(entity)
    }

    return entity
  }

  /**
   *
   * @param x
   * @param y
   * @returns {boolean}
   */
  isTileBlocked(x: number, y: number): boolean {
    let tile = this.getTile(x, y)
    if (!tile) {
      return true
    }

    return tile.blocked
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
   * @param x
   * @param y
   * @returns {*}
   */
  getTile(x: number, y: number): Object {
    let location = new Location(x, y)

    let sector = this.getSector(location.sectorX, location.sectorY)
    if (!sector) {
      return null
    }

    return sector.getTile(location.tileX, location.tileY)
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
        let name = Utils.camelCase(String(types[i]))
        names.push(name)
      }
    }

    let tilesX = this.width * Sector.Width
    let startX = center[0] - range
    let endX = center[0] + range

    if (startX < 0) {
      startX = 0
    }

    if (endX >= tilesX) {
      endX = tilesX - 1
    }

    let tilesY = this.height * Sector.Height
    let startY = center[1] - range
    let endY = center[1] + range

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
          for (let i = 0; i < names.length; i++) {
            // Has tile the entity of given type
            let entity = tile[names[i]]
            if (!entity) {
              continue
            }

            // Is entity being ignored?
            if (ignore) {
              let ignored = false
              for (let other of ignore) {
                if (other.id === entity.id) {
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
            entity._distanceToCenter = Location.calculateDistance(
              entity.base.location,
              center
            )
            result.push(entity)
          }
        } else {
          //tile
          alert(`error`)
        }
      }
    }

    result.sort((a, b) => a._distanceToCenter - b._distanceToCenter)

    return result
  }

  /**
   *
   * @param location
   * @returns {Promise<Entity>}
   */
  async addPlayer(location: Location) {
    let player = await this.loadPlayer()

    if (location && player[`Base`]) {
      player[`Base`].location = Location.transformToRaw(location)
    }

    //await this.sectors.load(location.sectorX, location.sectorY)

    let id = undefined // AGate.Utils.getFileBase(path)
    let entity = await this.entitySystem.newEntity(id, player)
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

    return data
  }
}
