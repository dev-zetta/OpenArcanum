import AGate from '../agate';
import Phaser from '../libs/phaser';

import {EntitySystem} from './EntitySystem';
import {Sprite} from '../client/Sprite';
import {Location} from './Location';
import {Sector} from './Sector';

export class GameMap {

  constructor(engine) {
    this.engine = engine;
    this.entitySystem = new EntitySystem(engine);
    this.isLoaded = false;
  }

  load(path) {
    this.path = path;
    this.name = '';
    this.isLoading = true;
    this.isLoaded = false;

    AGate.Utils.logError(`Loading map: ${path}`);
    this.engine.assetLoader.loadJsonFile(`${path}/Map.json`, (data) => {
      this.width = data.width;
      this.height = data.height;
      this.sectors = [];

      for (let col = 0; col < this.height; col++) {
        this.sectors[col] = [];
        for (let row = 0; row < this.width; row++) {
          let sector = new Sector(this);

          if (row == 1 && col == 1) {
            //this.engine.workerPool.exec()

            sector.load(this.getSectorPath(col, row), col, row);
          }

          this.sectors[col][row] = sector;
        }
      }

      this.engine.onMapLoading(this);
      this.isLoading = false;
    });
  }

  placeToScene(target) {
    AGate.Utils.logError(`Placing to scene: ${this.path}`);

    this.rootGroup = target.add.group();
    this.rootGroup.autoCull = true;

    for (let col = 0; col < this.height; col++) {
      for (let row = 0; row < this.width; row++) {
        if (row == 1 && col == 1)
          this.sectors[col][row].placeToScene(this.rootGroup);
      }
    }
  }

  update() {
    for (let col = 0; col < this.height; col++) {
      for (let row = 0; row < this.width; row++) {
        if (row == 1 && col == 1)
          this.sectors[col][row].update();
      }
    }

    /*if (!this.isLoaded && !AGate.Utils.isUndefined(this.path)) {
        this.isLoaded = !this.engine.client.game.load.isLoading

        if (this.isLoaded)
            this.engine.onMapLoaded(this)
    }*/

    //this.ecs.update()

  }

  getSectorPath(x, y) {
    return `${this.path}/Sector/${x}/${y}`;
  }
}
