import AGate from '../agate';
import Phaser from '../libs/phaser';

import {EntitySystem} from './EntitySystem';
import {Sprite} from '../client/Sprite';
import {Location} from './Location';
import {Sector} from './Sector';
import {AiSystem} from './entity/ai/AiSystem';
import {PathFind} from './PathFind';

export class GameMap {

  constructor(engine) {
    this.engine = engine;
    this.entitySystem = new EntitySystem(this);
    this.aiSystem = new AiSystem(this);
    this.pathFind = new PathFind(this);

    this.isLoaded = false;
  }

  async load(path) {
    this.path = path;
    this.name = '';
    this.isLoading = true;
    this.isLoaded = false;

    this.engine.onMapLoading(this);

    AGate.Utils.logError(`Loading map: ${path}`);
    let data = await this.engine.assetLoader.loadJsonFile(`${path}/Map.json`);

    this.width = data.width;
    this.height = data.height;
    this.sectors = [];

    for (let col = 0; col < this.height; col++) {
      this.sectors[col] = [];
      for (let row = 0; row < this.width; row++) {


        //if (row == 7 && col == 0) {
          //this.engine.workerPool.exec()
          let sector = new Sector(this);
          await sector.load(this.getSectorPath(col, row), col, row);
          this.sectors[col][row] = sector;
        //}


      }
    }

    //this.mobileEntities = [];
    //await this.loadEntities(`${path}/Mobile`, this.mobileEntities);

    this.engine.onMapLoaded(this);
    this.isLoading = false;
    this.isLoaded = true;
  }

  async loadEntities(path, onLoaded) {
    AGate.Utils.logError(`Loading entities...`);

    let entityTypes = await this.engine.assetLoader.findDirs(`${path}/`);

    for (let [key, value] of entityTypes) {
      let entityFiles = await this.engine.assetLoader.findFiles(`${path}/${key}`, '.json');

      for (let [key, value] of entityFiles) {
        let entity = await this.loadEntity(value.name)
        onLoaded(entity);
      }
    }
  }

  async loadEntity(path) {
    AGate.Utils.logError(`Loading entity: ${path}`);

    let data = await this.engine.assetLoader.loadJsonFile(`${path}`);

    let id = AGate.Utils.getFileBase(path);
    let entity = await this.entitySystem.newEntity(id, data);

    return entity;
  }

  placeToScene(target) {
    AGate.Utils.logError(`Placing to scene: ${this.path}`);

    this.rootGroup = target.add.group();
    this.rootGroup.autoCull = true;

    let sortGroups = [];

    for (let col = 0; col < this.height; col++) {
      for (let row = 0; row < this.width; row++) {
        let sector = this.sectors[col][row];

        if (sector) {
          sector.placeToScene(this.rootGroup);
          sortGroups.push(sector.staticGroup);
        }
      }
    }

    /*this.mobileGroup = target.add.group();
    this.mobileGroup.autoCull = true;

    this.mobileEntities.forEach((entity, index, array) => {
      AGate.Utils.logError(`Placing mobile: ${entity.id}`);
      entity.placeToScene(this.mobileGroup);
    });

    sortGroups.push(this.mobileGroup);*/

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

        sector.update();
      }
    }

    /*if (!this.isLoaded && !AGate.Utils.isUndefined(this.path)) {
        this.isLoaded = !this.engine.client.game.load.isLoading

        if (this.isLoaded)
            this.engine.onMapLoaded(this)
    }*/

    this.entitySystem.update();

  }

  getSectorPath(x, y) {
    return `${this.path}/Sector/${x}/${y}`;
  }

  getTile(location) {
    if (AGate.Utils.isArray(location))
      location = new Location(location);

    let col = this.sectors[location.sectorY];
    if (!col)
      return null;

    let sector = col[location.sectorX];
    if (!sector)
      return null;

    return sector.getTile(sector.tileX, sector.tileY);
  }

  getObjectInRange(types, center, range) {

    let names = [];
    if (types) {
      for (let i = 0; i < types.length; i++) {
        let name = AGate.Utils.camelCase(String(types[i]));
        names.push(name);
      }
    }


    let tilesX = this.width * Sector.Width;
    let startX = center[0] - range;
    let endX = center[0] + range;

    if (startX < 0)
      startX = 0;

    if (endX >= tilesX)
      endX = tilesX - 1;

    let tilesY = this.height * Sector.Height;
    let startY = center[1] - range;
    let endY = center[1] + range;

    if (startY < 0)
      startY = 0;

    if (endY >= tilesY)
      endY = tilesY - 1;

    let result = new Map();
    for (let y = startY; y <= endY; y++) {
      let tileY = y % Sector.Height;
      let sectorY = Math.floor(y / Sector.Height);

      for (let x = startX; x <= endX; x++) {
        let tileX = x % Sector.Width;
        let sectorX = Math.floor(x / Sector.Width);


        let sector = this.sectors[sectorY][sectorX];

        let tile = sector.getTile(tileX, tileY);
        if (!tile)
          continue;

        if (types) {
          for (let i = 0; i < names.length; i++) {
            let entity = tile[names[i]];
            if (entity) {
              result.push(entity.id, entity);
            }
          }
        } else {
          //tile
          alert('error')
        }


      }
    }


  }


}
