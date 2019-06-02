/* global AGate */

import Sprite from '../../client/Sprite'
import Location from '../Location'

export default class Sector {
  static get TileWidth() {
    return 80
  }
  static get TileWidthHalf() {
    return 40
  }

  static get TileHeight() {
    return 40
  }
  static get TileHeightHalf() {
    return 20
  }

  static get Width() {
    return 64
  }
  static get Height() {
    return 64
  }

  constructor(map) {
    this.map = map
    this.engine = map.engine
  }

  /**
   *
   * @param x
   * @param y
   * @returns {*}
   */
  getTile(x, y) {
    if (!this.tiles) return null

    let tile = this.tiles[y][x]
    return tile
  }

  /**
   *
   * @param entity
   * @returns {boolean}
   */
  addEntity(entity) {
    if (this.entities.has(entity.id)) {
      console.log(`Replacing entity: ${entity.id}`)

      return false
    }

    let location = new Location(entity.base.location)

    let tile = this.getTile(location.tileX, location.tileY)

    let name = AGate.Utils.camelCase(entity.base.type)
    if (tile[name]) {
      //console.log(entity)
      console.log(`Replacing entity: ${name}`)
    }

    tile[name] = entity

    this.entities.set(entity.id, entity)
  }

  /**
   *
   * @param path
   * @param x
   * @param y
   * @returns {Promise<void>}
   */
  async load(path, x, y) {
    AGate.Utils.logError(`Loading sector: ${path}`)

    let data = await this.engine.assetLoader.loadJsonFile(`${path}/Sector.json`)
    AGate.Utils.logError(`...Loaded`)

    if (!data.tiles) {
      return
    }

    this.tiles = data.tiles
    this.x = x
    this.y = y

    this.lights = data.lights
    this.roofs = data.roofs

    for (let ty = 0; ty < Sector.Height; ty++) {
      for (let tx = 0; tx < Sector.Width; tx++) {
        let tile = this.getTile(tx, ty)
        if (!tile) {
          continue
        }

        tile.location = Location.makeRaw(x, y, tx, ty)

        if (this.engine.client && tile.type) {
          tile.sprite = new Sprite(this.engine.client)

          await tile.sprite.load(tile)
          //tile.type = GfxTypes.get(tile.type);
        }
      }
    }

    this.entities = new Map()
    await this.map.loadEntities(path, entity => {
      this.addEntity(entity)
    })
  }

  /**
   *
   */
  async update() {
    if (!this.tiles) {
      return
    }

    // Loop through all tiles and test to see if the 3D position from above intersects with the automatically generated IsoSprite tile bounds.
    /*var cursorPos = this.engine.client.scene.cursorPos;

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

  isTileBlocked(x, y) {
    let tile = this.getTile(x, y)
    return !tile || tile.blocked
  }
}
