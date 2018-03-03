/* global AGate */

import {EntitySystem} from '../EntitySystem';
import {Location} from '../Location';
import {Sector} from './Sector';
import {AiSystem} from '../entity/ai/AiSystem';
import {PathFind} from '../PathFind';

export class GameMap {

  constructor(engine) {
    this.engine = engine;
    this.entitySystem = new EntitySystem(this);
    this.aiSystem = new AiSystem(this);
    this.pathFind = new PathFind(this);

    this.isLoaded = false;
  }

  /**
   *
   * @param path
   * @returns {Promise<void>}
   */
  async load(path) {
    this.path = path;
    this.name = '';
    this.isLoading = true;
    this.isLoaded = false;

    this.engine.onMapLoading(this);

    await this.entitySystem.loadPrototypes();

    AGate.Utils.logError(`Loading map: ${path}`);
    let data = await this.engine.assetLoader.loadJsonFile(`${path}/Map.json`);

    this.width = data.width;
    this.height = data.height;
    this.sectors = [];

    let promises = [];
    for (let col = 0; col < this.height; col++) {
      this.sectors[col] = [];
      for (let row = 0; row < this.width; row++) {
        promises.push(this.loadSector(row, col));
      }
    }

    await Promise.all(promises);

    this.engine.onMapLoaded(this);
    this.isLoading = false;
    this.isLoaded = true;
  }

  /**
   *
   * @param x
   * @param y
   * @returns {Promise<void>}
   */
  async loadSector(x, y) {
    let sector = new Sector(this);
    await sector.load(this.getSectorPath(y, x), y, x);
    this.sectors[y][x] = sector;
  }

  /**
   *
   * @param path
   * @param onLoaded
   * @returns {Promise<void>}
   */
  async loadEntities(path, onLoaded) {
    AGate.Utils.logError(`Loading entities...`);

    let entityTypes = await this.engine.assetLoader.findDirs(`${path}/`);

    for (let [key, value] of entityTypes) {
      let entityFiles = await this.engine.assetLoader.findFiles(`${path}/${key}`, '.json');

      for (let [key, value] of entityFiles) {
        let entity = await this.loadEntity(value.name);
        onLoaded(entity);
      }
    }
  }

  /**
   *
   * @param path
   * @returns {Promise<Entity>}
   */
  async loadEntity(path) {
    AGate.Utils.logError(`Loading entity: ${path}`);

    let data = await this.engine.assetLoader.loadJsonFile(`${path}`);

    let id = AGate.Utils.getFileBase(path);
    let entity = await this.entitySystem.newEntity(id, data);

    return entity;
  }

  /**
   *
   * @param target
   */
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

    this.engine.client.scene.sortGroups(sortGroups);
  }

  /**
   *
   */
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

  /**
   *
   * @param x
   * @param y
   * @returns {string}
   */
  getSectorPath(x, y) {
    return `${this.path}/Sector/${x}/${y}`;
  }

  /**
   *
   * @param x
   * @param y
   * @returns {boolean}
   */
  isTileBlocked(x, y) {
    let tile = this.getTile(x, y);
    if (!tile)
      return true;

    return tile.blocked;
  }

  /**
   *
   * @param x
   * @param y
   * @returns {*}
   */
  getTile(x, y) {
    let location = new Location(x, y);

    let col = this.sectors[location.sectorY];
    if (!col)
      return null;

    let sector = col[location.sectorX];
    if (!sector)
      return null;

    return sector.getTile(location.tileX, location.tileY);
  }

  /**
   *
   * @param options
   * @returns {Array}
   */
  getEntitiesInRange(options) {
    let {types, center, range, ignore, filter} = options;

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

    let result = [];
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

            // Has tile the entity of given type
            let entity = tile[names[i]];
            if (!entity)
              continue;

            // Is entity being ignored?
            if (ignore) {
              let ignored = false;
              for (let other of ignore) {
                if (other.id == entity.id) {
                  ignored = true;
                  break;
                }
              }

              if (ignored)
                continue;
            }

            if (filter) {
              if (!filter(entity))
                continue;
            }

            // Put entity into list
            entity.distanceToCenter = Location.calculateDistance(entity.base.location, center);
            result.push(entity);
          }
        } else {
          //tile
          alert('error')
        }


      }
    }

    result.sort((a, b) => {
      return a.distanceToCenter - b.distanceToCenter;
    });

    return result;
  }


}
