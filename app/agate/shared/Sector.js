import {Sprite} from '../client/Sprite';
import {Location} from './Location';
import Phaser from '../libs/phaser';
import AGate from '../agate';
import {GfxTypes} from './assets';

export class Sector {
  static get TileWidth() { return 78; }

  static get TileHeight() { return 40; }

  static get Width() { return 64; }

  static get Height() { return 64; }

  constructor(map) {
    this.map = map;
    this.engine = map.engine;
  }

  async load(path, x, y) {
    AGate.Utils.logError(`Loading sector: ${path}`);

    let data = await this.engine.assetLoader.loadJsonFile(`${path}/Sector.json`);
    AGate.Utils.logError(`...Loaded`);

    this.x = x;
    this.y = y;
    this.tiles = data.tiles;
    this.lights = data.lights;
    this.roofs = data.roofs;

    for (let ty = 0; ty < Sector.Height; ty++) {
      for (let tx = 0; tx < Sector.Width; tx++) {

        let tile = this.tiles[ty][tx];

        tile.location = new Location(x * Sector.Width + ty, y *
          Sector.Height + tx);

        if (this.engine.client) {
          tile.sprite = new Sprite(this.engine.client);

          await tile.sprite.load(tile);
          tile.type = GfxTypes.get(tile.type);
        }
      }
    }

    this.entities = [];
    await this.map.loadEntities(path, this.entities);
  }

  placeToScene(target) {

    // Add tiles
    this.tileGroup = new Phaser.GameObjects.Group(target.scene);
    target.add(this.tileGroup);

    for (let y = 0; y < Sector.Height; y++) {
      var dy = y * 40;
      for (let x = 0; x < Sector.Width; x++) {
        let dx = x * 40;
        let tile = this.tiles[y][x];

        if (tile.type === GfxTypes.Tile /*|| tile.type === 'Facade'*/) {
          let offset = {x: -39, y: -39};
          tile.sprite.addToScene(this.tileGroup, dy, dx, 0, offset);
        } else {
          tile.sprite.addToScene(this.tileGroup, dy, dx);
        }

        tile.sprite.setData(tile);

        /*if ((x % 2 == 0) || (y % 2 == 0)) {
          tile.sprite.sprite.setTint(0xaaaaaa);
        }*/

        tile.entities = [];
      }
    }

    /*this.tiles.forEach((col, colIndex, array1) => {
      col.forEach((row, rowIndex, array1) => {

        //let screen = row.location.worldToScreen()

      });
    });*/

    // Add static objects
    this.staticGroup = new Phaser.GameObjects.Group(target.scene);
    target.add(this.staticGroup);

    this.entities.forEach((entity, iIndex, array1) => {
      let baseComponent = entity.components['Base'];
      var position = baseComponent.location.tile;

      this.tiles[position.y][position.x].entities.push(entity);

      entity.placeToScene(this.staticGroup);
    });

    // Sort objects
    target.scene.sortGroup(this.staticGroup);
  }

  update() {
    // Loop through all tiles and test to see if the 3D position from above intersects with the automatically generated IsoSprite tile bounds.
    var cursorPos = this.engine.client.scene.cursorPos;

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
    }
  }

}
