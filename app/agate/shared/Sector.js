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

  load(path, x, y) {
    AGate.Utils.logError(`Loading sector: ${path}`);

    let data = this.engine.assetLoader.loadJsonFile(`${path}/Sector.json`);

    this.x = x;
    this.y = y;
    this.tiles = data.tiles;
    this.lights = data.lights;
    this.roofs = data.roofs;

    this.tiles.forEach((col, colIndex, array1) => {
      col.forEach((row, rowIndex, array1) => {
        row.location = new Location(x * Sector.Width + rowIndex, y *
          Sector.Height + colIndex);

        if (this.engine.client) {
          row.sprite = new Sprite(this.engine.client);

          row.sprite.load(row);
          row.type = GfxTypes.get(row.type);
        }
      });
    });

    this.loadEntities(path);
  }

  loadEntities(path) {
    let entityTypes = AGate.Utils.findDirs(`${path}/`);
    this.entities = [];

    entityTypes.forEach((entityDir, iIndex, array1) => {

      let entityFiles = AGate.Utils.findFiles(`${entityDir}/`, '.json');

      entityFiles.forEach((entityFile, iIndex, array1) => {
        this.entities.push(
          this.loadEntity(entityFile),
        );
      });
    });
  }

  loadEntity(path) {
    AGate.Utils.logError(`Loading entity: ${path}`);

    let data = this.engine.assetLoader.loadJsonFile(`${path}`);
    let entity = this.map.entitySystem.newEntity(data);

    if (this.engine.client) {
      let visualComponent = entity.components['Visual'];
      if (visualComponent) {
        let visualClasses = visualComponent.classes;

        for (let className in visualClasses) {
          let visualClass = visualClasses[className];

          let sprite = new Sprite(this.engine.client);

          sprite.load(visualClass);
          visualClass.sprite = sprite;
        }
      }
    }

    return entity;
  }

  placeToScene(target) {
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

    this.staticGroup = new Phaser.GameObjects.Group(target.scene);
    target.add(this.staticGroup);

    this.entities.forEach((entity, iIndex, array1) => {
      let baseComponent = entity.components['Base'];
      var position = baseComponent.location.tile;

      this.tiles[position.y][position.x].entities.push(entity);

      let visualComponent = entity.components['Visual'];
      if (visualComponent) {
        let visualClass = visualComponent.classes['Current'];

        let offset = baseComponent.offset;
        let sprite = visualClass.sprite;
        let y = (position.x * 40);
        let x = (position.y * 40);

        //if (sprite.type == 'Portal')
          //console.log(sprite.currentStage)

        if (sprite.type === GfxTypes.Wall) {
          switch (sprite.currentStage) // Counter clockwise
          {
            case 'NorthEast':
              // South east, indoor (Up right)
              x -= 20; //(Sector.TileWidth / 2) - 1
              y -= 60; //(Sector.TileHeight / 2)
              break;
            case 'SouthEast':
              // South west, outdoor
              x -= 20;
              y -= 20;
              break;
            case 'SouthWest':
              // South east, outdoor (Down left)
              x -= 20;
              y += 20;
              break;

            case 'NorthWest':
              // South west, indoor (Up left)
              x -= 60; //(Sector.TileWidth / 2) + 1
              y -= 20; //(Sector.TileHeight / 2)
              break;
          }
        } else if (sprite.type === GfxTypes.Portal) {
          switch (sprite.side) // Counter clockwise
          {
            case 1:
              // South east, indoor (Up right)
              x -= 20; //(Sector.TileWidth / 2) - 1
              y -= 60; //(Sector.TileHeight / 2)
              break;
            case 3:
              // South west, outdoor
              x -= 20;
              y -= 20;
              break;
            case 5:
              // South east, outdoor (Down left)
              x -= 20;
              y += 20;
              break;

            case 7:
              // South west, indoor (Up left)
              x -= 60; //(Sector.TileWidth / 2) + 1
              y -= 20; //(Sector.TileHeight / 2)
              break;
          }
        } else {
          //offset.y += 10;
          offset.y -= 20;
        }

        sprite.addToScene(this.staticGroup, x, y, 0 /*position.y / 64 + position.x*/, offset);
        sprite.setData(entity);
      }
    });

    this.engine.client.scene.iso.topologicalSort(this.staticGroup)
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
