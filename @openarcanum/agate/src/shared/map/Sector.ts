export interface Tile {
  type?: unknown
  blocked?: boolean
  location?: Location
  [key: string]: unknown
}
export interface SectorDocument { tiles: (Tile | null | undefined)[][]; lights?: Record<string, unknown>[]; roofs?: unknown[]; roof?: unknown[] }
import type GameMap from './GameMap'
import type Entity from '../entity/Entity'
import type GameEngine from '../GameEngine'
import type AssetLoader from '../assets/AssetLoader'
import type EventEmitter from '../misc/EventEmitter'

import Location from '../Location'

export default class Sector {
  declare map: GameMap
  declare gameEngine: GameEngine
  declare tiles: (Tile | null | undefined)[][]
  declare roofs: unknown[]
  declare lights: Array<Record<string, unknown>>
  declare entities: Map<string, Entity>
  declare id: string
  declare x: number
  declare y: number

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
  getTile(x: number, y: number): Tile | null | undefined {
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
  addEntity(entity: Entity, location: Location | null | undefined = null) {
    if (this.entities.has(entity.id)) {
      lll(`Duplicate entity!!! ${entity.id}`, entity)

      return false
    }

    if (!location) {
      location = entity.base.location
    }

    let tile = this.getTileFromLocation(location)

    if (!tile) throw new Error('Entity requires a loaded tile')
    this.addEntityToTile(tile, entity)

    this.entities.set(entity.id, entity)
  }

  /**
   *
   * @param tile
   * @param types
   * @returns {*}
   */
  getTileEntities(tile: Tile, types: (string | import("../misc/Enum").EnumItem)[]): Record<string, Entity> {
    let result: Record<string, Entity> = {}
    for (const type of types) {
      const list = tile[String(type)] as Record<string, Entity> | undefined
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
  addEntityToTile(tile: Tile, entity: Entity) {
    let name = String(entity.base.type)
    if (!tile[name]) {
      tile[name] = {
        //count: 0
      }
      //lll(`Replacing entity: ${name}`)
    }

    (tile[name] as Record<string, Entity>)[entity.id] = entity
    //tile[name].count++
  }

  /**
   *
   * @param tile
   * @param entity
   */
  removeEntityFromTile(tile: Tile, entity: Entity) {
    let name = String(entity.base.type)
    if (!tile[name] || !(tile[name] as Record<string, Entity>)[entity.id]) {
      lll(`entity not found`)
      return
    }

    delete (tile[name] as Record<string, Entity>)[entity.id]
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

    let data = await this.assetLoader.loadJsonFile(`${path}/Sector.json`) as SectorDocument | null
    ///lll(`...Loaded`)

    if (!data || !Array.isArray(data.tiles)) {
      throw new Error(`Invalid or missing converted sector: ${path}/Sector.json`)
    }

    // The legacy converter keeps SEC tile rows in original y/x order, but
    // reverses the packed x/y location of every entity and light. Runtime
    // coordinates follow those entities, so transpose whole tiles (including
    // blocking flags) rather than reflecting only their rendered positions.
    // AssetLoader caches JSON; locations, sprites and occupants belong to this
    // sector instance and must never be attached to the cached source objects.
    const sourceTiles = structuredClone(data.tiles)
    this.tiles = Array.from({ length: Sector.Height }, (_, ty) =>
      Array.from({ length: Sector.Width }, (_, tx) => sourceTiles[tx]?.[ty])
    )
    this.x = x
    this.y = y
    this.id = Sector.makeId(x, y)

    // Light locations already use the converter's reversed entity axes.
    this.lights = structuredClone(data.lights || [])
    const sourceRoofs = structuredClone(data.roofs || data.roof || [])
    // Older archives contain null rows where roof conversion failed. Preserve
    // that missing data; transpose only an actual roof grid, without inventing
    // roof graphics or enabling the unfinished roof renderer.
    this.roofs = sourceRoofs.some(Array.isArray)
      ? Array.from({ length: sourceRoofs.length }, (_, ry) =>
          Array.from({ length: sourceRoofs.length }, (_, rx) => (sourceRoofs[rx] as unknown[] | null)?.[ry])
        )
      : sourceRoofs

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
  inspectTiles(callback: (tile: Tile | null | undefined, x: number, y: number) => unknown) {
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
