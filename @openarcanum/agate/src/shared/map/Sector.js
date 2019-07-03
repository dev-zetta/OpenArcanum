//@flow

import Location from '../Location'
import Utils from '../misc/Utils'

import type GameMap from './GameMap'
import type Entity from '../entity/Entity'
import type GameEngine from '../GameEngine'

import type AssetLoader from '../assets/AssetLoader';
import type EventEmitter from '../misc/EventEmitter';

export default class Sector {
  static get TileWidth(): number {
    return 78
  }
  static get TileWidthHalf(): number {
    return 39
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

  onTileLoad: ?Function // switch to events?


  /**
   *
   * @param map
   */
  constructor(map: GameMap) {
    this.map = map
    this.gameEngine = map.gameEngine

    this.onTileLoad = null
    this.onEntityLoad = null
  }

  get assetLoader(): AssetLoader {
    return this.gameEngine.assetLoader
  }

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
    return !tile || tile.blocked
  }

  /**
   *
   * @param x
   * @param y
   * @returns {*}
   */
  getTile(x: number, y: number): Object {
    if (!this.tiles) {
      return null
    }

    let tile = this.tiles[y][x]
    return tile
  }

  /**
   *
   * @param entity
   * @returns {boolean}
   */
  addEntity(entity: Entity) {
    if (this.entities.has(entity.id)) {
      lll(`Duplicate entity!!! ${entity.id}`, entity)

      return false
    }

    let location = entity.base.location

    let tile = this.getTile(location.tileX, location.tileY)

    let name = Utils.camelCase(entity.base.type)
    if (!tile[name]) {
      tile[name] = []
      //lll(`Replacing entity: ${name}`)
    }

    tile[name].push(entity)

    this.entities.set(entity.id, entity)
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
    lll(`...Loaded`)

    if (!data.tiles) {
      return
    }

    this.tiles = data.tiles
    this.x = x
    this.y = y
    this.id = Sector.makeId(x, y)

    this.lights = data.lights
    this.roofs = data.roofs

    this.events.emit('Sector:Loading', this)

    for (let ty = 0; ty < Sector.Height; ty++) {
      for (let tx = 0; tx < Sector.Width; tx++) {
        let tile = this.getTile(tx, ty)
        if (!tile) {
          continue
        }

        tile.location = Location.make(x, y, tx, ty)

        if (this.onTileLoad) {
          await this.onTileLoad(tile)
        }

        //this.events.emit('Sector:TileLoading', tile)
      }
    }

    this.entities = new Map()
    await this.map.loadEntities(path, this)

    this.events.emit('Sector:Loaded', this)
  }

  /**
   *
   */
  async update() {
    if (!this.tiles) {
      return
    }

    // Loop through all tiles and test to see if the 3D position from above intersects with the automatically generated IsoSprite tile bounds.
    /*var cursorPos = this.gameEngine.client.scene.cursorPos;

    if (!AGate.Utils.isUndefined(this.tileGroup)) {

        this.tileGroup.getChildren().forEach((tile) => {
            var inBounds = tile.isoBounds.containsXY(cursorPos.x, cursorPos.y);
            // If it does, do a little animation and tint change.
            if (inBounds) {
                //tile.selected = true;
                tile.tint = 0x86bfda;
                //self.tweens(tile).to({ isoZ: 4 }, 200, Phaser.Easing.Quadratic.InOut, true);
            }
            // If not, revert back to how it was.
            else if (!inBounds) {
                //tile.selected = false;
                tile.tint = 0xffffff;
                //self.add.tween(tile).to({ isoZ: 0 }, 200, Phaser.Easing.Quadratic.InOut, true);
            }
        });


      for (let y = 0; y < Sector.Height; y++) {
        for (let x = 0; x < Sector.Width; x++) {
          let tile = this.getTile(x, y);

          //tile.sprite.sprite.debug();
        }
      }
    }*/
  }
}
