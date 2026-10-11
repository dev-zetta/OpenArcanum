//@flow

import Location from '../Location'

import type GameMap from './GameMap'
import type Entity from '../entity/Entity'
import type GameEngine from '../GameEngine'

import type AssetLoader from '../assets/AssetLoader'
import type EventEmitter from '../misc/EventEmitter'

export default class Sector {
  static get TileWidth(): number {
    return 80
  }
  static get TileWidthHalf(): number {
    return 40
  }

  static get TileHeight(): number {
    return 40
  }

  static get TileHeightHalf(): number {
    return 20
  }

  static get Width(): number {
    return 64
  }
  static get Height(): number {
    return 64
  }

  map: GameMap
  gameEngine: GameEngine
  tiles: Array<Array<Object>>
  roofs: Array<Object>
  lights: Array<Object>
  entities: Map<string, Entity>

  id: string
  x: number
  y: number

  /**
   *
   * @param map
   */
  constructor(map: GameMap) {
    this.map = map
    this.gameEngine = map.gameEngine

    //this.onEntityLoad = null
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
   * @param x
   * @param y
   * @returns {string}
   */
  static makeId(x: number, y: number): string {
    return `${x}x${y}` // (y *  this.height) + this.width
  }

  /**
   *
   * @param x
   * @param y
   * @returns {boolean|Event|*}
   */
  isTileBlocked(x: number, y: number): boolean {
    let tile = this.getTile(x, y)
    if (!tile || tile.blocked) {
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
  getTile(x: number, y: number): Object {
    if (!this.tiles || !this.tiles[y]) {
      return null
    }

    let tile = this.tiles[y][x]
    return tile
  }

  /**
   *
   * @returns {Object}
   * @param location
   */
  getTileFromLocation(location: Location) {
    return this.getTile(location.tileX, location.tileY)
  }

  /**
   *
   * @param entity
   * @param location
   * @returns {boolean}
   */
  addEntity(entity: Entity, location: ?Location = null) {
    if (this.entities.has(entity.id)) {
      lll(`Duplicate entity!!! ${entity.id}`, entity)

      return false
    }

    if (!location) {
      location = entity.base.location
    }

    let tile = this.getTileFromLocation(location)

    this.addEntityToTile(tile, entity)

    this.entities.set(entity.id, entity)
  }

  /**
   *
   * @param tile
   * @param types
   * @returns {*}
   */
  getTileEntities(tile: Object, types: Array<string>): Object {
    let result = {}
    for (const type of types) {
      const list = tile[String(type)]
      if (!list) {
        continue
      }

      for (const id in list) {
        result[id] = list[id]
      }
    }

    return result
  }

  /**
   *
   * @param tile
   * @param entity
   */
  addEntityToTile(tile: Object, entity: Entity) {
    let name = String(entity.base.type)
    if (!tile[name]) {
      tile[name] = {
        //count: 0
      }
      //lll(`Replacing entity: ${name}`)
    }

    tile[name][entity.id] = entity
    //tile[name].count++
  }

  /**
   *
   * @param tile
   * @param entity
   */
  removeEntityFromTile(tile: Object, entity: Entity) {
    let name = String(entity.base.type)
    if (!tile[name] || !tile[name][entity.id]) {
      lll(`entity not found`)
      return
    }

    delete tile[name][entity.id]
    //tile[name].count--
  }

  /**
   *
   * @param path
   * @param x
   * @param y
   * @returns {Promise<void>}
   */
  async load(path: string, x: number, y: number) {
    lll(`Loading sector: ${path}`)

    let data = await this.assetLoader.loadJsonFile(`${path}/Sector.json`)
    ///lll(`...Loaded`)

    if (!data || !Array.isArray(data.tiles)) {
      throw new Error(`Invalid or missing converted sector: ${path}/Sector.json`)
    }

    this.tiles = data.tiles
    this.x = x
    this.y = y
    this.id = Sector.makeId(x, y)

    this.lights = data.lights
    this.roofs = data.roofs || data.roof || []

    this.events.emit(`Sector:Loading`, this)

    for (let ty = 0; ty < Sector.Height; ty++) {
      for (let tx = 0; tx < Sector.Width; tx++) {
        let tile = this.getTile(tx, ty)
        if (!tile) {
          continue
        }

        tile.location = Location.make(x, y, tx, ty)

        // if (this.onTileLoad) {
        //   await this.onTileLoad(tile)
        // }

        //this.events.emit('Sector:TileLoading', tile)
      }
    }

    this.entities = new Map()
    await this.map.loadEntities(path, this)

    this.events.emit(`Sector:Loaded`, this)
  }

  /**
   *
   * @param callback
   */
  inspectTiles(callback: Function) {
    for (let ty = 0; ty < Sector.Height; ty++) {
      for (let tx = 0; tx < Sector.Width; tx++) {
        let tile = this.getTile(tx, ty)
        if (callback(tile, tx, ty) === false) {
          return
        }
      }
    }
  }
}
