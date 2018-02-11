import AGate from '../agate';
import Phaser from '../libs/phaser';

import {EntitySystem} from './EntitySystem';
import {Sprite} from '../client/Sprite';
import {Location} from './Location';
import {Sector} from './Sector';
import {Light} from '../client/Light';

export class GameMap {

  constructor(engine) {
    this.engine = engine;
    this.entitySystem = new EntitySystem(this);
    this.isLoaded = false;
  }

  async load(path) {
    this.path = path;
    this.name = '';
    this.isLoading = true;
    this.isLoaded = false;

    AGate.Utils.logError(`Loading map: ${path}`);
    let data = await this.engine.assetLoader.loadJsonFile(`${path}/Map.json`);

    this.width = data.width;
    this.height = data.height;
    this.sectors = [];

    for (let col = 0; col < this.height; col++) {
      this.sectors[col] = [];
      for (let row = 0; row < this.width; row++) {
        let sector = new Sector(this);

        if (row == 1 && col == 1) {
          //this.engine.workerPool.exec()

          await sector.load(this.getSectorPath(col, row), col, row);
        }

        this.sectors[col][row] = sector;
      }
    }

    this.mobileEntities = [];
    await this.loadEntities(`${path}/Mobile`, this.mobileEntities);

    this.engine.onMapLoading(this);
    this.isLoading = false;
  }

  async loadEntities(path, outputList) {
    AGate.Utils.logError(`Loading entities...`);

    let entityTypes = await this.engine.assetLoader.findDirs(`${path}/`);

    for(let i = 0; i < entityTypes.length; i++) {

      let entityFiles = await this.engine.assetLoader.findFiles(`${entityTypes[i]}/`, '.json');

      for (let j = 0; j < entityFiles.length; j++) {

        outputList.push(
          await this.loadEntity(entityFiles[j])
        );
      }
    }
  }

  async loadEntity(path) {
    AGate.Utils.logError(`Loading entity: ${path}`);

    let data = await this.engine.assetLoader.loadJsonFile(`${path}`);
    let entity = await this.entitySystem.newEntity(data);

    return entity;
  }

  placeToScene(target) {
    //console.log(Phaser.GameObjects);

    AGate.Utils.logError(`Placing to scene: ${this.path}`);

    this.rootGroup = target.add.group();
    this.rootGroup.autoCull = true;

    let sortGroups = [];

    for (let col = 0; col < this.height; col++) {
      for (let row = 0; row < this.width; row++) {
        let sector = this.sectors[col][row];

        if (row == 1 && col == 1) {
          sector.placeToScene(this.rootGroup);
          sortGroups.push(sector.staticGroup);
        }
      }
    }

    this.mobileGroup = target.add.group();
    this.mobileGroup.autoCull = true;

    this.mobileEntities.forEach((entity, index, array) => {
      AGate.Utils.logError(`Placing mobile: ${entity.id}`);
      entity.placeToScene(this.mobileGroup);
    });

    sortGroups.push(this.mobileGroup);

    this.engine.client.scene.sortGroups(sortGroups);
  }

  update() {
    if (!this.isLoaded)
      return;

    for (let col = 0; col < this.height; col++) {
      for (let row = 0; row < this.width; row++) {
        let sector = this.sectors[col][row];
        if(!sector)
          continue;

        if (row == 1 && col == 1)
          sector.update();
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
